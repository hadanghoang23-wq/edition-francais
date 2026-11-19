import { useMemo, useState } from 'react';
import { GAP, fillsFromAnswer, gradeAnswer, type AnswerVerdict } from '../../engine/diff';
import type { Drill, Unit } from '../../engine/types';
import { Kicker, two } from '../../ui/kit';
import { badColor, CheckBar, ChoiceRow, GapInput, Mark, okColor, type ItemResult, type Report } from './parts';

/** One concrete question produced from a drill (a conjugate drill expands into one item per person). */
interface Q { kind: 'choose' | 'fill' | 'order' | 'type'; ref: string; promptVi?: string; promptFr?: string; options?: string[]; answerIdx?: number; fills?: string[]; words?: string[]; answer?: string }

export function expandDrills(unit: Unit, gid: string, drills: Drill[]): Q[] {
  const out: Q[] = [];
  drills.forEach((d, i) => {
    const ref = `drill:${gid}:${i}`;
    if (d.type === 'choose') out.push({ kind: 'choose', ref, promptVi: d.promptVi, options: d.options, answerIdx: d.answer as number });
    else if (d.type === 'gap' && d.promptFr) out.push({ kind: 'fill', ref, promptFr: d.promptFr, fills: fillsFromAnswer(d.promptFr, String(d.answer)) });
    else if (d.type === 'order') out.push({ kind: 'order', ref, words: d.words, answer: String(d.answer) });
    else if (d.type === 'transform') out.push({ kind: 'type', ref, promptFr: d.promptFr, promptVi: 'Chuyển sang câu phủ định / câu đúng', answer: String(d.answer) });
    else if (d.type === 'conjugate' && d.verb) {
      const verb = (unit.verbs ?? []).find((v) => v.infinitive === d.verb);
      verb?.present?.forEach(([person, form], pi) => {
        const isElided = /'$/.test(person) || form.startsWith("m'") || form.startsWith("t'") || form.startsWith("s'");
        out.push({ kind: 'type', ref: `verb:${d.verb}:${pi}`, promptFr: `${person} …… (${d.verb})`, promptVi: isElided ? 'Gõ dạng đầy đủ, có thể kèm đại từ phản thân' : undefined, answer: form });
      });
    }
  });
  return out;
}

const shuffle = <T,>(a: T[], seed: number) => a.map((x, i) => [x, Math.sin(seed * 9301 + i * 49297) ] as const).sort((p, q) => p[1] - q[1]).map((p) => p[0]);

