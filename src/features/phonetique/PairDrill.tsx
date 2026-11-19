import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { LAB, type LabPair } from '../../content/frLab';
import { audioContext, decodeBlob, playBlob, sliceMono, unlockAudio } from '../../engine/audio';
import { useUnit } from '../../engine/content';
import { db } from '../../engine/db';
import { compareIntonation, extractContour, normalise } from '../../engine/pitch';
import { Recorder } from '../../engine/recorder';
import { recognitionAvailable, recognizeOnce } from '../../engine/speech';
import { ErrorNote, Kicker, Loading, Page, Progress, TopBar, TtsBadge, WithIpa } from '../../ui/kit';
import { Icon } from '../../ui/icons';
import { LevelMeter, PitchOverlay } from '../../ui/viz';
import { playRefOrTts, useHasAudio } from '../shared/AudioChip';
import { useMic } from '../shared/useMic';

function usePairs(lessonId: string): { title: string; pairs: LabPair[]; words: { fr: string; ipa: string }[]; back: string } | null | undefined {
  const [scope, id] = lessonId.split(':');
  const unit = useUnit(scope === 'core' ? undefined : scope);
  if (scope === 'core') {
    const l = LAB.find((x) => x.id === id);
    return l ? { title: l.title, pairs: l.pairs, words: l.sayWords, back: `/lab/lesson/${lessonId}` } : null;
  }
  if (unit === undefined) return undefined;
  const p = unit?.phonetics.find((x) => x.id === id);
  return p ? { title: p.title, pairs: p.minimalPairs, words: p.minimalPairs.flatMap((m) => [{ fr: m.a, ipa: m.ipaA }, { fr: m.b, ipa: m.ipaB }]), back: `/lab/lesson/${lessonId}` } : null;
}

export default function PairDrill() {
  const { lessonId = '' } = useParams();
  const [sp] = useSearchParams();
  const data = usePairs(lessonId);
  if (data === undefined) return <Loading />;
  if (!data) return <Loading label="Không tìm thấy bài" />;
  return sp.get('mode') === 'say' ? <SayDrill {...data} /> : <ListenDrill {...data} lessonId={lessonId} />;
}

