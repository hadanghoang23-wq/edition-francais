import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { bumpStat, db, type DraftRow } from '../../engine/db';
import { useUnit, useUnits } from '../../engine/content';
import { logError } from '../../engine/errors';
import { buildLookup } from '../../engine/lookup';
import { lintFrench, targetWords, wordCount, type LintHit } from '../../engine/lint';
import { AI_MODELS, ISSUE_VI, getAiConfig } from '../../engine/aiConfig';
import type { CorrectionT } from '../../engine/ai';
import type { Exercise, Unit } from '../../engine/types';
import { Empty, ErrorNote, Kicker, Loading, Page, Row, Section, Toast, TopBar, two } from '../../ui/kit';
import { Icon } from '../../ui/icons';
import { AudioChip } from '../shared/AudioChip';
import { AccentBar } from '../listen/Listening';
import { badColor, okColor } from '../exercises/parts';

const writingTasks = (u: Unit) => u.tasks.filter((t) => t.kind === 'writing');
const exerciseFor = (u: Unit, taskId: string) => u.exercises.find((e) => (e as { taskId?: string }).taskId === taskId) as (Exercise & { fields?: string[]; answers: { example?: string } | null; answerSource?: string }) | undefined;
const hash = (s: string) => { let h = 5381; for (const ch of s) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0; return h.toString(36); };

/** Writing tab: the book's writing tasks unit by unit, plus free writing. */
export function WriteHome() {
  const units = useUnits();
  const drafts = useLiveQuery(() => db.drafts.orderBy('updatedAt').reverse().toArray(), []);
  const ai = useLiveQuery(() => getAiConfig(), []);
  const nav = useNavigate();
  if (!units || !drafts || !ai) return <Loading />;
  const byId = new Map(drafts.map((d) => [d.id, d]));
  const free = drafts.filter((d) => d.id.startsWith('free:'));
  const newFree = async () => {
    const id = `free:${Date.now().toString(36)}`;
    await db.drafts.put({ id, unitId: null, taskId: null, title: 'Viết tự do', text: '', updatedAt: new Date(), versions: [] });
    nav(`/write/free/${id}`);
  };
  const status = (d?: DraftRow) => !d ? 'chưa viết' : `${wordCount(d.text)} từ${d.versions.length ? ` · đã chữa ${d.versions.length} lần` : ''}`;
  return (
    <>
      <TopBar back="/practice" kicker="Production écrite" title="Viết" />
      <Page>
        <h1 className="t-hero mt-10">Écrire</h1>
        <p className="t-body measure mt-4 text-ink2">Bài viết của sách, có thanh gõ dấu và phần tự kiểm tra lỗi thường gặp (không cần mạng).{ai.enabled ? ' Có thể gửi cho Claude để chữa chi tiết, giải thích bằng tiếng Việt.' : ''}</p>
        <Link to="/settings" className="mt-6 flex items-center gap-3 border-y border-[var(--rule)] py-4">
          <Icon name="sparkle" size={18} className={ai.enabled ? 'text-accent' : 'text-faint'} />
          <span className="t-small flex-1 text-ink2">{ai.enabled ? `Chữa bài bằng AI: bật · ${AI_MODELS.find((m) => m.id === ai.model)?.label ?? ai.model}` : 'Chữa bài bằng AI: tắt — thêm API key trong Réglages (không bắt buộc)'}</span>
          <Icon name="arrow" size={16} className="text-muted" />
        </Link>

        {units.length === 0 && <Empty kicker="Chưa có bài" title="Rien à écrire encore." body="Nhập gói nội dung để có đề viết của sách. Bạn vẫn có thể viết tự do." />}
        {units.filter((u) => writingTasks(u).length).map((u) => (
          <Section key={u.id} n={two(u.number)} title={<span className="serif normal-case tracking-normal text-[20px] italic text-ink">{u.title}</span>}>
            {writingTasks(u).map((t) => {
              const d = byId.get(`${u.id}:${t.id}`);
              return <Row key={t.id} to={`/write/${u.id}/${t.id}`} title={<span className="serif text-[18px]">{t.promptFr}</span>} sub={<span className="t-meta">p. {t.printedPage} · {status(d)}</span>} />;
            })}
          </Section>
        ))}

        <Section n="✎" title="Viết tự do" meta={free.length ? `${free.length}` : undefined}>
          {free.map((d) => <Row key={d.id} to={`/write/free/${d.id}`} title={<span className="serif text-[18px]">{d.text.split('\n')[0].slice(0, 60) || 'Bản nháp trống'}</span>} sub={<span className="t-meta">{d.updatedAt.toLocaleDateString('vi-VN')} · {status(d)}</span>} />)}
          <button className="btn btn-line mt-6 w-full" onClick={newFree}><Icon name="plus" size={14} />Bài mới</button>
        </Section>
      </Page>
    </>
  );
}

