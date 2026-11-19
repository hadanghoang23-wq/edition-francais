import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { LAB, type LabPair } from '../../content/frLab';
import { audioContext, decodeBlob, playBlob, sliceMono, unlockAudio } from '../../engine/audio';
import { useUnit } from '../../engine/content';
import { db } from '../../engine/db';
import { compareIntonation, extractContour, normalise } from '../../engine/pitch';
import { Recorder } from '../../engine/recorder';
import { recognitionAvailable, recognizeOnce } from '../../engine/speech';
import { Kicker, Page, Progress, TopBar, TtsBadge } from '../../ui/kit';
import { LevelMeter, PitchOverlay } from '../../ui/viz';
import { playRefOrTts, useHasAudio } from '../shared/AudioChip';
import { useMic } from '../shared/useMic';

function usePairs(lessonId: string): { title: string; pairs: LabPair[]; words: { fr: string; ipa: string }[]; back: string } | null {
  const [scope, id] = lessonId.split(':');
  const unit = useUnit(scope === 'core' ? undefined : scope);
  if (scope === 'core') {
    const l = LAB.find((x) => x.id === id);
    return l ? { title: l.title, pairs: l.pairs, words: l.sayWords, back: `/lab/lesson/${lessonId}` } : null;
  }
  const p = unit?.phonetics.find((x) => x.id === id);
  return p ? { title: p.title, pairs: p.minimalPairs, words: p.minimalPairs.flatMap((m) => [{ fr: m.a, ipa: m.ipaA }, { fr: m.b, ipa: m.ipaB }]), back: `/lab/lesson/${lessonId}` } : null;
}

export default function PairDrill() {
  const { lessonId = '' } = useParams();
  const [sp] = useSearchParams();
  const data = usePairs(lessonId);
  if (!data) return null;
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
      <TopBar back={back} kicker={`Nghe và chọn · ${lessonId.startsWith('core') ? 'Lab' : 'Unité'}`} title={title} right={!hasBook && <TtsBadge />} />
      <Progress value={round / rounds} color="var(--cobalt)" />
      <Page>
        {finished ? (
          <div className="mt-16 text-center">
            <div className="display text-[96px] leading-none">{score}<span className="text-4xl text-muted">/{rounds}</span></div>
            <p className="mt-4 text-[15px] text-muted">{score === rounds ? 'Tai bạn đã phân biệt được cặp âm này.' : 'Những cặp nhầm sẽ xuất hiện nhiều hơn ở lần sau.'}</p>
            <button className="btn btn-ink mt-8 w-full" onClick={() => { setRound(0); setScore(0); next(); }}>Làm lại</button>
          </div>
        ) : pair && (
          <div className="mt-10">
            <Kicker className="text-center">Bạn nghe thấy từ nào?</Kicker>
            <button onClick={() => play()} className="mx-auto mt-6 flex h-28 w-28 items-center justify-center rounded-full text-4xl text-white active:scale-95" style={{ background: 'var(--cobalt)' }} aria-label="Nghe lại">▶</button>
            <div className="mt-10 grid grid-cols-2 gap-3">
              {([0, 1] as const).map((side) => {
                const w = side ? pair.b : pair.a, ipa = side ? pair.ipaB : pair.ipaA;
                const state = answer === null ? '' : side === pick!.side ? 'ok' : answer === side ? 'bad' : '';
                return (
                  <button key={side} onClick={() => choose(side)} className="flex min-h-[120px] flex-col items-center justify-center border-2 transition-colors"
                    style={{ borderColor: state === 'ok' ? 'var(--ok)' : state === 'bad' ? 'var(--tomato)' : 'var(--ink)', background: state === 'ok' ? 'color-mix(in srgb, var(--ok) 14%, transparent)' : state === 'bad' ? 'color-mix(in srgb, var(--tomato) 12%, transparent)' : undefined }}>
                    <span className="serif text-[40px] leading-none">{w}</span>
                    <span className="ipa mt-2 text-[14px] text-muted">/{ipa}/</span>
                  </button>
                );
              })}
            </div>
            {answer !== null && (
              <div className="mt-6 grid grid-cols-3 gap-2">
                <button className="btn btn-ghost" onClick={() => play(0)}>▶ {pair.a}</button>
                <button className="btn btn-ghost" onClick={() => play(1)}>▶ {pair.b}</button>
                <button className="btn btn-ink" onClick={() => { setRound((r) => r + 1); next(); }}>Tiếp →</button>
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
      <TopBar back={back} kicker="Nói và ghi âm" title={title} />
      <Progress value={(i + 1) / words.length} color="var(--tomato)" />
      <Page>
        {mic.sheet}
        <div className="mt-10 text-center">
          <Kicker>{i + 1} / {words.length}</Kicker>
          <div className="serif mt-4 text-[56px] leading-none">{w.fr}</div>
          <div className="ipa mt-3 text-lg text-[var(--cobalt)]">/{w.ipa}/</div>
        </div>
        <div className="mt-8">
          <div className="flex justify-between"><Kicker>Ngữ điệu của bạn</Kicker><Kicker>đường giữa = cao độ trung bình</Kicker></div>
          <PitchOverlay mine={mine?.contour ?? null} native={null} height={100} />
          {rec && <LevelMeter active getLevel={() => recorder.current.level} />}
          {mine && <p className="mt-2 text-[14px]">{mine.verdict}</p>}
          {heard !== null && <p className="mt-2 text-[14px]">Máy nghe được: <b>{heard || '—'}</b></p>}
          {mic.error && <p className="mt-2 text-[14px] text-[var(--tomato)]">{mic.error}</p>}
        </div>
        <div className="mt-6 grid grid-cols-3 gap-2">
          <button className="btn btn-ghost gap-1" onClick={() => playRefOrTts(null, w.fr)}>▶ Mẫu <TtsBadge /></button>
          <button className={`btn ${rec ? 'btn-accent' : 'btn-ink'}`} onClick={toggle}>{rec ? '◼ Dừng' : '● Ghi'}</button>
          <button className="btn btn-ghost" disabled={!mine} onClick={() => mine && playBlob(mine.blob)}>▶ Tôi</button>
        </div>
        {recognitionAvailable() && <button className="chip mt-3" onClick={async () => { try { setHeard(await recognizeOnce()); } catch { setHeard(''); } }}>Kiểm tra bằng nhận dạng</button>}
        <div className="mt-8 grid grid-cols-2 gap-2">
          <button className="btn btn-ghost" disabled={i === 0} onClick={() => setI(i - 1)}>← Trước</button>
          <button className="btn btn-ink" disabled={i === words.length - 1} onClick={() => setI(i + 1)}>Tiếp →</button>
        </div>
      </Page>
    </>
  );
}