function ListenDrill({ title, pairs, back, lessonId }: { title: string; pairs: LabPair[]; back: string; lessonId: string }) {
  const rounds = Math.min(12, Math.max(8, pairs.length * 2));
  const [weights, setWeights] = useState<number[] | null>(null);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [pick, setPick] = useState<{ p: number; side: 0 | 1 } | null>(null);
  const [answer, setAnswer] = useState<0 | 1 | null>(null);
  const hasBook = useHasAudio(pairs[0]?.audioA);

  useEffect(() => {
    // Pairs you got wrong before come up more often.
    db.errorLog.where('source').equals('phon').filter((e) => !e.resolved).toArray().then((errs) => {
      setWeights(pairs.map((p) => 1 + 2 * errs.filter((e) => e.prompt === `${p.a}|${p.b}`).length));
    });
  }, [pairs]);

  const next = () => {
    if (!weights) return;
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total, p = 0;
    while (r > weights[p]) { r -= weights[p]; p++; }
    setPick({ p: Math.min(p, pairs.length - 1), side: Math.random() < 0.5 ? 0 : 1 });
    setAnswer(null);
  };
  useEffect(() => { if (weights && !pick) next(); }, [weights]); // eslint-disable-line react-hooks/exhaustive-deps

  const pair = pick ? pairs[pick.p] : null;
  const play = async (side: 0 | 1 = pick!.side) => {
    if (!pair) return;
    await playRefOrTts(side === 0 ? pair.audioA : pair.audioB, side === 0 ? pair.a : pair.b);
  };
  useEffect(() => { if (pick) play().catch(() => undefined); }, [pick]); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = async (side: 0 | 1) => {
    if (answer !== null || !pair || !pick) return;
    setAnswer(side);
    const ok = side === pick.side;
    if (ok) setScore((s) => s + 1);
    else await db.errorLog.add({ source: 'phon', prompt: `${pair.a}|${pair.b}`, given: side ? pair.b : pair.a, expected: pick.side ? pair.b : pair.a, createdAt: new Date(), resolved: false });
  };

  const finished = round >= rounds;
  return (
    <>
      <TopBar back={back} kicker="Écoute" title={lessonId.startsWith('core') ? 'Paires minimales' : 'Unité'} right={!hasBook && <TtsBadge />} />
      <Progress value={round / rounds} />
      <Page>
        {finished ? (
          <div className="mt-20 text-center">
            <Kicker>Résultat</Kicker>
            <div className="t-num mt-4 text-[112px] leading-none">{score}<span className="text-[40px] text-muted"> / {rounds}</span></div>
            <div className="gold-rule mx-auto mt-6 w-12" />
            <p className="t-body mx-auto mt-6 max-w-[28em] text-ink2">{score === rounds ? 'Tai bạn đã phân biệt được cặp âm này.' : 'Những cặp nhầm sẽ xuất hiện nhiều hơn ở lần sau.'}</p>
            <button className="btn btn-primary mt-10 w-full" onClick={() => { setRound(0); setScore(0); next(); }}>Làm lại</button>
          </div>
        ) : pair && (
          <div className="mt-12">
            <p className="t-head"><WithIpa text={title} /></p>
            <div className="mt-6 flex items-baseline justify-between"><Kicker>Bạn nghe thấy từ nào?</Kicker><span className="t-num text-[17px] text-muted">{round + 1} / {rounds}</span></div>
            <button onClick={() => play()} className="mx-auto mt-12 flex h-24 w-24 items-center justify-center rounded-full text-accent transition-colors duration-300 active:bg-[var(--accent-soft)]"
              style={{ border: '1px solid var(--accent)' }} aria-label="Nghe lại"><Icon name="play" size={26} /></button>
            <div className="mt-14 grid grid-cols-2 border-y border-[var(--rule)]">
              {([0, 1] as const).map((side) => {
                const w = side ? pair.b : pair.a, ipa = side ? pair.ipaB : pair.ipaA;
                const state = answer === null ? '' : side === pick!.side ? 'ok' : answer === side ? 'bad' : '';
                return (
                  <button key={side} onClick={() => choose(side)} className={`relative flex min-h-[148px] flex-col items-center justify-center transition-colors duration-500 ${side ? 'border-l border-[var(--rule)]' : ''}`}
                    style={{ background: state === 'ok' ? 'color-mix(in srgb, var(--ok) 10%, transparent)' : state === 'bad' ? 'var(--accent-soft)' : undefined }}>
                    <span className="serif text-[44px] leading-none">{w}</span>
                    <span className="ipa mt-3">/{ipa}/</span>
                    {state && <span className="t-label absolute bottom-3" style={{ color: state === 'ok' ? 'var(--ok)' : 'var(--accent)' }}>{state === 'ok' ? 'đúng' : 'bạn chọn'}</span>}
                  </button>
                );
              })}
            </div>
            {answer !== null && (
              <div className="mt-8 grid grid-cols-3 gap-2">
                <button className="btn btn-line !px-2" onClick={() => play(0)}><Icon name="speaker" size={15} /><span className="serif !normal-case !tracking-normal text-[17px]">{pair.a}</span></button>
                <button className="btn btn-line !px-2" onClick={() => play(1)}><Icon name="speaker" size={15} /><span className="serif !normal-case !tracking-normal text-[17px]">{pair.b}</span></button>
                <button className="btn btn-primary" onClick={() => { setRound((r) => r + 1); next(); }}>Tiếp</button>
              </div>
            )}
          </div>
        )}
      </Page>
    </>
  );
}

