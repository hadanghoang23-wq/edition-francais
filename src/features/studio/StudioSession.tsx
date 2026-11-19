import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { audioContext, SegmentPlayer, sleep, unlockAudio, type Speed } from '../../engine/audio';
import { useTrack, useUnit } from '../../engine/content';
import { bumpStat, db, type LadderRow } from '../../engine/db';
import { Recorder } from '../../engine/recorder';
import type { Segment } from '../../engine/types';
import { DUR, EASE, Loading, ROMAN, Toast, TopBar } from '../../ui/kit';
import { Icon } from '../../ui/icons';
import { LevelMeter } from '../../ui/viz';
import { accentFor } from '../library/bookUnits';
import { useMic } from '../shared/useMic';
import SentenceSheet from './SentenceSheet';
import { STEPS } from './steps';

const SPEEDS: Speed[] = [0.6, 0.75, 0.85, 1];
const LOOPS = [1, 2, 3, 5];

export default function StudioSession() {
  const { unitId, docId } = useParams();
  const unit = useUnit(unitId);
  const doc = unit?.docs.find((d) => d.id === docId);
  const track = useTrack(doc?.trackId);
  const ladderKey = `${unitId}:${docId}`;
  const ladder = useLiveQuery(() => db.ladder.get(ladderKey), [ladderKey]);
  const reduce = useReducedMotion();

  const player = useMemo(() => new SegmentPlayer(), []);
  const [step, setStep] = useState<number | null>(null);
  const [speed, setSpeed] = useState<Speed>(1);
  const [loops, setLoops] = useState(1);
  const [showVi, setShowVi] = useState(false);
  const [recEcho, setRecEcho] = useState(false);
  const [idx, setIdx] = useState(0);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<'listen' | 'speak' | null>(null);
  const [speakProgress, setSpeakProgress] = useState(0);
  const [sheetFor, setSheetFor] = useState<Segment | null>(null);
  const [showHow, setShowHow] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [takeOn, setTakeOn] = useState(false);
  const token = useRef(0);
  const sweepRef = useRef<HTMLSpanElement | null>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const recorder = useRef(new Recorder());
  const mic = useMic();

  const unlocked = ladder?.unlocked ?? 0;
  const current = step ?? Math.min(7, unlocked + 1);
  const def = STEPS[current - 1];
  const segs = track?.segments ?? [];
  const accent = unit ? accentFor(unit.number) : 'var(--accent)';
  const textHidden = def?.text === 'hidden';

  useEffect(() => { player.setRate(speed); }, [speed, player]);
  useEffect(() => () => { token.current++; player.stop(); }, [player]);
  useEffect(() => {
    if (!track) return;
    player.load(track.id).catch(() => undefined);
    player.onTime = (t) => {
      const el = sweepRef.current;
      if (!el) return;
      const s = Number(el.dataset.start), e = Number(el.dataset.end);
      el.style.setProperty('--p', `${Math.max(0, Math.min(100, ((t - s) / (e - s)) * 100))}%`);
    };
  }, [track, player]);
  useEffect(() => {
    lineRefs.current[idx]?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
  }, [idx, reduce]);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2200); };

  const completePass = useCallback(async (n: number) => {
    await db.transaction('rw', db.ladder, async () => {
      const row: LadderRow = (await db.ladder.get(ladderKey)) ?? { docId: ladderKey, unlocked: 0, counts: {}, updatedAt: new Date() };
      row.counts[n] = (row.counts[n] ?? 0) + 1;
      if (row.counts[n] >= STEPS[n - 1].needs && row.unlocked < n) row.unlocked = n;
      row.updatedAt = new Date();
      await db.ladder.put(row);
    });
    const after = await db.ladder.get(ladderKey);
    if (after && after.unlocked >= n && n < 7) flash(`Hoàn thành bước ${n}. Bước ${n + 1} đã mở.`);
    else if (n === 7) flash('Đã lưu bản ghi cả đoạn.');
    else flash(`Lượt ${after?.counts[n] ?? 1}/${STEPS[n - 1].needs}`);
  }, [ladderKey]);

  const stop = useCallback(() => {
    token.current++;
    player.stop();
    setRunning(false);
    setPhase(null);
  }, [player]);

  /** Range used in continuous modes: keep the natural pause before the next sentence. */
  const rangeOf = (k: number): [number, number] => [segs[k].start, k + 1 < segs.length ? Math.max(segs[k].end, segs[k + 1].start) : segs[k].end];

  const runContinuous = async (from: number, my: number) => {
    for (let k = from; k < segs.length; k++) {
      if (token.current !== my) return false;
      setIdx(k);
      for (let l = 0; l < loops; l++) {
        if (token.current !== my) return false;
        const [a, b] = rangeOf(k);
        await player.playRange(a, l < loops - 1 ? segs[k].end : b);
      }
    }
    return token.current === my;
  };

  const runEcho = async (from: number, my: number) => {
    for (let k = from; k < segs.length; k++) {
      if (token.current !== my) return false;
      setIdx(k);
      for (let l = 0; l < loops; l++) {
        if (token.current !== my) return false;
        setPhase('listen');
        await player.playSegment(segs[k]);
        if (token.current !== my) return false;
        setPhase('speak');
        const wait = ((segs[k].end - segs[k].start) / speed) * 1.5 * 1000 + 300;
        if (recEcho) await recorder.current.start(audioContext());
        const t0 = performance.now();
        while (performance.now() - t0 < wait) {
          if (token.current !== my) break;
          setSpeakProgress((performance.now() - t0) / wait);
          await sleep(40);
        }
        if (recEcho && recorder.current.recording) {
          const r = await recorder.current.stop();
          await db.recordings.add({ segKey: `${track!.id}#${segs[k].idx}`, kind: 'sentence', ladderStep: 3, blob: r.blob, mime: r.mime, durationMs: r.durationMs, createdAt: new Date() });
          await bumpStat({ sentences: 1 });
        }
        setSpeakProgress(0);
      }
    }
    setPhase(null);
    return token.current === my;
  };

  const start = async (from = idx) => {
    if (!track || !segs.length) return;
    await unlockAudio();
    await player.load(track.id);
    if ((current === 3 && recEcho) || current === 7) { if (!(await mic.ensure())) return; }
    const my = ++token.current;
    setRunning(true);
    const startedAt = performance.now();
    let ok = false;
    try {
      if (def.play === 'echo') ok = await runEcho(from, my);
      else if (def.record === 'take') {
        await recorder.current.start(audioContext());
        setTakeOn(true);
        ok = await runContinuous(0, my);
        const r = await recorder.current.stop();
        setTakeOn(false);
        if (ok) await db.recordings.add({ segKey: `take:${ladderKey}`, kind: 'take', ladderStep: 7, blob: r.blob, mime: r.mime, durationMs: r.durationMs, createdAt: new Date() });
      } else ok = await runContinuous(from, my);
    } catch (e) {
      flash((e as Error).message || 'Không phát được âm thanh.');
    } finally {
      if (recorder.current.recording) await recorder.current.stop().catch(() => undefined);
      setTakeOn(false);
    }
    if (current >= 3) await bumpStat({ shadowMs: Math.round(performance.now() - startedAt) });
    if (token.current === my) {
      setRunning(false);
      setPhase(null);
      if (ok && from === 0) await completePass(current);
      else if (ok) flash('Phát từ đầu đoạn để tính một lượt hoàn chỉnh.');
    }
  };

  const playOne = async (k: number) => {
    stop();
    const my = ++token.current;
    setIdx(k);
    await unlockAudio();
    await player.load(track!.id);
    setRunning(true);
    for (let l = 0; l < loops; l++) {
      if (token.current !== my) break;
      await player.playSegment(segs[k]);
      if (l < loops - 1) await sleep(250);
    }
    if (token.current === my) setRunning(false);
  };


  if (unit === undefined || (unit && !doc && unit.docs.length === 0)) return <Loading />;
  if (!unit || !doc) return <Loading label="Không tìm thấy đoạn này" />;
  if (track === null) return <Loading label="Không tìm thấy bài nghe — hãy nhập lại gói" />;
  if (!track) return <Loading />;

  let lastSpeaker: string | null = null;

  return (
    <div className="flex h-full flex-col">
      {mic.sheet}
      <TopBar back={`/unit/${unit.id}`} kicker={`Studio · piste ${track.number}`} right={<span className="t-label">p. {doc.printedPage}</span>} />

      {/* Title and ladder: seven roman numerals on a hairline */}
      <div className="px-6 pt-5">
        <div className="mx-auto max-w-[600px]">
          <div className="t-head italic">{doc.title}</div>
          <div className="mt-4 flex items-center justify-between">
            {STEPS.map((s) => {
              const locked = s.n > unlocked + 1;
              const done = s.n <= unlocked;
              const active = s.n === current;
              return (
                <button key={s.n} disabled={locked} onClick={() => { stop(); setStep(s.n); setShowHow(true); }}
                  aria-label={`Bậc ${s.n}: ${s.short}${locked ? ' (chưa mở)' : ''}`} aria-current={active ? 'step' : undefined}
                  className="relative flex h-11 min-w-[40px] items-center justify-center">
                  <span className="t-num text-[19px] transition-colors duration-300"
                    style={{ color: active ? accent : done ? 'var(--ink)' : 'var(--faint)' }}>
                    {locked ? <Icon name="lock" size={12} /> : ROMAN[s.n - 1]}
                  </span>
                  {active && <span className="absolute bottom-1.5 left-1/2 h-px w-5 -translate-x-1/2" style={{ background: accent }} />}
                </button>
              );
            })}
          </div>
          <button className="block w-full pb-4 text-left" onClick={() => setShowHow(!showHow)}>
            <span className="t-label" style={{ color: accent }}>Bậc {ROMAN[current - 1]} · {def.title}</span>
            <AnimatePresence initial={false}>
              {showHow && (
                <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: DUR, ease: EASE }} className="t-small measure overflow-hidden pt-1 text-ink2">
                  {def.howVi}{current === 1 && ` (${ladder?.counts[1] ?? 0}/2 lượt)`}
                </motion.p>
              )}
            </AnimatePresence>
          </button>
          <div className="rule" />
        </div>
      </div>

      {/* Transcript */}
      <div className="scroll-area flex-1 overflow-y-auto px-6 pb-72 pt-6">
        <div className="mx-auto max-w-[600px]">
          {segs.map((s, k) => {
            const isCur = k === idx;
            const showSpeaker = s.speaker && s.speaker !== lastSpeaker;
            lastSpeaker = s.speaker ?? lastSpeaker;
            return (
              <div key={s.idx} ref={(el) => (lineRefs.current[k] = el)} className={showSpeaker || s.label ? 'pt-5' : 'pt-2'}>
                {(showSpeaker || s.label) && (
                  <div className="t-label mb-1 transition-colors duration-300" style={{ color: isCur ? accent : undefined }}>{s.label ? `${s.label} · ` : ''}{showSpeaker ? s.speaker : ''}</div>
                )}
                <button onClick={() => (running && isCur ? stop() : playOne(k))} onDoubleClick={() => setSheetFor(s)}
                  className={`serif w-full text-left transition-[font-size,color] duration-500 ease-maison ${isCur ? 'text-[29px] leading-[1.22] text-ink' : 'text-[21px] leading-[1.35] text-ink2 opacity-70'}`}>
                  {textHidden ? (
                    <Redacted text={s.text} active={isCur} accent={accent} />
                  ) : isCur ? (
                    <span ref={sweepRef} data-start={s.start} data-end={s.end} className="sweep" style={{ ['--p' as any]: '0%' }}>{s.text}</span>
                  ) : s.text}
                </button>
                {showVi && !textHidden && s.vi && <div className={`t-small mt-1 ${isCur ? 'text-ink2' : 'text-faint'}`}>{s.vi}</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Dock: speeds as words, fine transport, one ring */}
      <div className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-[var(--rule)] px-6 pt-2" style={{ background: 'var(--paper)' }}>
        <div className="mx-auto max-w-[600px]">
          <AnimatePresence>
            {phase === 'speak' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: DUR, ease: EASE }} className="pt-2">
                <div className="flex items-center justify-between"><span className="t-label" style={{ color: accent }}>À vous · nhắc lại</span>{recEcho && <span className="t-label !text-accent">đang ghi</span>}</div>
                <div className="mt-2 h-px bg-[var(--rule)]"><div className="h-px" style={{ width: `${speakProgress * 100}%`, background: accent }} /></div>
              </motion.div>
            )}
          </AnimatePresence>
          {takeOn && <div className="pt-2"><LevelMeter active getLevel={() => recorder.current.level} /></div>}
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              {SPEEDS.map((sp) => (
                <button key={sp} className="opt serif text-[18px]" aria-pressed={speed === sp} onClick={() => setSpeed(sp)} aria-label={`Tốc độ ${sp}`}>
                  <span className="opt-u pb-0.5">{sp === 1 ? '1,0' : String(sp).replace('.', ',')}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center">
              <button className="opt gap-1" onClick={() => setLoops(LOOPS[(LOOPS.indexOf(loops) + 1) % LOOPS.length])} aria-label="Số lần lặp mỗi câu" aria-pressed={loops > 1}>
                <Icon name="loop" size={16} /><span className="t-num text-[17px]">{loops}</span>
              </button>
              {!textHidden && <button className="opt t-label !tracking-[0.18em]" aria-pressed={showVi} onClick={() => setShowVi(!showVi)}><span className="opt-u">VI</span></button>}
              {current === 3 && <button className="opt t-label !tracking-[0.18em]" aria-pressed={recEcho} onClick={() => setRecEcho(!recEcho)}><span className="opt-u">Ghi</span></button>}
            </div>
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2 pb-1 pt-2">
            <button className="flex h-12 items-center justify-center text-ink" aria-label="Câu trước" onClick={() => playOne(Math.max(0, idx - 1))}><Icon name="prev" size={20} /></button>
            <button onClick={() => (running ? stop() : start(current === 7 ? 0 : idx === segs.length - 1 ? 0 : idx))}
              aria-label={running ? 'Dừng' : current === 7 ? 'Ghi cả đoạn' : 'Phát'}
              className="flex h-16 w-16 items-center justify-center rounded-full transition-colors duration-300"
              style={{ border: `1px solid ${current === 7 ? 'var(--accent)' : accent}`, color: current === 7 ? 'var(--accent)' : accent, background: running ? 'var(--accent-soft)' : 'transparent' }}>
              <Icon name={running ? 'stop' : current === 7 ? 'record' : 'play'} size={running ? 16 : 22} />
            </button>
            <button className="flex h-12 items-center justify-center text-ink" aria-label="Câu sau" onClick={() => playOne(Math.min(segs.length - 1, idx + 1))}><Icon name="next" size={20} /></button>
            <button className="btn btn-line !min-h-[48px] !px-3" onClick={() => { stop(); setSheetFor(segs[idx]); }}>
              <Icon name="mic" size={15} />Luyện câu
            </button>
          </div>
          <p className="t-meta pb-1 text-center !text-[12px]">
            {running ? (current === 7 ? 'Đang ghi cả đoạn…' : 'Chạm câu đang phát để dừng') : 'Chạm một câu để nghe · chạm hai lần để luyện câu'}
          </p>
        </div>
      </div>

      <SentenceSheet open={!!sheetFor} onClose={() => setSheetFor(null)} trackId={track.id} unitId={unit.id} seg={sheetFor} player={player} ladderStep={current} />
      <Toast msg={toast ?? mic.error} />
    </div>
  );
}

/** Text hidden: a fine rule the length of each word, like a redacted proof. */
function Redacted({ text, active, accent }: { text: string; active: boolean; accent: string }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-3 py-2 align-middle">
      {text.split(/\s+/).map((w, i) => (
        <span key={i} className="inline-block h-[2px]" style={{ width: `${Math.max(1, w.length) * 0.4}em`, background: active ? accent : 'var(--faint)' }} />
      ))}
    </span>
  );
}
