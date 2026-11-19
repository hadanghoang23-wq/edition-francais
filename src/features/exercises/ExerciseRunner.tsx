import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../../engine/db';
import { diffWords, fillsFromAnswer, GAP, gradeAnswer, scoreDiff, stripAccents, type AnswerVerdict, type DiffOp } from '../../engine/diff';
import { logError, markCorrect } from '../../engine/errors';
import { ageOn, frNumber } from '../../engine/numbers';
import type { Exercise, Unit } from '../../engine/types';
import { Kicker } from '../../ui/kit';
import { Icon } from '../../ui/icons';
import { DrillSet, expandDrills } from './Drills';
import { badColor, CheckBar, Chips, ChoiceRow, GapInput, okColor, ScoreLine, SegButton, TrackBar, type ItemResult, type Report } from './parts';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

const label = (x: Any): string => (typeof x === 'string' ? x : x.fr ?? x.labelVi ?? x.key);
const val = (x: Any): string => (typeof x === 'string' ? x : x.key ?? x.fr);

export const TYPED_TYPES = new Set(['gap', 'table', 'dictation', 'anagram', 'computed-age', 'transform', 'order']);
export const SCORED_TYPES = new Set(['mcq', 'mcq-multi', 'mcq-multi-select', 'match', 'classify', 'gap', 'table', 'dictation', 'number', 'select', 'anagram', 'computed-age', 'order', 'transform', 'wordsearch', 'open', 'oral', 'listen']);

export default function ExerciseRunner({ unit, ex, onNext }: { unit: Unit; ex: Exercise; onNext?: () => void }) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);
  const [tolerant, setTolerant] = useState(false);
  const isTyped = TYPED_TYPES.has(ex.type) || !!ex.drillRef;

  const report: Report = async (items) => {
    const total = items.length;
    const score = items.filter((r) => r.ok).length;
    setResult({ score, total });
    const prev = await db.exerciseResults.get(ex.id);
    const pct = total ? score / total : 1;
    await db.exerciseResults.put({ id: ex.id, unitId: unit.id, skill: ex.skill, best: Math.max(prev?.best ?? 0, pct), last: pct, attempts: (prev?.attempts ?? 0) + 1, updatedAt: new Date() });
    for (const [i, r] of items.entries()) {
      const ref = (r as Any).ref ?? (r.typed ? `ex:${unit.id}:${ex.id}:${i}` : `ex-choice:${unit.id}:${ex.id}`);
      if (r.ok) await markCorrect(ref);
      else await logError({ source: ex.skill.startsWith('gram') || (r as Any).ref?.startsWith('drill') || (r as Any).ref?.startsWith('verb') ? 'grammar' : 'exercise', prompt: r.prompt, given: r.given, expected: r.expected, ref, hint: ex.instructionVi });
    }
  };

  const body = (() => {
    const props = { ex, unit, report, tolerant };
    if (ex.needsDvd) return <p className="t-body text-ink2">Bài này cần video DVD (chưa có trong thư mục của bạn). Đáp án đã được lưu sẵn để dùng khi bạn thêm video.</p>;
    if (ex.drillRef) {
      const g = unit.grammar.find((x) => x.id === ex.drillRef);
      if (!g) return null;
      const want = ex.type === 'order' ? ['order'] : ex.type === 'transform' ? ['transform'] : ['gap'];
      return <DrillSet qs={expandDrills(unit, g.id, g.drills.filter((d) => want.includes(d.type)))} tolerant={tolerant} report={report} />;
    }
    switch (ex.type) {
      case 'mcq': return <Mcq {...props} />;
      case 'mcq-multi-select': return <Mcq {...props} multi />;
      case 'mcq-multi': return <McqMulti {...props} />;
      case 'match': return <Match {...props} />;
      case 'classify': return <Classify {...props} />;
      case 'gap': return <Gap {...props} />;
      case 'table': return <Table {...props} />;
      case 'dictation': return <Dictation {...props} />;
      case 'number': return <NumberEx {...props} />;
      case 'select': return <SelectEx {...props} />;
      case 'anagram': return <Anagram {...props} />;
      case 'computed-age': return <Ages {...props} />;
      case 'wordsearch': return <WordSearch {...props} />;
      case 'writing': return <p className="t-body text-ink2">Phần viết (có sửa bài bằng AI) sẽ có ở giai đoạn 3.</p>;
      default: return <SelfMark {...props} />;
    }
  })();

  return (
    <div>
      <div className="flex items-baseline gap-3">
        <span className="t-num text-[22px] text-accent">{ex.number}</span>
        <Kicker className="flex-1">p. {ex.printedPage}</Kicker>
        {isTyped && <button className="t-label flex min-h-[44px] items-center gap-2" onClick={() => setTolerant(!tolerant)} aria-pressed={tolerant}>
          <span className="h-3 w-3 rounded-full" style={{ border: '1px solid currentColor', background: tolerant ? 'currentColor' : 'transparent' }} />Chấp nhận thiếu dấu
        </button>}
      </div>
      <p className="t-fr mt-2">{ex.instructionFr}</p>
      <p className="t-small mt-1 text-ink2">{ex.instructionVi}</p>
      {ex.trackId && <div className="mt-6"><TrackBar trackId={ex.trackId} /></div>}
      <div className="mt-6" key={attempt}>{body}</div>
      {result && (
        <>
          <ScoreLine score={result.score} total={result.total} />
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button className="btn btn-line" onClick={() => { setResult(null); setAttempt((a) => a + 1); }}>Làm lại</button>
            {onNext ? <button className="btn btn-primary" onClick={onNext}>Bài tiếp</button> : <Link className="btn btn-primary" to="/practice">Xong</Link>}
          </div>
        </>
      )}
    </div>
  );
}

