import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type ErrorLogRow } from '../../engine/db';
import { gradeAnswer, type AnswerVerdict } from '../../engine/diff';
import { dueErrors, logError, markCorrect } from '../../engine/errors';
import { useUnits } from '../../engine/content';
import type { Unit } from '../../engine/types';
import { Empty, Kicker, Loading, Page, Progress, Row, Section, TopBar } from '../../ui/kit';
import { Icon } from '../../ui/icons';
import { badColor, ChoiceRow, okColor } from '../exercises/parts';
import { AccentBar } from '../listen/Listening';

const PERSONS_VI: Record<string, string> = { "j'": 'tôi', je: 'tôi', tu: 'bạn (thân)', 'il/elle': 'anh ấy / cô ấy', nous: 'chúng tôi', vous: 'các bạn / ông bà', 'ils/elles': 'họ' };

interface VerbQ { ref: string; inf: string; person: string; form: string; vi: string }

function verbPool(units: Unit[]): VerbQ[] {
  return units.flatMap((u) => (u.verbs ?? []).flatMap((v) => (v.present ?? []).map(([person, form], pi) => ({ ref: `verb:${v.infinitive}:${pi}`, inf: v.infinitive, person, form, vi: v.vi }))));
}

function pick<T extends { ref: string }>(pool: T[], due: Set<string>, n: number, seed = Date.now()) {
  const first = pool.filter((q) => due.has(q.ref));
  const rest = pool.filter((q) => !due.has(q.ref)).map((q, i) => [q, Math.sin(seed / 1e5 + i * 12.9898)] as const).sort((a, b) => a[1] - b[1]).map((x) => x[0]);
  return [...first, ...rest].slice(0, n);
}

