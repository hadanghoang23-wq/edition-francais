import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { unlockAudio, type Speed } from '../../engine/audio';
import { useTrack, useUnits } from '../../engine/content';
import { diffWords, gradeAnswer, scoreDiff, type AnswerVerdict, type DiffOp } from '../../engine/diff';
import { logError, markCorrect } from '../../engine/errors';
import { db } from '../../engine/db';

import type { Segment } from '../../engine/types';
import { Empty, Kicker, Loading, Options, Page, Progress, Row, Section, TopBar, two } from '../../ui/kit';
import { Icon } from '../../ui/icons';
import { DiffLegend, DiffView } from '../exercises/ExerciseRunner';
import { badColor, GapInput, okColor } from '../exercises/parts';
import { sharedPlayer } from '../shared/AudioChip';

/** Keep a running score per track and mode so Today can show listening progress. */
async function bumpTrack(mode: 'dictee' | 'gaps', trackId: string, unitId: string, pct: number) {
  const id = `${mode}:${trackId}`;
  const prev = await db.exerciseResults.get(id);
  const n = (prev?.attempts ?? 0) + 1;
  const avg = prev ? (prev.last * prev.attempts + pct) / n : pct;
  await db.exerciseResults.put({ id, unitId, skill: 'comprehension-orale', best: Math.max(prev?.best ?? 0, avg), last: avg, attempts: n, updatedAt: new Date() });
}

/** Choose a track for dictation or gap-fill listening. */
export function ListenTracks({ mode }: { mode: 'dictee' | 'gaps' }) {
  const units = useUnits();
  if (!units) return <Loading />;
  return (
    <>
      <TopBar back="/practice" kicker="Compréhension orale" title={mode === 'dictee' ? 'Dictée' : 'Điền khi nghe'} />
      <Page>
        <h1 className="t-display mt-10">{mode === 'dictee' ? 'Dictée' : 'Phrases à trous'}</h1>
        <p className="t-small measure mt-2 text-ink2">{mode === 'dictee'
          ? 'Nghe từng câu trong sách và viết lại. Lỗi dấu được tách riêng khỏi lỗi chính tả.'
          : 'Nghe từng câu, điền những từ bị che. Câu nào cũng có thể nghe lại ở tốc độ chậm.'}</p>
        {units.length === 0 && <Empty kicker="Chưa có bài" title="Rien à écouter." body="Nhập gói nội dung để có bài nghe." to="/import" cta="Nhập gói" />}
        {units.map((u) => (
          <Section key={u.id} n={two(u.number)} title={<span className="serif normal-case tracking-normal text-[20px] italic text-ink">{u.title}</span>}>
            {u.docs.filter((d) => d.trackId && d.kind !== 'sequence').map((d) => (
              <Row key={d.id} to={`/practice/${mode}/${d.trackId}`} title={<span className="serif text-[18px]">{d.title}</span>} sub={<span className="t-meta">piste {Number(d.trackId!.slice(1))} · p. {d.printedPage}</span>} />
            ))}
          </Section>
        ))}
      </Page>
    </>
  );
}

function SpeedPick({ speed, setSpeed }: { speed: Speed; setSpeed: (s: Speed) => void }) {
  return <Options serif value={speed} onChange={setSpeed} options={[[0.6, '0,6'], [0.75, '0,75'], [0.85, '0,85'], [1, '1,0']]} />;
}

function PlayLine({ trackId, seg, speed }: { trackId: string; seg: Segment; speed: Speed }) {
  const [busy, setBusy] = useState(false);
  const play = async () => {
    await unlockAudio();
    const p = sharedPlayer();
    await p.load(trackId);
    p.setRate(speed);
    setBusy(true);
    await p.playSegment(seg);
    setBusy(false);
  };
  useEffect(() => { play().catch(() => undefined); }, [seg.idx]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <button onClick={play} aria-label="Nghe lại" className="mx-auto flex h-24 w-24 items-center justify-center rounded-full text-accent transition-colors duration-300"
      style={{ border: '1px solid var(--accent)', background: busy ? 'var(--accent-soft)' : 'transparent' }}><Icon name={busy ? 'stop' : 'play'} size={busy ? 18 : 26} /></button>
  );
}