interface P { ex: Exercise; unit: Unit; report: Report; tolerant: boolean; multi?: boolean }

function Mcq({ ex, report, multi }: P) {
  const opts = ex.options as string[];
  const ans = ex.answers as number[];
  const [sel, setSel] = useState<number[]>([]);
  const [done, setDone] = useState(false);
  return (
    <>
      {opts.map((o, k) => (
        <ChoiceRow key={k} selected={sel.includes(k)} state={done ? (ans.includes(k) ? 'ok' : sel.includes(k) ? 'bad' : null) : null}
          onClick={() => !done && setSel(multi ? (sel.includes(k) ? sel.filter((x) => x !== k) : [...sel, k]) : [k])}>
          <span className="serif text-[19px]">{o}</span>
        </ChoiceRow>
      ))}
      <CheckBar checked={done} disabled={!sel.length} onCheck={() => {
        setDone(true);
        const ok = sel.length === ans.length && ans.every((a) => sel.includes(a));
        report([{ ok, typed: false, prompt: ex.instructionFr, given: sel.map((k) => opts[k]).join(' · '), expected: ans.map((k) => opts[k]).join(' · ') }]);
      }} />
    </>
  );
}

function McqMulti({ ex, report }: P) {
  const items = ex.items as Any[];
  const ans = ex.answers as Record<string, number>;
  const [sel, setSel] = useState<Record<string, number>>({});
  const [done, setDone] = useState(false);
  return (
    <>
      {items.map((it) => (
        <div key={it.key} className="border-b border-[var(--rule)] py-4">
          <div className="flex gap-3"><span className="t-num text-[16px] text-accent">{it.key}</span>{it.fr && <span className="t-fr-sm">{it.fr}</span>}</div>
          <div className="mt-2"><Chips options={it.options.map((o: string, k: number) => ({ v: String(k), label: <span className="serif text-[18px]">{o}</span> }))}
            value={sel[it.key] !== undefined ? [String(sel[it.key])] : []} onToggle={(v) => !done && setSel({ ...sel, [it.key]: Number(v) })}
            disabled={done} correct={done ? [String(ans[it.key])] : null} /></div>
        </div>
      ))}
      <CheckBar checked={done} onCheck={() => {
        setDone(true);
        report(items.map((it) => ({ ok: sel[it.key] === ans[it.key], typed: false, prompt: `${it.key} ${it.fr ?? ''}`, given: it.options[sel[it.key]] ?? '', expected: it.options[ans[it.key]] })));
      }} />
    </>
  );
}

