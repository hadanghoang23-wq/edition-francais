import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { audioContext, SegmentPlayer, sleep, unlockAudio, type Speed } from '../../engine/audio';
import { useTrack, useUnit } from '../../engine/content';
import { bumpStat, db, type LadderRow } from '../../engine/db';
import { Recorder } from '../../engine/recorder';
import type { Segment } from '../../engine/types';
import { Toast, TopBar } from '../../ui/kit';
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

  if (!unit || !doc) return null;
  if (track === null) return <p className="p-6">Không tìm thấy bài nghe.</p>;
  if (!track) return null;

  let lastSpeaker: string | null = null;

  return (
    <div className="flex h-full flex-col">
      {mic.sheet}
      <TopBar back={`/unit/${unit.id}`} kicker={`Studio · piste ${track.number} · p. ${doc.printedPage}`} title={doc.title} />

      {/* Ladder */}
      <div className="border-b hairline px-4 py-3">
        <div className="mx-auto flex max-w-[640px] items-center gap-1.5">
          {STEPS.map((s) => {
            const locked = s.n > unlocked + 1;
            const done = s.n <= unlocked;
            const active = s.n === current;
            return (
              <button key={s.n} disabled={locked} onClick={() => { stop(); setStep(s.n); setShowHow(true); }}
                aria-label={`Bước ${s.n}: ${s.short}${locked ? ' (chưa mở)' : ''}`}
                className="flex h-9 flex-1 items-center justify-center border text-[13px] font-semibold tabular-nums transition-colors"
                style={{ borderColor: active ? accent : 'var(--rule)', background: done ? accent : active ? 'transparent' : 'transparent', color: done ? '#fff' : locked ? 'var(--muted)' : 'var(--ink)', opacity: locked ? 0.45 : 1, borderWidth: active ? 2 : 1 }}>
                {locked ? '·' : s.n}
              </button>
            );
          })}
        </div>
        <button className="mx-auto mt-2 block w-full max-w-[640px] text-left" onClick={() => setShowHow(!showHow)}>
          <span className="kicker" style={{ color: accent }}>Bước {current} · {def.title}</span>
          <AnimatePresence initial={false}>
            {showHow && (
              <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden text-[13px] leading-snug text-muted">
                {def.howVi}{current === 1 && ` (${ladder?.counts[1] ?? 0}/2 lượt)`}
              </motion.p>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* Transcript */}
      <div className="scroll-area flex-1 overflow-y-auto px-4 pb-64 pt-4">
        <div className="mx-auto max-w-[640px]">
          {segs.map((s, k) => {
            const isCur = k === idx;
            const showSpeaker = s.speaker && s.speaker !== lastSpeaker;
            lastSpeaker = s.speaker ?? lastSpeaker;
            return (
              <div key={s.idx} ref={(el) => (lineRefs.current[k] = el)} className="py-1.5">
                {(showSpeaker || s.label) && (
                  <div className="kicker mt-2" style={{ color: isCur ? accent : undefined }}>{s.label ? `${s.label} · ` : ''}{showSpeaker ? s.speaker : ''}</div>
                )}
                <button onClick={() => (running && isCur ? stop() : playOne(k))} onDoubleClick={() => setSheetFor(s)}
                  className={`serif w-full text-left leading-[1.18] transition-[font-size,opacity] duration-200 ${isCur ? 'text-[29px]' : 'text-[22px] opacity-55'}`}>
                  {textHidden ? (
                    <Redacted text={s.text} active={isCur} accent={accent} />
                  ) : isCur ? (
                    <span ref={sweepRef} data-start={s.start} data-end={s.end} className="sweep"
                      style={{ ['--sweep-color' as any]: `color-mix(in srgb, ${accent} 30%, transparent)`, ['--p' as any]: '0%' }}>{s.text}</span>
                  ) : s.text}
                </button>
                {showVi && !textHidden && s.vi && <div className={`text-[14px] text-muted ${isCur ? '' : 'opacity-60'}`}>{s.vi}</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Dock */}
      <div className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t-2 bg-paper px-4 pt-3" style={{ borderColor: 'var(--ink)' }}>
        <div className="mx-auto max-w-[640px]">
          <AnimatePresence>
            {phase === 'speak' && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-2">
                <div className="flex items-center justify-between"><span className="kicker" style={{ color: accent }}>Đến lượt bạn — nhắc lại</span>{recEcho && <span className="kicker text-[var(--tomato)]">● đang ghi</span>}</div>
                <div className="mt-1 h-1 bg-[var(--rule)]"><div className="h-full" style={{ width: `${speakProgress * 100}%`, background: accent }} /></div>
              </motion.div>
            )}
          </AnimatePresence>
          {takeOn && <div className="mb-2"><LevelMeter active getLevel={() => recorder.current.level} /></div>}
          <div className="flex flex-wrap items-center gap-1.5">
            {SPEEDS.map((sp) => <button key={sp} className="chip px-2.5" aria-pressed={speed === sp} onClick={() => setSpeed(sp)}>{sp === 1 ? '1×' : sp}</button>)}
            <button className="chip px-2.5" onClick={() => setLoops(LOOPS[(LOOPS.indexOf(loops) + 1) % LOOPS.length])} aria-label="Số lần lặp mỗi câu">⟲ {loops}</button>
            {!textHidden && <button className="chip px-2.5" aria-pressed={showVi} onClick={() => setShowVi(!showVi)}>VI</button>}
            {current === 3 && <button className="chip px-2.5" aria-pressed={recEcho} onClick={() => setRecEcho(!recEcho)}>● Ghi</button>}
          </div>
          <div className="mt-3 grid grid-cols-[1fr_auto_1fr_1fr] items-center gap-2 pb-1">
            <button className="btn btn-ghost h-14" aria-label="Câu trước" onClick={() => playOne(Math.max(0, idx - 1))}>⏮</button>
            <button onClick={() => (running ? stop() : start(current === 7 ? 0 : idx === segs.length - 1 ? 0 : idx))}
              aria-label={running ? 'Dừng' : 'Phát'}
              className="flex h-[68px] w-[68px] items-center justify-center rounded-full text-2xl text-white transition-transform active:scale-95"
              style={{ background: current === 7 ? 'var(--tomato)' : accent }}>
              {running ? '◼' : current === 7 ? '●' : '▶'}
            </button>
            <button className="btn btn-ghost h-14" aria-label="Câu sau" onClick={() => playOne(Math.min(segs.length - 1, idx + 1))}>⏭</button>
            <button className="btn btn-ink h-14 flex-col !gap-0 px-1 text-[12px]" onClick={() => { stop(); setSheetFor(segs[idx]); }}>
              <span className="text-lg leading-none">◉</span>Luyện câu
            </button>
          </div>
          <p className="pb-1 text-center text-[11px] text-muted">
            {running ? (current === 7 ? 'Đang ghi cả đoạn…' : 'Chạm vào câu đang phát để dừng') : 'Chạm một câu để nghe · ▶ phát từ câu đang chọn · chạm hai lần để luyện câu'}
          </p>
        </div>
      </div>

      <SentenceSheet open={!!sheetFor} onClose={() => setSheetFor(null)} trackId={track.id} unitId={unit.id} seg={sheetFor} player={player} ladderStep={current} />
      <Toast msg={toast ?? mic.error} />
    </div>
  );
}

/** Text hidden: draw ink bars the length of each word, like a redacted proof. */
function Redacted({ text, active, accent }: { text: string; active: boolean; accent: string }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-2 py-1 align-middle">
      {text.split(/\s+/).map((w, i) => (
        <span key={i} className="inline-block h-[0.42em]" style={{ width: `${Math.max(1, w.length) * 0.42}em`, background: active ? accent : 'var(--ink)', opacity: active ? 0.85 : 0.25 }} />
      ))}
    </span>
  );
}