/** Conjugation trainer: grows as units introduce verbs; mistakes come back first. */
export function VerbTrainer() {
  const units = useUnits();
  const due = useLiveQuery(async () => new Set((await dueErrors(['grammar'])).map((e) => e.ref!)), []);
  const [round, setRound] = useState(0);
  const qs = useMemo(() => (units && due ? pick(verbPool(units), due, 10, round + 1) : null), [units, round, !due]);
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState('');
  const [verdict, setVerdict] = useState<AnswerVerdict | null>(null);
  const [score, setScore] = useState(0);
  if (!units || !qs) return <Loading />;
  const verbs = [...new Set(verbPool(units).map((q) => q.inf))];
  if (!verbs.length) return <><TopBar back="/practice" kicker="Grammaire" title="Chia động từ" /><Page><Empty kicker="Chưa có động từ" title="Pas encore de verbes." body="Bảng chia động từ xuất hiện khi bạn nhập các bài có giới thiệu động từ (Unité 1: être, avoir, s'appeler)." to="/import" cta="Nhập gói" /></Page></>;
  const q = qs[i];
  const finished = i >= qs.length;
  const check = async () => {
    const bare = q.form.replace(/^(je|j'|tu|il\/elle|nous|vous|ils\/elles)\s*/i, '');
    const g = gradeAnswer(typed, [q.form, bare, `${q.person} ${q.form}`]);
    setVerdict(g);
    if (g === 'exact') { setScore(score + 1); await markCorrect(q.ref); }
    else await logError({ source: 'grammar', prompt: `${q.person} …… (${q.inf})`, given: typed, expected: q.form, ref: q.ref, hint: `${q.inf} — ${q.vi}` });
  };
  return (
    <>
      <TopBar back="/practice" kicker="Grammaire" title="Conjugaison" right={<span className="t-num text-[17px] text-ink2">{Math.min(i + 1, qs.length)} / {qs.length}</span>} />
      <Progress value={i / qs.length} />
      <Page>
        {finished ? (
          <div className="mt-20 text-center">
            <Kicker>Résultat</Kicker>
            <div className="t-num mt-4 text-[96px] leading-none">{score}<span className="text-[36px] text-muted"> / {qs.length}</span></div>
            <p className="t-small mt-6 text-ink2">Động từ đang luyện: {verbs.join(', ')}</p>
            <button className="btn btn-primary mt-10 w-full" onClick={() => { setRound(round + 1); setI(0); setScore(0); setTyped(''); setVerdict(null); }}>Vòng mới</button>
          </div>
        ) : (
          <div className="mt-14 text-center">
            <Kicker>Présent · {q.vi}</Kicker>
            <div className="t-display mt-4 italic">{q.inf}</div>
            <div className="mt-10 flex items-baseline justify-center gap-3">
              <span className="t-gloss text-[28px] text-muted">{q.person}</span>
              <input value={typed} onChange={(e) => setTyped(e.target.value)} disabled={!!verdict} autoFocus autoCapitalize="off" autoCorrect="off" spellCheck={false}
                onKeyDown={(e) => e.key === 'Enter' && (verdict ? (setI(i + 1), setTyped(''), setVerdict(null)) : check())} aria-label="Dạng chia"
                className="serif w-48 border-b bg-transparent py-1 text-center text-[30px] outline-none"
                style={{ borderColor: verdict ? (verdict === 'exact' ? okColor : badColor) : 'var(--rule-strong)', color: verdict ? (verdict === 'exact' ? okColor : badColor) : undefined }} />
            </div>
            <p className="t-meta mt-2">{PERSONS_VI[q.person] ?? ''}</p>
            {!verdict && <AccentBar onInsert={(c) => setTyped((t) => t + c)} />}
            {verdict && verdict !== 'exact' && <p className="serif mt-4 text-[24px]" style={{ color: okColor }}>{q.person} {q.form}{verdict === 'accent' ? <span className="t-meta"> · chỉ sai dấu</span> : null}</p>}
            {!verdict ? <button className="btn btn-primary mt-10 w-full" disabled={!typed.trim()} onClick={check}>Kiểm tra</button>
              : <button className="btn btn-primary mt-10 w-full" onClick={() => { setI(i + 1); setTyped(''); setVerdict(null); }}>Tiếp</button>}
          </div>
        )}
      </Page>
    </>
  );
}

interface ChoiceQ { ref: string; prompt: string; sub?: string; options: string[]; answer: number; explain: string }

function ChoiceTrainer({ title, kicker, build, emptyBody }: { title: string; kicker: string; build: (units: Unit[], due: Set<string>, seed: number) => ChoiceQ[]; emptyBody: string }) {
  const units = useUnits();
  const due = useLiveQuery(async () => new Set((await dueErrors(['grammar'])).map((e) => e.ref!)), []);
  const [round, setRound] = useState(0);
  const qs = useMemo(() => (units && due ? build(units, due, round + 1) : null), [units, round, !due, build]);
  const [i, setI] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  useEffect(() => { setSel(null); }, [i]);
  if (!qs) return <Loading />;
  if (!qs.length) return <><TopBar back="/practice" kicker="Grammaire" title={title} /><Page><Empty kicker="Chưa có dữ liệu" title="Pas encore." body={emptyBody} to="/import" cta="Nhập gói" /></Page></>;
  const q = qs[i];
  const finished = i >= qs.length;
  const choose = async (k: number) => {
    if (sel !== null) return;
    setSel(k);
    if (k === q.answer) { setScore(score + 1); await markCorrect(q.ref); }
    else await logError({ source: 'grammar', prompt: `${q.prompt}${q.sub ? ` (${q.sub})` : ''}`, given: q.options[k], expected: q.options[q.answer], ref: q.ref, hint: q.explain });
  };
  return (
    <>
      <TopBar back="/practice" kicker={kicker} title={title} right={<span className="t-num text-[17px] text-ink2">{Math.min(i + 1, qs.length)} / {qs.length}</span>} />
      <Progress value={i / qs.length} />
      <Page>
        {finished ? (
          <div className="mt-20 text-center">
            <Kicker>Résultat</Kicker>
            <div className="t-num mt-4 text-[96px] leading-none">{score}<span className="text-[36px] text-muted"> / {qs.length}</span></div>
            <button className="btn btn-primary mt-10 w-full" onClick={() => { setRound(round + 1); setI(0); setScore(0); }}>Vòng mới</button>
          </div>
        ) : (
          <div className="mt-14">
            <p className="serif text-center text-[38px] leading-tight">{q.prompt}</p>
            {q.sub && <p className="t-small mt-2 text-center text-ink2">{q.sub}</p>}
            <div className="mt-10 rule">
              {q.options.map((o, k) => (
                <ChoiceRow key={k} selected={sel === k} state={sel !== null ? (k === q.answer ? 'ok' : sel === k ? 'bad' : null) : null} onClick={() => choose(k)}>
                  <span className="serif text-[22px]">{o}</span>
                </ChoiceRow>
              ))}
            </div>
            {sel !== null && <p className="t-small mt-4 text-ink2">{q.explain}</p>}
            {sel !== null && <button className="btn btn-primary mt-8 w-full" onClick={() => setI(i + 1)}>Tiếp</button>}
          </div>
        )}
      </Page>
    </>
  );
}

const startsVowel = (w: string) => /^[aeiouyhàâéèêëîïôûùœ]/i.test(w);

function buildArticles(units: Unit[], due: Set<string>, seed: number): ChoiceQ[] {
  // Months, titles (madame/monsieur) and plural-only nouns don't fit a « le / la » question.
  const skip = new Set(['madame', 'monsieur', 'mademoiselle']);
  const nouns = units.flatMap((u) => u.vocab.filter((v) => v.pos === 'noun' && (v.gender === 'm' || v.gender === 'f') && v.number !== 'pl' && !v.lemma.includes(' ') && !skip.has(v.lemma) && !v.tags?.includes('mois')));
  const pool: ChoiceQ[] = nouns.map((v) => {
    const vowel = startsVowel(v.lemma);
    return vowel
      ? { ref: `gender:${v.id}`, prompt: `l'${v.lemma}`, sub: `${v.vi} — giống gì?`, options: ['masculin · un', 'féminin · une'], answer: v.gender === 'm' ? 0 : 1, explain: `${v.gender === 'm' ? 'un' : 'une'} ${v.lemma} — trước nguyên âm, le/la đều thành l', nên phải học giống qua « un / une ».` }
      : { ref: `gender:${v.id}`, prompt: `…… ${v.lemma}`, sub: v.vi, options: ['le', 'la'], answer: v.gender === 'm' ? 0 : 1, explain: `${v.gender === 'm' ? 'le' : 'la'} ${v.lemma} (${v.gender === 'm' ? 'giống đực' : 'giống cái'})${v.note ? ` — ${v.note}` : ''}` };
  });
  return pick(pool, due, 12, seed);
}

function buildAgreement(units: Unit[], due: Set<string>, seed: number): ChoiceQ[] {
  const pool: ChoiceQ[] = units.flatMap((u) => (u.countries ?? []).filter((c) => c.nat.m !== c.nat.f).flatMap((c) => ([
    { ref: `agree:${c.id}:m`, prompt: 'Il est ……', sub: `người ${c.vi}`, options: [c.nat.m, c.nat.f], answer: 0, explain: `Il est ${c.nat.m}. Giống đực — không thêm e.` },
    { ref: `agree:${c.id}:f`, prompt: 'Elle est ……', sub: `người ${c.vi}`, options: [c.nat.m, c.nat.f], answer: 1, explain: `Elle est ${c.nat.f}. Giống cái: thêm -e (hoặc -ne sau -ien/-éen); phụ âm cuối được đọc lên.` },
  ])));
  return pick(pool, due, 12, seed).map((q, i) => (i % 2 ? { ...q, options: [...q.options].reverse(), answer: 1 - q.answer } : q));
}

export const ArticleTrainer = () => <ChoiceTrainer title="Le ou la ?" kicker="Grammaire · genre" build={buildArticles} emptyBody="Nhập các bài có danh từ để luyện giống." />;
export const AgreementTrainer = () => <ChoiceTrainer title="Accord" kicker="Grammaire · nationalité" build={buildAgreement} emptyBody="Nhập Unité 1 (danh sách nước và quốc tịch) để luyện." />;

/** The error log: mistakes come back after a delay and leave after two correct answers in a row. */
export function ErrorLog() {
  const open = useLiveQuery(() => db.errorLog.filter((e) => !e.resolved).reverse().sortBy('createdAt'), []);
  const resolvedCount = useLiveQuery(() => db.errorLog.filter((e) => e.resolved).count(), []);
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState('');
  const [verdict, setVerdict] = useState<AnswerVerdict | null>(null);
  const [mode, setMode] = useState<'list' | 'review'>('list');
  const now = new Date();
  // The review queue is a snapshot: answering moves an item's due date, which must not reshuffle the round.
  const [queue, setQueue] = useState<ErrorLogRow[]>([]);
  const typedOpen = (open ?? []).filter((e) => e.ref && !e.ref.startsWith('ex-choice') && e.source !== 'phon' && e.source !== 'spell');
  const dueNow = typedOpen.filter((e) => !e.dueAt || e.dueAt <= now);
  const due = queue;
  if (!open) return <Loading />;
  const e = due[i];
  const label: Record<string, string> = { grammar: 'Ngữ pháp', exercise: 'Bài tập', listening: 'Nghe', vocab: 'Từ vựng', gender: 'Giống', phon: 'Ngữ âm', spell: 'Đánh vần' };

  if (mode === 'review' && e) {
    const check = async () => {
      const g = gradeAnswer(typed, e.expected.split(' / ').length > 1 ? e.expected : [e.expected, e.expected.replace(/^(je|j'|tu|il\/elle|nous|vous|ils\/elles)\s*/i, '')]);
      setVerdict(g);
      if (g === 'exact') await markCorrect(e.ref!); else await logError({ source: e.source, prompt: e.prompt, given: typed, expected: e.expected, ref: e.ref, hint: e.hint });
    };
    return (
      <>
        <TopBar back="/practice" kicker="Sổ lỗi" title="Ôn lỗi" right={<span className="t-num text-[17px] text-ink2">{i + 1} / {due.length}</span>} />
        <Progress value={i / due.length} />
        <Page>
          <div className="mt-12">
            <Kicker>{label[e.source] ?? e.source} · lần trước bạn viết « {e.given || '—'} »</Kicker>
            <p className="t-fr mt-4">{e.prompt}</p>
            {e.hint && <p className="t-small mt-2 text-ink2">{e.hint}</p>}
            <input value={typed} onChange={(x) => setTyped(x.target.value)} disabled={!!verdict} autoCapitalize="off" autoCorrect="off" spellCheck={false} aria-label="Câu trả lời"
              className="serif mt-8 w-full border-b bg-transparent py-2 text-[24px] outline-none"
              style={{ borderColor: verdict ? (verdict === 'exact' ? okColor : badColor) : 'var(--rule-strong)' }} />
            {!verdict && <AccentBar onInsert={(c) => setTyped((t) => t + c)} />}
            {verdict && <p className="serif mt-4 text-[22px]" style={{ color: verdict === 'exact' ? okColor : badColor }}>{verdict === 'exact' ? 'Chính xác.' : e.expected}</p>}
            {!verdict ? <button className="btn btn-primary mt-10 w-full" disabled={!typed.trim()} onClick={check}>Kiểm tra</button>
              : <button className="btn btn-primary mt-10 w-full" onClick={() => { setTyped(''); setVerdict(null); if (i + 1 >= due.length) { setMode('list'); setI(0); } else setI(i + 1); }}>Tiếp</button>}
          </div>
        </Page>
      </>
    );
  }

  return (
    <>
      <TopBar back="/practice" kicker="Luyện tập" title="Sổ lỗi" />
      <Page>
        <h1 className="t-display mt-10">Le carnet<br /><span className="italic">des erreurs</span></h1>
        <p className="t-small measure mt-3 text-ink2">Mỗi lỗi sai được ghi lại và quay lại sau một ngày, rồi ba ngày. Trả lời đúng hai lần liên tiếp thì lỗi được xoá khỏi sổ.</p>
        <div className="mt-8 grid grid-cols-3">
          <div><div className="t-num text-[44px] leading-none">{open.length}</div><Kicker className="mt-2">đang mở</Kicker></div>
          <div><div className="t-num text-[44px] leading-none text-accent">{dueNow.length}</div><Kicker className="mt-2">đến hạn ôn</Kicker></div>
          <div><div className="t-num text-[44px] leading-none">{resolvedCount ?? 0}</div><Kicker className="mt-2">đã sửa</Kicker></div>
        </div>
        <button className="btn btn-primary mt-8 w-full" disabled={!typedOpen.length} onClick={() => { setQueue(dueNow.length ? dueNow : typedOpen); setMode('review'); setI(0); }}>{dueNow.length ? `Ôn ${dueNow.length} lỗi đến hạn` : typedOpen.length ? `Ôn sớm ${typedOpen.length} lỗi` : 'Chưa có lỗi để ôn'}</button>
        {!dueNow.length && typedOpen.length > 0 && <p className="t-meta mt-2">Chưa có lỗi đến hạn — ôn sớm vẫn được tính.</p>}
        {open.length === 0 && <Empty kicker="Sổ trống" title="Aucune erreur." body="Lỗi từ bài tập, chính tả, ngữ pháp và phần nghe sẽ xuất hiện ở đây." />}
        {open.length > 0 && (
          <Section title="Lỗi gần đây" meta={`${open.length}`}>
            {open.slice(0, 40).map((x) => (
              <Row key={x.id} title={<span className="serif text-[18px]">{x.prompt}</span>}
                sub={<span className="t-meta">{label[x.source] ?? x.source} · bạn viết « {x.given || '—'} » · đúng: <span className="text-ink">{x.expected}</span></span>}>
                {x.ref?.startsWith('ex-choice') ? <Link to={`/practice/all/${x.ref.split(':')[1]}/${x.ref.split(':')[2]}`} className="t-label mt-1 shrink-0 !text-ink">Làm lại</Link>
                  : <button className="t-label mt-1 shrink-0" onClick={() => db.errorLog.update(x.id!, { resolved: true })} aria-label="Đánh dấu đã sửa"><Icon name="check" size={15} /></button>}
              </Row>
            ))}
          </Section>
        )}
      </Page>
    </>
  );
}