function Match({ ex, report }: P) {
  const left = (ex.items as Any).left as Any[];
  const right = (ex.items as Any).right as Any[];
  const ans = ex.answers as Record<string, string | string[]>;
  const multi = Object.values(ans).some(Array.isArray);
  const [sel, setSel] = useState<Record<string, string[]>>({});
  const [done, setDone] = useState(false);
  const want = (k: string) => [ans[k]].flat().map(String);
  return (
    <>
      {left.map((l) => (
        <div key={l.key} className="border-b border-[var(--rule)] py-4">
          <div className="flex items-center gap-3">
            <span className="t-num text-[16px] text-accent">{l.key}</span>
            {l.segIdx !== undefined && ex.trackId && <SegButton trackId={ex.trackId} segIdx={l.segIdx} />}
            <span className={l.fr ? 't-fr-sm' : 't-small text-ink2'}>{l.fr ?? l.labelVi ?? ''}</span>
          </div>
          <div className="mt-2"><Chips multi={multi} disabled={done}
            options={right.map((r) => ({ v: val(r), label: <span className={typeof r === 'string' || r.fr ? 'serif text-[18px]' : 'text-[14px]'}>{typeof r === 'string' ? r : r.fr ?? r.labelVi ?? r.key}</span> }))}
            value={sel[l.key] ?? []} correct={done ? want(l.key) : null}
            onToggle={(v) => { const cur = sel[l.key] ?? []; setSel({ ...sel, [l.key]: multi ? (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]) : [v] }); }} /></div>
        </div>
      ))}
      <CheckBar checked={done} onCheck={() => {
        setDone(true);
        report(left.map((l) => {
          const w = want(l.key), s = sel[l.key] ?? [];
          return { ok: w.length === s.length && w.every((x) => s.includes(x)), typed: false, prompt: `${l.key} ${l.fr ?? l.labelVi ?? ''}`, given: s.map((x) => label(right.find((r) => val(r) === x) ?? x)).join(', '), expected: w.map((x) => label(right.find((r) => val(r) === x) ?? x)).join(', ') };
        }));
      }} />
    </>
  );
}

function Classify({ ex, report }: P) {
  const items = ex.items as Any[];
  const cats = ex.categories as string[];
  const ans = ex.answers as Record<string, string[]>;
  const id = (it: Any) => it.key ?? it.fr;
  const want = (it: Any) => cats.filter((c) => (ans[c] ?? []).includes(id(it)));
  const [sel, setSel] = useState<Record<string, string[]>>({});
  const [done, setDone] = useState(false);
  return (
    <>
      {items.map((it) => (
        <div key={id(it)} className="flex flex-wrap items-center gap-3 border-b border-[var(--rule)] py-3">
          {it.segIdx !== undefined && ex.trackId && <SegButton trackId={ex.trackId} segIdx={it.segIdx} label={it.key} />}
          {it.fr && <span className="t-fr-sm min-w-[7rem]">{it.key ? <span className="t-num mr-2 text-accent">{it.key}</span> : null}{it.fr}</span>}
          <div className="ml-auto"><Chips multi disabled={done} options={cats.map((c) => ({ v: c, label: c }))} value={sel[id(it)] ?? []} correct={done ? want(it) : null}
            onToggle={(v) => { const cur = sel[id(it)] ?? []; setSel({ ...sel, [id(it)]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] }); }} /></div>
        </div>
      ))}
      <CheckBar checked={done} onCheck={() => {
        setDone(true);
        report(items.map((it) => { const w = want(it), s = sel[id(it)] ?? []; return { ok: w.length === s.length && w.every((x) => s.includes(x)), typed: false, prompt: it.fr ?? it.key, given: s.join(', '), expected: w.join(', ') }; }));
      }} />
    </>
  );
}