export function DrillSet({ qs, tolerant, report, title }: { qs: Q[]; tolerant: boolean; report: Report; title?: string }) {
  const [sel, setSel] = useState<Record<number, number>>({});
  const [fill, setFill] = useState<Record<string, string>>({});
  const [ord, setOrd] = useState<Record<number, number[]>>({});
  const [typed, setTyped] = useState<Record<number, string>>({});
  const [verdicts, setVerdicts] = useState<Record<string, AnswerVerdict | boolean> | null>(null);
  const shuffled = useMemo(() => qs.map((q, i) => (q.words ? shuffle(q.words.map((_, k) => k), i + 3) : [])), [qs]);

  const check = () => {
    const v: Record<string, AnswerVerdict | boolean> = {};
    const res: ItemResult[] = [];
    qs.forEach((q, i) => {
      if (q.kind === 'choose') {
        const ok = sel[i] === q.answerIdx;
        v[i] = ok;
        res.push({ ref: q.ref, ok, typed: false, prompt: q.promptVi ?? '', given: q.options?.[sel[i]] ?? '', expected: q.options?.[q.answerIdx ?? 0] ?? '' });
      } else if (q.kind === 'fill') {
        let allOk = true;
        q.fills!.forEach((f, k) => { const g = gradeAnswer(fill[`${i}:${k}`] ?? '', f, tolerant); v[`${i}:${k}`] = g; if (g !== 'exact') allOk = false; });
        res.push({ ref: q.ref, ok: allOk, typed: true, prompt: q.promptFr ?? '', given: q.fills!.map((_, k) => fill[`${i}:${k}`] ?? '').join(' / '), expected: q.fills!.join(' / ') });
      } else if (q.kind === 'order') {
        const built = (ord[i] ?? []).map((k) => q.words![k]).join(' ').replace(/\s+([.?!,])/g, '$1').replace(/' /g, "'");
        const g = gradeAnswer(built, q.answer!, tolerant);
        v[i] = g;
        res.push({ ref: q.ref, ok: g === 'exact', typed: true, prompt: q.words!.join(' / '), given: built, expected: q.answer! });
      } else {
        const g = gradeAnswer(typed[i] ?? '', [q.answer!, q.answer!.replace(/^(je|tu|il\/elle|il|elle|nous|vous|ils\/elles|ils|elles)\s+/i, '')], tolerant);
        v[i] = g;
        res.push({ ref: q.ref, ok: g === 'exact', typed: true, prompt: q.promptFr ?? '', given: typed[i] ?? '', expected: q.answer! });
      }
    });
    setVerdicts(v);
    report(res.map((r, i) => ({ ...r, ref: qs[i].ref } as ItemResult & { ref: string })));
  };

  return (
    <div>
      {title && <Kicker className="mb-2">{title}</Kicker>}
      {qs.map((q, i) => {
        const checked = verdicts !== null;
        return (
          <div key={i} className="border-b border-[var(--rule)] py-5">
            <div className="flex items-start gap-4">
              <span className="t-num w-6 shrink-0 pt-1 text-[16px] text-accent">{two(i + 1)}</span>
              <div className="min-w-0 flex-1">
                {q.promptVi && <p className="t-small text-ink2">{q.promptVi}</p>}
                {q.kind === 'choose' && (
                  <div className="mt-1">{q.options!.map((o, k) => (
                    <ChoiceRow key={k} selected={sel[i] === k} state={checked ? (k === q.answerIdx ? 'ok' : sel[i] === k ? 'bad' : null) : null}
                      onClick={() => !checked && setSel({ ...sel, [i]: k })}><span className="serif text-[19px]">{o}</span></ChoiceRow>
                  ))}</div>
                )}
                {q.kind === 'fill' && (
                  <p className="t-fr-sm leading-[2.2]">
                    {q.promptFr!.split(GAP).map((part, k, arr) => (
                      <span key={k}>{part}{k < arr.length - 1 && (
                        <GapInput value={fill[`${i}:${k}`] ?? ''} onChange={(x) => setFill({ ...fill, [`${i}:${k}`]: x })}
                          state={checked ? (verdicts![`${i}:${k}`] === 'exact' ? 'ok' : verdicts![`${i}:${k}`] === 'accent' ? 'accent' : 'bad') : null} expected={q.fills![k]} />
                      )}</span>
                    ))}
                  </p>
                )}
                {q.kind === 'order' && (
                  <>
                    <p className="t-fr-sm min-h-[32px]" style={{ color: checked ? (verdicts![i] === 'exact' ? okColor : badColor) : undefined }}>
                      {(ord[i] ?? []).map((k) => q.words![k]).join(' ') || <span className="t-meta">Chạm các từ theo đúng thứ tự…</span>}
                    </p>
                    {!checked && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {shuffled[i].map((k) => {
                          const used = (ord[i] ?? []).includes(k);
                          return <button key={k} disabled={used} onClick={() => setOrd({ ...ord, [i]: [...(ord[i] ?? []), k] })}
                            className="serif min-h-[40px] px-2.5 text-[18px] disabled:opacity-25" style={{ boxShadow: 'inset 0 -1px 0 var(--rule-strong)' }}>{q.words![k]}</button>;
                        })}
                        {(ord[i] ?? []).length > 0 && <button className="t-label min-h-[40px] px-2" onClick={() => setOrd({ ...ord, [i]: (ord[i] ?? []).slice(0, -1) })}>Xoá</button>}
                      </div>
                    )}
                    {checked && verdicts![i] !== 'exact' && <p className="t-small mt-1" style={{ color: okColor }}>{q.answer}</p>}
                  </>
                )}
                {q.kind === 'type' && (
                  <>
                    <p className="t-fr-sm">{q.promptFr}</p>
                    <input value={typed[i] ?? ''} onChange={(e) => setTyped({ ...typed, [i]: e.target.value })} disabled={checked}
                      autoCapitalize="off" autoCorrect="off" spellCheck={false} aria-label="Câu trả lời"
                      className="serif mt-2 w-full border-b bg-transparent py-2 text-[19px] outline-none"
                      style={{ borderColor: checked ? (verdicts![i] === 'exact' ? okColor : badColor) : 'var(--rule-strong)', color: checked ? (verdicts![i] === 'exact' ? okColor : badColor) : undefined }} />
                    {checked && verdicts![i] !== 'exact' && <p className="t-small mt-1" style={{ color: okColor }}>{q.answer}{verdicts![i] === 'accent' ? ' · chỉ sai dấu' : ''}</p>}
                  </>
                )}
              </div>
              {checked && q.kind !== 'choose' && q.kind !== 'fill' && <span style={{ color: verdicts![i] === 'exact' ? okColor : badColor }}><Mark ok={verdicts![i] === 'exact'} /></span>}
            </div>
          </div>
        );
      })}
      <CheckBar checked={verdicts !== null} onCheck={check} />
    </div>
  );
}