/** Underline spans of the text (self-check hits or AI issues). */
function Marked({ text, spans }: { text: string; spans: { start: number; end: number; color: string }[] }) {
  const out: React.ReactNode[] = [];
  let at = 0;
  spans.slice().sort((a, b) => a.start - b.start).forEach((s, i) => {
    if (s.start < at) return;
    out.push(text.slice(at, s.start));
    out.push(<span key={i} style={{ textDecoration: 'underline', textDecorationColor: s.color, textDecorationThickness: '1.5px', textUnderlineOffset: '5px', color: s.color }}>{text.slice(s.start, s.end)}</span>);
    at = s.end;
  });
  out.push(text.slice(at));
  return <p className="t-fr whitespace-pre-wrap">{out}</p>;
}

function locate(text: string, parts: string[]) {
  let from = 0;
  return parts.map((p) => {
    let i = text.indexOf(p, from);
    if (i < 0) i = text.indexOf(p);
    if (i < 0 || !p) return null;
    from = i + p.length;
    return { start: i, end: i + p.length };
  });
}

export function WriteTask() {
  const { unitId, taskId, draftId } = useParams();
  const isFree = !!draftId;
  const unit = useUnit(isFree ? undefined : unitId);
  const units = useUnits();
  const id = isFree ? draftId! : `${unitId}:${taskId}`;
  const draft = useLiveQuery(async () => (await db.drafts.get(id)) ?? null, [id]); // null = no draft yet, undefined = loading
  const ai = useLiveQuery(() => getAiConfig(), []);
  const task = unit ? unit.tasks.find((t) => t.id === taskId) : undefined;
  const ex = unit && taskId ? exerciseFor(unit, taskId) : undefined;
  const target = useMemo(() => targetWords(`${task?.promptFr ?? ''} ${ex?.instructionFr ?? ''}`), [task, ex]);

  const [text, setText] = useState<string | null>(null);
  const [hits, setHits] = useState<LintHit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fb, setFb] = useState<{ data: CorrectionT; original: string; model: string; costUsd: number } | null>(null);
  const [showModel, setShowModel] = useState(false);
  const [openVersion, setOpenVersion] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const nav = useNavigate();

  // Load the saved draft once.
  useEffect(() => { if (draft !== undefined && text === null) setText(draft?.text ?? ''); }, [draft, text]);
  // Autosave.
  useEffect(() => {
    if (text === null) return;
    const t = setTimeout(async () => {
      const prev = await db.drafts.get(id);
      if (prev?.text === text) return;
      await db.drafts.put({ id, unitId: isFree ? null : unitId ?? null, taskId: isFree ? null : taskId ?? null, title: task?.promptFr ?? prev?.title ?? 'Viết tự do', text, updatedAt: new Date(), versions: prev?.versions ?? [] });
    }, 500);
    return () => clearTimeout(t);
  }, [text, id, isFree, unitId, taskId, task]);

  if (text === null || !ai || (!isFree && unit === undefined)) return <Loading />;
  if (!isFree && (!unit || !task)) return <Loading label="Không tìm thấy đề bài" />;

  const words = wordCount(text);
  const insert = (c: string) => {
    const el = area.current;
    if (!el) { setText(text + c); return; }
    const [s, e] = [el.selectionStart, el.selectionEnd];
    const next = text.slice(0, s) + c + text.slice(e);
    setText(next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + c.length, s + c.length); });
  };

  const selfCheck = async () => {
    const map = await buildLookup();
    const lex = [...map.keys()].filter((k) => !k.startsWith('~'));
    setHits(lintFrench(text, lex));
    await bumpStat({ writing: 1 });
    setFb(null);
  };
  const applyHit = (h: LintHit) => {
    if (h.suggestion === undefined) return;
    const next = text.slice(0, h.start) + h.suggestion + text.slice(h.end);
    setText(next);
    const map = (hits ?? []).filter((x) => x !== h);
    const delta = h.suggestion.length - (h.end - h.start);
    setHits(map.map((x) => (x.start > h.start ? { ...x, start: x.start + delta, end: x.end + delta } : x)));
  };

  const correct = async () => {
    setBusy(true); setErr(null); setHits(null);
    try {
      const { correctWriting } = await import('../../engine/ai');
      const grammar = (units ?? []).filter((u) => !unit || u.number <= unit.number).flatMap((u) => u.grammar.map((g) => g.title));
      const r = await correctWriting({ text, taskFr: task?.promptFr ?? 'Texte libre (free writing).', taskVi: task?.promptVi, unitTitle: unit ? `Unité ${unit.number} « ${unit.title} »` : undefined, grammar, targetWords: target });
      setFb({ data: r.data, original: text, model: r.model, costUsd: r.costUsd });
      await bumpStat({ writing: 1 });
      const prev = await db.drafts.get(id);
      const versions = [...(prev?.versions ?? []), { at: new Date(), text, feedback: r.data, model: r.model, costUsd: r.costUsd }];
      await db.drafts.put({ id, unitId: isFree ? null : unitId ?? null, taskId: isFree ? null : taskId ?? null, title: task?.promptFr ?? 'Viết tự do', text, updatedAt: new Date(), versions });
      for (const is of r.data.issues) {
        if (!is.original.trim() || is.original === is.correction) continue;
        await logError({ source: 'writing', prompt: `Sửa: « ${is.original} »`, given: is.original, expected: is.correction, ref: `write:${hash(is.original + '→' + is.correction)}`, hint: is.explanation_vi });
      }
    } catch (e) {
      const { aiErrorVi } = await import('../../engine/ai');
      setErr(await aiErrorVi(e));
    } finally { setBusy(false); }
  };

  const lintSpans = (hits ?? []).map((h) => ({ start: h.start, end: h.end, color: h.kind === 'accent' ? 'var(--gold)' : badColor }));
  const versions = draft?.versions ?? [];

  return (
    <>
      <TopBar back="/write" kicker={unit ? `Unité ${unit.number} · Écrire` : 'Écrire'} right={task ? <span className="t-label">p. {task.printedPage}</span> : undefined} />
      <Page>
        {task ? (
          <>
            <h1 className="t-title mt-10 italic">{task.promptFr}</h1>
            <p className="t-small measure mt-3 text-ink2">{task.promptVi}</p>
          </>
        ) : <h1 className="t-display mt-10">Texte libre</h1>}
        {ex?.fields && <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1">{ex.fields.map((f) => <span key={f} className="t-label !text-ink2">{f}</span>)}</div>}

        <div className="rule mt-8" />
        <textarea ref={area} value={text} onChange={(e) => { setText(e.target.value); if (hits) setHits(null); }} rows={9} autoCapitalize="sentences" autoCorrect="off" spellCheck={false} lang="fr"
          placeholder="Bonjour ! Je m'appelle…" aria-label="Bài viết"
          className="serif mt-4 w-full resize-y bg-transparent text-[21px] leading-[1.6] outline-none placeholder:text-faint" />
        <AccentBar onInsert={insert} />
        <div className="mt-2 flex items-baseline justify-between">
          <span className="t-meta">{words} từ{target ? ` · mục tiêu ${target[0]}–${target[1]}` : ''}</span>
          {target && <span className="t-meta" style={{ color: words >= target[0] && words <= target[1] ? okColor : undefined }}>{words < target[0] ? `còn thiếu ${target[0] - words}` : words > target[1] ? `dài hơn ${words - target[1]}` : 'đủ độ dài'}</span>}
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3">
          <button className="btn btn-line" disabled={!text.trim()} onClick={selfCheck}><Icon name="check" size={14} />Tự kiểm tra</button>
          {ai.enabled
            ? <button className="btn btn-primary" disabled={!text.trim() || busy} onClick={correct}><Icon name="sparkle" size={14} />{busy ? 'Đang chữa…' : 'Chữa bằng AI'}</button>
            : <Link className="btn btn-text" to="/settings">Thêm API key</Link>}
        </div>
        {busy && <p className="t-meta mt-3 text-center">Claude đang đọc bài của bạn — thường mất 10–40 giây.</p>}
        {err && <div className="mt-6"><ErrorNote>{err}</ErrorNote></div>}

        {hits && (
          <Section title="Tự kiểm tra" meta={hits.length ? `${hits.length} chỗ` : undefined}>
            {hits.length === 0 ? <p className="t-small mt-4 text-ink2">Không thấy lỗi thường gặp (lược âm, gộp mạo từ, tuổi với avoir, dấu, viết hoa, khoảng trắng trước ? !). Phần tự kiểm tra không thay được người chữa: ngữ pháp và giống vẫn cần bạn đọc lại.</p> : (
              <>
                <div className="mt-4"><Marked text={text} spans={lintSpans} /></div>
                {hits.map((h, k) => (
                  <div key={k} className="flex items-start gap-3 border-b border-[var(--rule)] py-4">
                    <div className="min-w-0 flex-1">
                      <p className="serif text-[19px]"><span className="line-through decoration-[0.5px]" style={{ color: badColor }}>{h.text}</span>{h.suggestion !== undefined && <> → <span style={{ color: okColor }}>{h.suggestion.replace(/^ /, '␣')}</span></>}</p>
                      <p className="t-small mt-1 text-ink2">{h.vi}</p>
                    </div>
                    {h.suggestion !== undefined && <button className="t-label mt-1 min-h-[44px] shrink-0 !text-ink" onClick={() => applyHit(h)}>Sửa</button>}
                  </div>
                ))}
              </>
            )}
          </Section>
        )}

        {fb && <Feedback fb={fb} onUse={() => { setText(fb.data.corrected); setFb(null); setToast('Đã thay bằng bản đã chữa. Đọc lại và tự viết tiếp.'); }} />}

        {ex?.answers?.example && (
          <Section title="Bài mẫu">
            {showModel ? <>
              <p className="t-fr mt-4 whitespace-pre-wrap">{ex.answers.example}</p>
              <p className="t-meta mt-2">Nguồn: {ex.answerSource ?? 'sách giáo viên'}</p>
            </> : <button className="btn btn-text mt-2 !px-0" onClick={() => setShowModel(true)}>Xem bài mẫu của sách giáo viên (nên viết trước rồi mới xem)</button>}
          </Section>
        )}

        {versions.length > 0 && (
          <Section title="Các lần chữa" meta={`${versions.length}`}>
            {versions.slice().reverse().map((v, k) => {
              const idx = versions.length - 1 - k;
              const f = v.feedback as CorrectionT | undefined;
              return (
                <div key={idx} className="border-b border-[var(--rule)] py-3">
                  <button className="flex min-h-[44px] w-full items-center gap-3 text-left" onClick={() => setOpenVersion(openVersion === idx ? null : idx)}>
                    <span className="t-num w-8 text-[20px] text-muted">{two(idx + 1)}</span>
                    <span className="t-small flex-1">{new Date(v.at).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })} · {wordCount(v.text)} từ · {f ? `${f.issues.length} lỗi` : '—'}</span>
                    <Icon name={openVersion === idx ? 'close' : 'plus'} size={13} className="text-muted" />
                  </button>
                  {openVersion === idx && f && <div className="pb-2"><Marked text={v.text} spans={locate(v.text, f.issues.map((i) => i.original)).filter(Boolean).map((p) => ({ ...p!, color: badColor }))} /><p className="t-small mt-3 text-ink2">{f.overall_vi}</p></div>}
                </div>
              );
            })}
            {versions.length >= 2 && (() => {
              const first = versions[0].feedback as CorrectionT | undefined; const last = versions.at(-1)!.feedback as CorrectionT | undefined;
              return first && last ? <p className="t-small mt-4 text-ink2">Lần đầu {first.issues.length} lỗi / {wordCount(versions[0].text)} từ → lần gần nhất {last.issues.length} lỗi / {wordCount(versions.at(-1)!.text)} từ.</p> : null;
            })()}
          </Section>
        )}

        {isFree && (
          <button className="btn btn-text mt-10 w-full" onClick={async () => { if (confirm('Xoá bài viết tự do này?')) { await db.drafts.delete(id); nav('/write'); } }}>Xoá bài này</button>
        )}
      </Page>
      <Toast msg={toast} />
    </>
  );
}