function expectedFills(ex: Exercise, it: Any, i: number): string[] {
  const a = ex.answers as Any;
  const raw = Array.isArray(a) ? a[i] : a?.[it.key];
  if (Array.isArray(raw)) return raw.map(String);
  return fillsFromAnswer(it.fr, String(raw ?? ''));
}

function Gap({ ex, report, tolerant }: P) {
  const items = (ex.items as Any[]) ?? [];
  const [vals, setVals] = useState<Record<string, string>>({});
  const [v, setV] = useState<Record<string, AnswerVerdict> | null>(null);
  const fills = useMemo(() => items.map((it, i) => expectedFills(ex, it, i)), [ex, items]);
  const firstEmpty = () => { for (let i = 0; i < items.length; i++) for (let k = 0; k < fills[i].length; k++) if (!vals[`${i}:${k}`]) return `${i}:${k}`; return null; };
  return (
    <>
      {Array.isArray(ex.options) && (
        <div className="mb-4"><Kicker>Gợi ý · chạm để điền</Kicker>
          <div className="mt-2 flex flex-wrap gap-x-4">{(ex.options as string[]).map((o) => (
            <button key={o} disabled={!!v} className="serif min-h-[40px] text-[18px] text-ink2" onClick={() => { const k = firstEmpty(); if (k) setVals({ ...vals, [k]: o }); }}>{o}</button>
          ))}</div>
        </div>
      )}
      {items.map((it, i) => (
        <div key={i} className="flex items-start gap-3 border-b border-[var(--rule)] py-4">
          <span className="t-num w-5 shrink-0 pt-1 text-[16px] text-accent">{it.key ?? i + 1}</span>
          <div className="min-w-0 flex-1">
            {it.labelVi && <p className="t-meta">{it.labelVi}</p>}
            <p className="t-fr-sm leading-[2.2]">
              {String(it.fr).split(GAP).map((part: string, k: number, arr: string[]) => (
                <span key={k}>{part}{k < arr.length - 1 && (
                  <GapInput value={vals[`${i}:${k}`] ?? ''} onChange={(x) => setVals({ ...vals, [`${i}:${k}`]: x })} expected={fills[i][k]}
                    state={v ? (v[`${i}:${k}`] === 'exact' ? 'ok' : v[`${i}:${k}`] === 'accent' ? 'accent' : 'bad') : null} />
                )}</span>
              ))}
            </p>
          </div>
          {it.segIdx !== undefined && ex.trackId && <SegButton trackId={ex.trackId} segIdx={it.segIdx} />}
        </div>
      ))}
      <CheckBar checked={!!v} onCheck={() => {
        const out: Record<string, AnswerVerdict> = {};
        const res: ItemResult[] = items.map((it, i) => {
          let ok = true;
          fills[i].forEach((f, k) => { const g = gradeAnswer(vals[`${i}:${k}`] ?? '', f.split(/\s+ou\s+/), tolerant); out[`${i}:${k}`] = g; if (g !== 'exact') ok = false; });
          return { ok, typed: true, prompt: it.fr, given: fills[i].map((_, k) => vals[`${i}:${k}`] ?? '').join(' / '), expected: fills[i].join(' / ') };
        });
        setV(out);
        report(res);
      }} />
    </>
  );
}

function tableAlternatives(expected: string): string[] {
  const noParen = expected.replace(/\s*\(.*?\)\s*/g, ' ').trim();
  const noPrep = noParen.replace(/^(à|au|aux|en)\s+/i, '');
  return [...new Set([expected, noParen, noPrep])];
}