/** Dictation, one sentence at a time. */
export function Dictee() {
  const { trackId } = useParams();
  const track = useTrack(trackId);
  const [i, setI] = useState(0);
  const [speed, setSpeed] = useState<Speed>(0.85);
  const [tolerant, setTolerant] = useState(false);
  const [typed, setTyped] = useState('');
  const [ops, setOps] = useState<DiffOp[] | null>(null);
  const [scores, setScores] = useState<number[]>([]);
  if (track === undefined) return <Loading />;
  if (!track) return <Loading label="Không tìm thấy bài nghe" />;
  const segs = track.segments;
  const seg = segs[i];
  const finished = i >= segs.length;

  const check = async () => {
    const o = diffWords(typed, seg.text);
    const s = scoreDiff(o, tolerant);
    setOps(o);
    setScores([...scores, s.score]);
    const ref = `dictee:${track.id}#${seg.idx}`;
    if (track.unitId) await bumpTrack('dictee', track.id, track.unitId, s.score);
    if (s.score >= 0.999) await markCorrect(ref);
    else await logError({ source: 'listening', prompt: `Dictée · piste ${track.number}`, given: typed, expected: seg.text, ref, hint: seg.vi ?? undefined });
  };
  const next = () => { setI(i + 1); setTyped(''); setOps(null); };
  const s = ops ? scoreDiff(ops, tolerant) : null;

  return (
    <>
      <TopBar back="/practice/dictee" kicker="Dictée" title={`piste ${track.number}`} right={<span className="t-num text-[17px] text-ink2">{Math.min(i + 1, segs.length)} / {segs.length}</span>} />
      <Progress value={i / segs.length} />
      <Page>
        {finished ? (
          <div className="mt-20 text-center">
            <Kicker>Résultat</Kicker>
            <div className="t-num mt-4 text-[96px] leading-none">{Math.round((scores.reduce((a, b) => a + b, 0) / Math.max(1, scores.length)) * 100)}<span className="text-[36px] text-muted"> %</span></div>
            <div className="gold-rule mx-auto mt-6 w-12" />
            <p className="t-body mt-6 text-ink2">Các câu sai đã được ghi vào sổ lỗi.</p>
            <div className="mt-10 grid grid-cols-2 gap-3"><button className="btn btn-line" onClick={() => { setI(0); setScores([]); }}>Làm lại</button><Link to="/practice/dictee" className="btn btn-primary">Bài khác</Link></div>
          </div>
        ) : (
          <div className="mt-10">
            <div className="flex flex-col items-start gap-1"><SpeedPick speed={speed} setSpeed={setSpeed} />
              <button className="t-label flex min-h-[44px] items-center gap-2" onClick={() => setTolerant(!tolerant)} aria-pressed={tolerant}>
                <span className="h-3 w-3 rounded-full" style={{ border: '1px solid currentColor', background: tolerant ? 'currentColor' : 'transparent' }} />Chấp nhận thiếu dấu
              </button>
            </div>
            {seg.speaker && <Kicker className="mt-8 text-center">{seg.speaker}</Kicker>}
            <div className="mt-6"><PlayLine trackId={track.id} seg={seg} speed={speed} /></div>
            {!ops ? (
              <>
                <textarea value={typed} onChange={(e) => setTyped(e.target.value)} rows={2} autoCapitalize="sentences" autoCorrect="off" spellCheck={false} aria-label="Viết những gì bạn nghe"
                  className="serif mt-10 w-full resize-none border-b border-[var(--rule-strong)] bg-transparent py-2 text-[22px] leading-snug outline-none focus:border-[var(--ink)]" placeholder="Écrivez ce que vous entendez…" />
                <AccentBar onInsert={(c) => setTyped((t) => t + c)} />
                <button className="btn btn-primary mt-8 w-full" disabled={!typed.trim()} onClick={check}>Kiểm tra</button>
              </>
            ) : (
              <>
                <div className="mt-10"><DiffView ops={ops} /></div>
                <DiffLegend />
                <p className="t-small mt-4 text-ink2">{seg.vi}</p>
                <div className="mt-4 flex gap-6">
                  <span className="t-num text-[28px]">{Math.round(s!.score * 100)} %</span>
                  <span className="t-meta self-center">{s!.accents} lỗi dấu · {s!.spelling + s!.wrong} lỗi chính tả · {s!.missing} thiếu</span>
                </div>
                <button className="btn btn-primary mt-8 w-full" onClick={next}>Câu tiếp</button>
              </>
            )}
          </div>
        )}
      </Page>
    </>
  );
}

export const ACCENTS = ['é', 'è', 'ê', 'à', 'â', 'ç', 'ù', 'û', 'ô', 'î', 'ï', 'ë', 'œ'];
export function AccentBar({ onInsert }: { onInsert: (c: string) => void }) {
  return <div className="mt-2 flex flex-wrap">{ACCENTS.map((c) => <button key={c} className="serif flex h-11 w-10 items-center justify-center text-[21px] text-ink2 active:text-accent" onClick={() => onInsert(c)}>{c}</button>)}</div>;
}