function Feedback({ fb, onUse }: { fb: { data: CorrectionT; original: string; model: string; costUsd: number }; onUse: () => void }) {
  const d = fb.data;
  const spans = locate(fb.original, d.issues.map((i) => i.original));
  const fixed = locate(d.corrected, d.issues.map((i) => i.correction));
  const mark = (ps: ({ start: number; end: number } | null)[], color: string) => ps.filter(Boolean).map((x) => ({ ...x!, color }));
  return (
    <>
      <Section n="I" title="Bản đã chữa" meta={`${d.issues.length} lỗi`}>
        <div className="mt-4"><Kicker>Bài của bạn</Kicker><div className="mt-1"><Marked text={fb.original} spans={mark(spans, badColor)} /></div></div>
        <div className="mt-6"><Kicker>Đã chữa</Kicker><div className="mt-1"><Marked text={d.corrected} spans={mark(fixed, okColor)} /></div></div>
        <button className="btn btn-line mt-6 w-full" onClick={onUse}>Dùng bản đã chữa để viết tiếp</button>
      </Section>

      {d.issues.length > 0 && (
        <Section n="II" title="Từng lỗi" meta="đã ghi vào sổ lỗi">
          {d.issues.map((is, k) => (
            <div key={k} className="border-b border-[var(--rule)] py-4">
              <Kicker>{ISSUE_VI[is.kind] ?? is.kind}{spans[k] ? '' : ' · chung'}</Kicker>
              <p className="serif mt-1 text-[19px]"><span className="line-through decoration-[0.5px]" style={{ color: is.kind === 'accent' ? 'var(--gold)' : badColor }}>{is.original}</span> → <span style={{ color: okColor }}>{is.correction}</span></p>
              <p className="t-small mt-1 text-ink2">{is.explanation_vi}</p>
            </div>
          ))}
        </Section>
      )}

      <Section n="III" title="Nhận xét">
        <p className="t-body measure mt-4">{d.overall_vi}</p>
        {d.strengths_vi.length > 0 && <ul className="mt-4 space-y-2">{d.strengths_vi.map((s, k) => <li key={k} className="t-small flex gap-3 text-ink2"><span className="mt-[9px] h-px w-3 shrink-0" style={{ background: okColor }} />{s}</li>)}</ul>}
        <div className="mt-6"><Kicker>Đề bài</Kicker><p className="t-small mt-1 text-ink2">{d.task_fit_vi}</p></div>
        <div className="mt-4"><Kicker>Luyện tiếp</Kicker><p className="t-small mt-1 text-ink2">{d.next_step_vi}</p></div>
      </Section>

      <Section n="IV" title="Một cách viết tự nhiên">
        <div className="mt-4 flex items-start gap-3">
          <p className="t-fr flex-1 whitespace-pre-wrap">{d.better_version}</p>
          <AudioChip tts={d.better_version} />
        </div>
        <p className="t-meta mt-4">{fb.model} · khoảng ${fb.costUsd.toFixed(fb.costUsd < 0.01 ? 4 : 3)} cho lần chữa này</p>
      </Section>
    </>
  );
}