function Table({ ex, report, tolerant }: P) {
  const cols = ex.columns as string[];
  const rows = ex.rows as string[];
  const ans = ex.answers as Record<string, (string | null)[]>;
  const [vals, setVals] = useState<Record<string, string>>({});
  const [v, setV] = useState<Record<string, boolean> | null>(null);
  return (
    <>
      {rows.map((r) => (
        <div key={r} className="border-b border-[var(--rule)] py-4">
          <div className="serif text-[19px]">{r}</div>
          <div className="mt-2 grid gap-3" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0,1fr))` }}>
            {cols.map((c, ci) => {
              const exp = ans[r]?.[ci];
              const key = `${r}:${ci}`;
              return (
                <label key={c} className="block">
                  <span className="t-label !text-[10px]">{c}</span>
                  {exp === null || exp === undefined ? <div className="t-meta py-2">—</div> : (
                    <>
                      <input value={vals[key] ?? ''} onChange={(e) => setVals({ ...vals, [key]: e.target.value })} disabled={!!v} autoCapitalize="off" autoCorrect="off"
                        className="serif w-full border-b bg-transparent py-1.5 text-[17px] outline-none"
                        style={{ borderColor: v ? (v[key] ? okColor : badColor) : 'var(--rule-strong)', color: v ? (v[key] ? okColor : badColor) : undefined }} />
                      {v && !v[key] && <span className="t-meta !text-[12px]" style={{ color: okColor }}>{exp}</span>}
                    </>
                  )}
                </label>
              );
            })}
          </div>
        </div>
      ))}
      <CheckBar checked={!!v} onCheck={() => {
        const out: Record<string, boolean> = {};
        const res: ItemResult[] = [];
        rows.forEach((r) => cols.forEach((c, ci) => {
          const exp = ans[r]?.[ci];
          if (exp === null || exp === undefined) return;
          const key = `${r}:${ci}`;
          const ok = gradeAnswer(vals[key] ?? '', tableAlternatives(exp), tolerant) === 'exact';
          out[key] = ok;
          res.push({ ok, typed: true, prompt: `${r} — ${c}`, given: vals[key] ?? '', expected: exp });
        }));
        setV(out);
        report(res);
      }} />
    </>
  );
}

export function DiffView({ ops }: { ops: DiffOp[] }) {
  const col: Record<DiffOp['type'], string> = { ok: 'var(--ink)', accent: 'var(--gold)', spelling: badColor, wrong: badColor, missing: badColor, extra: 'var(--faint)' };
  return (
    <p className="t-fr-sm leading-[2]">
      {ops.map((o, i) => (
        <span key={i} className="mr-1.5 inline-flex flex-col align-top" style={{ color: col[o.type] }}>
          <span style={{ textDecoration: o.type === 'extra' ? 'line-through' : o.type === 'missing' ? 'underline dotted' : undefined }}>{o.type === 'extra' ? o.given : o.expected}</span>
          {(o.type === 'accent' || o.type === 'spelling' || o.type === 'wrong') && <span className="t-meta !text-[11px] line-through">{o.given}</span>}
        </span>
      ))}
    </p>
  );
}

export function DiffLegend() {
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
      <span className="t-label" style={{ color: 'var(--gold)' }}>sai dấu</span>
      <span className="t-label" style={{ color: badColor }}>sai chính tả / thiếu</span>
      <span className="t-label" style={{ color: 'var(--faint)' }}>thừa</span>
    </div>
  );
}

function Dictation({ ex, report, tolerant }: P) {
  const items = ex.items as Any[];
  const ans = ex.answers as Record<string, string>;
  const [vals, setVals] = useState<Record<string, string>>({});
  const [ops, setOps] = useState<Record<string, DiffOp[]> | null>(null);
  return (
    <>
      {items.map((it) => (
        <div key={it.key} className="border-b border-[var(--rule)] py-4">
          <div className="flex items-center gap-3"><span className="t-num text-[16px] text-accent">{it.key}</span>{ex.trackId && <SegButton trackId={ex.trackId} segIdx={it.segIdx} label="Nghe" />}</div>
          {!ops ? (
            <input value={vals[it.key] ?? ''} onChange={(e) => setVals({ ...vals, [it.key]: e.target.value })} autoCapitalize="off" autoCorrect="off" spellCheck={false}
              aria-label="Viết những gì bạn nghe" className="serif mt-2 w-full border-b border-[var(--rule-strong)] bg-transparent py-2 text-[20px] outline-none focus:border-[var(--ink)]" />
          ) : <div className="mt-2"><DiffView ops={ops[it.key]} /></div>}
        </div>
      ))}
      {ops && <DiffLegend />}
      <CheckBar checked={!!ops} onCheck={() => {
        const o: Record<string, DiffOp[]> = {};
        const res = items.map((it) => { o[it.key] = diffWords(vals[it.key] ?? '', ans[it.key]); return { ok: scoreDiff(o[it.key], tolerant).score >= 0.999, typed: true, prompt: `Dictée ${it.key}`, given: vals[it.key] ?? '', expected: ans[it.key] }; });
        setOps(o);
        report(res);
      }} />
    </>
  );
}

function NumberEx({ ex, report }: P) {
  const items = ex.items as Any[];
  const ans = ex.answers as Record<string, number>;
  const [vals, setVals] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  return (
    <>
      {items.map((it) => {
        const ok = Number(vals[it.key]) === ans[it.key];
        return (
          <div key={it.key} className="flex items-center gap-3 border-b border-[var(--rule)] py-3">
            <span className="t-num w-5 text-[16px] text-accent">{it.key}</span>
            {ex.trackId && <SegButton trackId={ex.trackId} segIdx={it.segIdx} />}
            <input inputMode="numeric" value={vals[it.key] ?? ''} disabled={done} onChange={(e) => setVals({ ...vals, [it.key]: e.target.value.replace(/\D/g, '') })}
              aria-label="Số" className="t-num ml-auto w-16 border-b bg-transparent py-1 text-center text-[24px] outline-none"
              style={{ borderColor: done ? (ok ? okColor : badColor) : 'var(--rule-strong)', color: done ? (ok ? okColor : badColor) : undefined }} />
            {done && !ok && <span className="t-num text-[20px]" style={{ color: okColor }}>{ans[it.key]}</span>}
          </div>
        );
      })}
      <CheckBar checked={done} onCheck={() => { setDone(true); report(items.map((it) => ({ ok: Number(vals[it.key]) === ans[it.key], typed: false, prompt: `${ex.instructionFr} (${it.key})`, given: vals[it.key] ?? '', expected: String(ans[it.key]) }))); }} />
    </>
  );
}

function SelectEx({ ex, report }: P) {
  const opts = ex.options as string[];
  const ans = ex.answers as string[];
  const [sel, setSel] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  return (
    <>
      <div className="grid grid-cols-4 border-t border-[var(--rule)]">
        {opts.map((o, i) => {
          const on = sel.includes(o);
          const color = done ? (ans.includes(o) ? okColor : on ? badColor : 'var(--faint)') : on ? 'var(--accent)' : 'var(--ink)';
          return <button key={o} disabled={done} onClick={() => setSel(on ? sel.filter((x) => x !== o) : [...sel, o])}
            className={`t-num flex h-16 items-center justify-center border-b border-[var(--rule)] text-[24px] ${i % 4 ? 'border-l' : ''}`}
            style={{ color, background: on && !done ? 'var(--accent-soft)' : undefined }}>{o}</button>;
        })}
      </div>
      <CheckBar checked={done} onCheck={() => {
        setDone(true);
        report(opts.map((o) => ({ ok: ans.includes(o) === sel.includes(o), typed: false, prompt: `${ex.instructionFr}: ${o}`, given: sel.includes(o) ? 'chọn' : 'không', expected: ans.includes(o) ? 'chọn' : 'không' })));
      }} />
    </>
  );
}

function Anagram({ ex, report }: P) {
  const items = ex.items as Any[];
  const ans = ex.answers as string[];
  const [vals, setVals] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const ok = (i: number) => stripAccents((vals[i] ?? '').toUpperCase().trim()) === stripAccents(ans[i].toUpperCase());
  return (
    <>
      {ex.example && <p className="t-meta mb-3">Ví dụ: {(ex.example as Any).scrambled} → {(ex.example as Any).answer}</p>}
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-[var(--rule)] py-3">
          <span className="t-label w-28 !text-ink2 !tracking-[0.25em]">{it.scrambled}</span>
          <input value={vals[i] ?? ''} disabled={done} onChange={(e) => { const c = [...vals]; c[i] = e.target.value; setVals(c); }} autoCapitalize="characters" autoCorrect="off"
            className="serif flex-1 border-b bg-transparent py-1 text-[19px] tracking-[0.12em] outline-none"
            style={{ borderColor: done ? (ok(i) ? okColor : badColor) : 'var(--rule-strong)', color: done ? (ok(i) ? okColor : badColor) : undefined }} />
          {done && !ok(i) && <span className="serif text-[17px]" style={{ color: okColor }}>{ans[i]}</span>}
        </div>
      ))}
      <CheckBar checked={done} onCheck={() => { setDone(true); report(items.map((it, i) => ({ ok: ok(i), typed: true, prompt: it.scrambled, given: vals[i] ?? '', expected: ans[i] }))); }} />
    </>
  );
}

function Ages({ ex, report, tolerant }: P) {
  const items = ex.items as Any[];
  const [vals, setVals] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const exp = items.map((it) => ageOn(it.born));
  const ok = (i: number) => gradeAnswer(vals[i] ?? '', [String(exp[i]), frNumber(exp[i]), `${frNumber(exp[i])} ans`, `${exp[i]} ans`], tolerant) === 'exact';
  return (
    <>
      {items.map((it, i) => (
        <div key={it.name} className="border-b border-[var(--rule)] py-3">
          <div className="flex items-baseline justify-between"><span className="serif text-[19px]">{it.name}</span><span className="t-meta">{new Date(it.born).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
          <div className="mt-1 flex items-center gap-2">
            <input value={vals[i] ?? ''} disabled={done} onChange={(e) => { const c = [...vals]; c[i] = e.target.value; setVals(c); }} placeholder="… ans, viết bằng chữ" autoCapitalize="off"
              className="serif flex-1 border-b bg-transparent py-1 text-[18px] outline-none placeholder:text-faint" style={{ borderColor: done ? (ok(i) ? okColor : badColor) : 'var(--rule-strong)' }} />
            {done && <span className="serif text-[17px]" style={{ color: ok(i) ? okColor : badColor }}>{frNumber(exp[i])} ans</span>}
          </div>
        </div>
      ))}
      <CheckBar checked={done} onCheck={() => { setDone(true); report(items.map((it, i) => ({ ok: ok(i), typed: true, prompt: `${it.name} (${it.born})`, given: vals[i] ?? '', expected: `${frNumber(exp[i])} ans` }))); }} />
    </>
  );
}

function WordSearch({ ex, report }: P) {
  const grid = ex.grid as string[];
  const words = ex.answers as string[];
  const [start, setStart] = useState<[number, number] | null>(null);
  const [found, setFound] = useState<{ w: string; cells: string[] }[]>([]);
  const [done, setDone] = useState(false);
  const foundCells = new Set(found.flatMap((f) => f.cells));
  const tap = (r: number, c: number) => {
    if (done) return;
    if (!start) { setStart([r, c]); return; }
    const [r0, c0] = start;
    setStart(null);
    const dr = Math.sign(r - r0), dc = Math.sign(c - c0);
    const len = Math.max(Math.abs(r - r0), Math.abs(c - c0)) + 1;
    if (!(r === r0 || c === c0 || Math.abs(r - r0) === Math.abs(c - c0))) return;
    const cells: string[] = []; let s = '';
    for (let k = 0; k < len; k++) { const rr = r0 + dr * k, cc = c0 + dc * k; s += grid[rr][cc]; cells.push(`${rr}:${cc}`); }
    const w = words.find((x) => (x === s || x === [...s].reverse().join('')) && !found.some((f) => f.w === x));
    if (w) setFound([...found, { w, cells }]);
  };
  return (
    <>
      <div className="grid gap-px border border-[var(--rule)] bg-[var(--rule)]" style={{ gridTemplateColumns: `repeat(${grid[0].length}, minmax(0,1fr))` }}>
        {grid.map((row, r) => [...row].map((ch, c) => {
          const k = `${r}:${c}`;
          const on = foundCells.has(k), st = start && start[0] === r && start[1] === c;
          return <button key={k} onClick={() => tap(r, c)} className="serif flex aspect-square items-center justify-center text-[17px]"
            style={{ background: st ? 'var(--accent-soft)' : 'var(--paper)', color: on ? 'var(--accent)' : 'var(--ink)', fontWeight: on ? 700 : undefined }}>{ch}</button>;
        }))}
      </div>
      <p className="t-meta mt-3">Chạm chữ đầu rồi chữ cuối của một từ. Đã tìm: {found.length} / {words.length}</p>
      <div className="mt-2 flex flex-wrap gap-x-4">{words.map((w) => <span key={w} className="t-label" style={{ color: found.some((f) => f.w === w) ? 'var(--accent)' : undefined }}>{w}</span>)}</div>
      <CheckBar checked={done} label={found.length === words.length ? 'Hoàn thành' : 'Kết thúc'} onCheck={() => { setDone(true); report(words.map((w) => ({ ok: found.some((f) => f.w === w), typed: false, prompt: 'Mots mêlés', given: '', expected: w }))); }} />
    </>
  );
}

function SelfMark({ ex, report }: P) {
  const [shown, setShown] = useState(false);
  const [done, setDone] = useState(false);
  const a = ex.answers as Any;
  const text = a?.text ?? a?.example ?? (ex as Any).example;
  return (
    <>
      {ex.type === 'oral' && <p className="t-small text-ink2">Nói to câu trả lời của bạn (có thể ghi âm trong Studio), rồi tự đánh giá.</p>}
      {ex.type === 'listen' && <p className="t-small text-ink2">Nghe bài vài lần, rồi đánh dấu đã xong.</p>}
      {text && (shown
        ? <div className="mt-4 border-t border-[var(--rule)] pt-3"><Kicker>{a?.text ? 'Đáp án (sách giáo viên)' : 'Ví dụ'}</Kicker><p className="t-fr-sm mt-1">{text}</p></div>
        : <button className="btn btn-text mt-2 !px-0" onClick={() => setShown(true)}><Icon name="forward" size={14} />Xem {a?.text ? 'đáp án' : 'ví dụ'}</button>)}
      {!done && (
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button className="btn btn-line" onClick={() => { setDone(true); report([{ ok: false, typed: false, prompt: ex.instructionFr, given: 'chưa', expected: text ?? '' }]); }}>Chưa ổn</button>
          <button className="btn btn-primary" onClick={() => { setDone(true); report([{ ok: true, typed: false, prompt: ex.instructionFr, given: 'ổn', expected: text ?? '' }]); }}>{ex.type === 'listen' ? 'Đã nghe' : 'Tôi làm được'}</button>
        </div>
      )}
    </>
  );
}
