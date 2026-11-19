import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { LAB } from '../../content/frLab';
import { db, getSetting, todayKey } from '../../engine/db';
import { buildQueue, retention } from '../../engine/srs';
import { Empty, Kicker, Loading, Page, Row, Section, two, WithIpa } from '../../ui/kit';
import { Icon } from '../../ui/icons';
import { accentFor, BOOK_UNITS } from '../library/bookUnits';
import { STEPS } from '../studio/steps';

function dayIndex() { return Math.floor(Date.now() / 864e5); }

const MINUTES_FR: Record<number, string> = { 45: 'quarante-cinq', 60: 'soixante', 75: 'soixante-quinze', 90: 'quatre-vingt-dix', 120: 'cent vingt' };

export default function Today() {
  const data = useLiveQuery(async () => {
    const units = (await db.units.orderBy('number').toArray()).map((u) => u.data);
    const ladders = await db.ladder.toArray();
    const stats = await db.stats.toArray();
    const minutes = await getSetting('dailyMinutes', 75);
    const q = await buildQueue();
    const ret = await retention();
    const learned = new Set((await db.cards.filter((c) => c.deck === 'vocab' && c.introduced && c.reps >= 2).toArray()).map((c) => c.refId)).size;
    const phonErrors = await db.errorLog.where('source').equals('phon').filter((e) => !e.resolved).toArray();
    return { units, ladders, stats, minutes, q, ret, learned, phonErrors };
  }, []);
  if (!data) return <Loading />;
  const { units, ladders, stats, minutes, q, ret, learned, phonErrors } = data;
  const stepOf = (unitId: string, docId: string) => ladders.find((l) => l.docId === `${unitId}:${docId}`)?.unlocked ?? 0;

  // Current unit = first unit whose shadowing ladder is not finished.
  const unitProgress = units.map((u) => {
    const docs = u.docs.filter((d) => d.shadowing && d.trackId);
    const speaking = docs.length ? docs.reduce((a, d) => a + Math.min(7, stepOf(u.id, d.id)), 0) / (docs.length * 7) : 0;
    const listening = docs.length ? docs.filter((d) => stepOf(u.id, d.id) >= 2).length / docs.length : 0;
    return { u, docs, speaking, listening };
  });
  const cur = unitProgress.find((p) => p.speaking < 1) ?? unitProgress.at(-1);
  const nextDoc = cur?.docs.slice().sort((a, b) => stepOf(cur.u.id, a.id) - stepOf(cur.u.id, b.id))[0];
  const nextStep = cur && nextDoc ? Math.min(7, stepOf(cur.u.id, nextDoc.id) + 1) : 1;
  const lesson = phonErrors.length ? LAB.find((l) => l.pairs.some((p) => phonErrors.some((e) => e.prompt === `${p.a}|${p.b}`))) ?? LAB[0] : LAB[dayIndex() % LAB.length];
  const grammar = cur ? cur.u.grammar[dayIndex() % Math.max(1, cur.u.grammar.length)] : undefined;

  const reviewMin = Math.max(5, Math.round((q.due.length + q.fresh.length) * 0.3));
  const plan = [
    { label: 'Ôn thẻ từ', fr: null, sub: `${q.due.length} đến hạn · ${q.fresh.length} mới`, min: reviewMin, to: '/cards/review', done: q.queue.length === 0 },
    cur && nextDoc ? { label: 'Shadowing', fr: nextDoc.title, sub: `bậc ${nextStep} / 7 · ${STEPS[nextStep - 1].short.toLowerCase()}`, min: Math.round(minutes * 0.4), to: `/studio/${cur.u.id}/${nextDoc.id}`, done: false } : null,
    { label: 'Phonétique', fr: null, sub: lesson.title, min: 10, to: `/lab/lesson/core:${lesson.id}`, done: false },
    cur && grammar ? { label: 'Bài mới · ngữ pháp', fr: grammar.title, sub: null, min: Math.max(10, minutes - reviewMin - Math.round(minutes * 0.4) - 10), to: `/unit/${cur.u.id}/grammar/${grammar.id}`, done: false } : null,
  ].filter(Boolean) as { label: string; fr: string | null; sub: string | null; min: number; to: string; done: boolean }[];

  // Streak: consecutive active days ending today (or yesterday if today has nothing yet).
  const active = new Set(stats.filter((s) => s.reviews + s.sentences + s.shadowMs > 0).map((s) => s.date));
  let streak = 0;
  const d = new Date();
  if (!active.has(todayKey(d))) d.setDate(d.getDate() - 1);
  while (active.has(todayKey(d))) { streak++; d.setDate(d.getDate() - 1); }
  const shadowMin = Math.round(stats.reduce((a, s) => a + s.shadowMs, 0) / 60000);
  const sentences = stats.reduce((a, s) => a + s.sentences, 0);
  const dateFr = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

  return (
    <>
      <header className="safe-top px-6">
        <div className="mx-auto flex min-h-[44px] max-w-[600px] items-center">
          <span className="t-label flex-1">Édition{cur ? ` · N° ${two(cur.u.number)}` : ''}</span>
          <span className="t-label">{dateFr}</span>
          <Link to="/settings" aria-label="Cài đặt" className="-mr-3 ml-1 flex h-11 w-11 items-center justify-center text-muted"><Icon name="settings" size={19} /></Link>
        </div>
        <div className="gold-rule mx-auto max-w-[600px]" />
      </header>
      <Page>
        <h1 className="t-hero mt-10">Aujourd'hui</h1>
        <p className="t-gloss mt-2 text-[24px] text-accent">{MINUTES_FR[minutes] ?? minutes} minutes</p>

        {units.length === 0 ? (
          <Empty kicker="Bắt đầu" title="Votre livre, d'abord." body="Nhập gói nội dung Unité 0 và Unité 1 (trong D:\French\content\packs). Kế hoạch học hằng ngày sẽ hiện ở đây." to="/import" cta="Nhập gói nội dung" />
        ) : (
          <>
            <section className="mt-12">
              <div className="flex items-baseline justify-between"><Kicker>Ordre du jour</Kicker><Kicker>phút</Kicker></div>
              <div className="rule mt-3" />
              {plan.map((p, i) => (
                <Row key={p.label} n={two(i + 1)} to={p.to} meta={p.done ? <Icon name="check" size={18} className="text-ok" /> : p.min}
                  title={<span className={p.done ? 'text-muted line-through decoration-[0.5px]' : ''}>{p.label}</span>}
                  sub={<>
                    {p.fr && <div className="t-gloss truncate text-[17px] leading-tight text-ink2">{p.fr}</div>}
                    {p.sub && <div className="t-meta truncate"><WithIpa text={p.sub} /></div>}
                  </>} />
              ))}
            </section>

            {cur && (
              <Link to={`/unit/${cur.u.id}`} className="mt-12 block">
                <div className="flex items-baseline justify-between"><Kicker>Đang học</Kicker><Kicker>Numéro {two(cur.u.number)}</Kicker></div>
                <div className="rule mt-3" />
                <div className="flex items-end gap-5 pt-6">
                  <span className="t-num text-[88px] leading-[0.75]" style={{ color: accentFor(cur.u.number) }}>{two(cur.u.number)}</span>
                  <div className="min-w-0 flex-1 pb-1">
                    <div className="t-title italic">{cur.u.title}</div>
                    <div className="t-meta mt-1">p. {cur.u.printedPages[0]} – {cur.u.printedPages[1]}</div>
                  </div>
                  <Icon name="arrow" size={20} className="mb-2 text-muted" />
                </div>
                <div className="mt-6 grid grid-cols-6 gap-3">
                  {[['nghe', cur.listening], ['nói', cur.speaking], ['đọc', 0], ['viết', 0], ['ngữ pháp', 0], ['từ vựng', 0]].map(([l, v]) => (
                    <div key={l as string}>
                      <div className="h-px bg-[var(--rule)]"><div className="h-px" style={{ width: `${(v as number) * 100}%`, background: 'var(--accent)' }} /></div>
                      <div className="mt-2 truncate text-[10px] font-medium uppercase tracking-[0.1em] text-muted">{l as string}</div>
                    </div>
                  ))}
                </div>
              </Link>
            )}

            <section className="mt-12">
              <div className="gold-rule" />
              <div className="grid grid-cols-3 gap-y-6 pt-6">
                {[[streak, 'ngày liên tiếp'], [shadowMin, 'phút shadowing'], [sentences, 'câu đã ghi'], [learned, 'từ đã học'], [ret === null ? '—' : `${Math.round(ret * 100)}`, 'nhớ đúng %'], [units.length, 'bài đã nhập']].map(([v, l]) => (
                  <div key={String(l)}>
                    <div className="t-num text-[40px] leading-none">{v}</div>
                    <div className="t-label mt-2 !text-[10px]">{l}</div>
                  </div>
                ))}
              </div>
              <div className="gold-rule mt-6" />
            </section>

            <Section title="Sommaire du livre" meta={<Link to="/library" className="underline decoration-[0.5px] underline-offset-4">Thư viện</Link>}>
              <div className="mt-5 grid grid-cols-7 gap-x-2 gap-y-5">
                {BOOK_UNITS.map((b) => {
                  const p = unitProgress.find((x) => x.u.number === b.number);
                  return (
                    <Link key={b.number} to={p ? `/unit/${p.u.id}` : '/import'} aria-label={`Unité ${b.number}`} className="flex min-h-[44px] flex-col items-center justify-end">
                      <span className="t-num text-[24px] leading-none" style={{ color: p ? accentFor(b.number) : 'var(--faint)' }}>{two(b.number)}</span>
                      <span className="mt-2 block h-px w-full bg-[var(--rule)]">{p && <span className="block h-px" style={{ width: `${Math.max(4, p.speaking * 100)}%`, background: accentFor(b.number) }} />}</span>
                    </Link>
                  );
                })}
              </div>
            </Section>
          </>
        )}
      </Page>
    </>
  );
}