function SayDrill({ title, words, back }: { title: string; words: { fr: string; ipa: string }[]; back: string }) {
  const [i, setI] = useState(0);
  const [rec, setRec] = useState(false);
  const [mine, setMine] = useState<{ contour: Float32Array; blob: Blob; verdict: string } | null>(null);
  const [heard, setHeard] = useState<string | null>(null);
  const recorder = useRef(new Recorder());
  const mic = useMic();
  const w = words[i];
  const flat = useMemo(() => new Float32Array(160), []);

  useEffect(() => { setMine(null); setHeard(null); }, [i]);

  const toggle = async () => {
    await unlockAudio();
    if (!rec) {
      if (!(await mic.ensure())) return;
      await recorder.current.start(audioContext());
      setRec(true);
      setTimeout(() => recorder.current.recording && stopIt(), 4000);
    } else stopIt();
  };
  const stopIt = async () => {
    const r = await recorder.current.stop();
    setRec(false);
    await db.recordings.add({ segKey: `pair:${w.fr}`, kind: 'pair', blob: r.blob, mime: r.mime, durationMs: r.durationMs, createdAt: new Date() });
    const buf = await decodeBlob(r.blob);
    const c = normalise(extractContour(sliceMono(buf), buf.sampleRate));
    const rep = compareIntonation(flat, c);
    const verdict = rep.wobbleMine > 0.6
      ? 'Cao độ lên xuống trong từ — giữ ngang hơn, chỉ kéo dài âm tiết cuối.'
      : Number.isNaN(rep.meanDiff) ? 'Chưa nghe rõ. Nói to hơn một chút.' : 'Cao độ khá đều — tốt.';
    setMine({ contour: c, blob: r.blob, verdict });
  };

  return (
    <>
      <TopBar back={back} kicker="Parole" title="Nói và ghi âm" />
      <Progress value={(i + 1) / words.length} />
      <Page>
        {mic.sheet}
        <div className="mt-14 text-center">
          <p className="t-head"><WithIpa text={title} /></p>
          <span className="t-num mt-4 block text-[17px] text-muted">{i + 1} / {words.length}</span>
          <div className="serif mt-6 text-[56px] leading-[1.05]">{w.fr}</div>
          <div className="ipa mt-4 !text-[16px]">/{w.ipa}/</div>
        </div>
        <div className="mt-12">
          <div className="flex items-baseline justify-between"><Kicker>Ngữ điệu của bạn</Kicker><Kicker>giữa = cao độ trung bình</Kicker></div>
          <div className="mt-3"><PitchOverlay mine={mine?.contour ?? null} native={null} height={96} /></div>
          {rec && <LevelMeter active getLevel={() => recorder.current.level} />}
          {mine && <p className="t-small mt-3 text-ink">{mine.verdict}</p>}
          {heard !== null && <p className="t-small mt-3 text-ink2">Máy nghe được: <span className="serif text-[18px] text-ink">{heard || '—'}</span></p>}
          {mic.error && <ErrorNote>{mic.error}</ErrorNote>}
        </div>
        <div className="mt-10 grid grid-cols-3 border-y border-[var(--rule)]">
          <button className="flex min-h-[64px] flex-col items-center justify-center gap-1.5 text-ink" onClick={() => playRefOrTts(null, w.fr)}>
            <Icon name="speaker" size={18} /><span className="t-label !text-ink">Mẫu <TtsBadge /></span>
          </button>
          <button className="flex min-h-[64px] flex-col items-center justify-center gap-1.5 border-x border-[var(--rule)] transition-colors duration-300"
            style={{ color: 'var(--accent)', background: rec ? 'var(--accent-soft)' : 'transparent' }} onClick={toggle}>
            <Icon name={rec ? 'stop' : 'record'} size={rec ? 13 : 15} /><span className="t-label" style={{ color: 'var(--accent)' }}>{rec ? 'Dừng' : 'Ghi'}</span>
          </button>
          <button className="flex min-h-[64px] flex-col items-center justify-center gap-1.5 text-ink disabled:opacity-35" disabled={!mine} onClick={() => mine && playBlob(mine.blob)}>
            <Icon name="play" size={15} /><span className="t-label !text-ink">Tôi</span>
          </button>
        </div>
        {recognitionAvailable() && <button className="btn btn-text mt-2 !px-0" onClick={async () => { try { setHeard(await recognizeOnce()); } catch { setHeard(''); } }}><Icon name="ear" size={16} />Nhận dạng giọng nói</button>}
        <div className="mt-8 flex justify-between">
          <button className="btn btn-text !px-0" disabled={i === 0} onClick={() => setI(i - 1)}><Icon name="back" size={16} />Trước</button>
          <button className="btn btn-text !px-0" disabled={i === words.length - 1} onClick={() => setI(i + 1)}>Tiếp<Icon name="forward" size={16} /></button>
        </div>
      </Page>
    </>
  );
}