/** Choose which words to hide: every 4th content word of 3+ letters, never a capitalised name mid-sentence. */
export function gapPlan(text: string): { parts: string[]; gaps: number[] } {
  const parts = text.split(/(\s+)/);
  const gaps: number[] = [];
  let content = 0;
  parts.forEach((p, k) => {
    const w = p.replace(/[^\p{L}'’-]/gu, '');
    const isName = k > 0 && /^\p{Lu}/u.test(w);
    if (w.length >= 3 && !isName) { if (content % 4 === 1) gaps.push(k); content++; }
  });
  if (!gaps.length) { const k = parts.findIndex((p) => p.replace(/[^\p{L}]/gu, '').length >= 2); if (k >= 0) gaps.push(k); }
  return { parts, gaps };
}

/** Gap-fill listening over a whole track. */
export function GapListen() {
  const { trackId } = useParams();
  const track = useTrack(trackId);
  const [i, setI] = useState(0);
  const [speed, setSpeed] = useState<Speed>(0.85);
  const [vals, setVals] = useState<Record<number, string>>({});
  const [v, setV] = useState<Record<number, AnswerVerdict> | null>(null);
  const [right, setRight] = useState(0);
  const [total, setTotal] = useState(0);
  const seg = track?.segments[i];
  const plan = useMemo(() => (seg ? gapPlan(seg.text) : null), [seg]);
  if (track === undefined) return <Loading />;
  if (!track) return <Loading label="Không tìm thấy bài nghe" />;
  const segs = track.segments;
  const finished = i >= segs.length;
  const core = (w: string) => w.replace(/^[^\p{L}]+|[^\p{L}'’-]+$/gu, '');

  const check = async () => {
    const out: Record<number, AnswerVerdict> = {};
    let ok = 0;
    for (const k of plan!.gaps) { out[k] = gradeAnswer(vals[k] ?? '', core(plan!.parts[k])); if (out[k] === 'exact') ok++; }
    setV(out); setRight(right + ok); setTotal(total + plan!.gaps.length);
    const ref = `gaps:${track.id}#${seg!.idx}`;
    if (track.unitId) await bumpTrack('gaps', track.id, track.unitId, plan!.gaps.length ? ok / plan!.gaps.length : 1);
    if (ok === plan!.gaps.length) await markCorrect(ref);
    else await logError({ source: 'listening', prompt: `Điền khi nghe · piste ${track.number}`, given: plan!.gaps.map((k) => vals[k] ?? '').join(' / '), expected: seg!.text, ref, hint: seg!.vi ?? undefined });
  };

  return (
    <>
      <TopBar back="/practice/gaps" kicker="Phrases à trous" title={`piste ${track.number}`} right={<span className="t-num text-[17px] text-ink2">{Math.min(i + 1, segs.length)} / {segs.length}</span>} />
      <Progress value={i / segs.length} />
      <Page>
        {finished ? (
          <div className="mt-20 text-center">
            <Kicker>Résultat</Kicker>
            <div className="t-num mt-4 text-[96px] leading-none">{right}<span className="text-[36px] text-muted"> / {total}</span></div>
            <div className="mt-10 grid grid-cols-2 gap-3"><button className="btn btn-line" onClick={() => { setI(0); setRight(0); setTotal(0); setVals({}); setV(null); }}>Làm lại</button><Link to="/practice/gaps" className="btn btn-primary">Bài khác</Link></div>
          </div>
        ) : seg && plan && (
          <div className="mt-10">
            <SpeedPick speed={speed} setSpeed={setSpeed} />
            {seg.speaker && <Kicker className="mt-8 text-center">{seg.speaker}</Kicker>}
            <div className="mt-6"><PlayLine trackId={track.id} seg={seg} speed={speed} /></div>
            <p className="t-fr mt-10 leading-[2.3]">
              {plan.parts.map((p, k) => plan.gaps.includes(k) ? (
                <span key={k}>{p.match(/^[^\p{L}]+/u)?.[0]}<GapInput value={vals[k] ?? ''} onChange={(x) => setVals({ ...vals, [k]: x })} expected={core(p)} width={5}
                  state={v ? (v[k] === 'exact' ? 'ok' : v[k] === 'accent' ? 'accent' : 'bad') : null} />{p.match(/[^\p{L}'’-]+$/u)?.[0]}</span>
              ) : <span key={k}>{p}</span>)}
            </p>
            {v && <p className="t-small mt-3 text-ink2">{seg.vi}</p>}
            {!v ? <button className="btn btn-primary mt-8 w-full" onClick={check}>Kiểm tra</button>
              : <button className="btn btn-primary mt-8 w-full" onClick={() => { setI(i + 1); setVals({}); setV(null); }}>Câu tiếp</button>}
            {v && <p className="t-meta mt-3 text-center" style={{ color: Object.values(v).every((x) => x === 'exact') ? okColor : badColor }}>{Object.values(v).filter((x) => x === 'exact').length} / {plan.gaps.length} đúng</p>}
          </div>
        )}
      </Page>
    </>
  );
}
