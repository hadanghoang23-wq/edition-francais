import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { LAB } from '../../content/frLab';
import { db, getSetting, todayKey } from '../../engine/db';
import { buildQueue, retention } from '../../engine/srs';
import { Empty, Kicker, Page, Rule, TopBar } from '../../ui/kit';
import { accentFor, BOOK_UNITS } from '../library/bookUnits';
import { STEPS } from '../studio/steps';

function dayIndex() { return Math.floor(Date.now() / 864e5); }

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
  if (!data) return null;
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
    { label: 'Ôn thẻ từ', sub: `${q.due.length} đến hạn · ${q.fresh.length} mới`, min: reviewMin, to: '/cards/review', done: q.queue.length === 0 },
    cur && nextDoc ? { label: 'Shadowing', sub: `${nextDoc.title} · bước ${nextStep}/7 · ${STEPS[nextStep - 1].short}`, min: Math.round(minutes * 0.4), to: `/studio/${cur.u.id}/${nextDoc.id}`, done: false } : null,
    { label: 'Phonétique', sub: lesson.title, min: 10, to: `/lab/lesson/core:${lesson.id}`, done: false },
    cur && grammar ? { label: 'Bài mới · ngữ pháp', sub: grammar.title, min: Math.max(10, minutes - reviewMin - Math.round(minutes * 0.4) - 10), to: `/unit/${cur.u.id}/grammar/${grammar.id}`, done: false } : null,
  ].filter(Boolean) as { label: string; sub: string; min: number; to: string; done: boolean }[];

  // Streak: consecutive active days ending today (or yesterday if today has nothing yet).
  const active = new Set(stats.filter((s) => s.reviews + s.sentences + s.shadowMs > 0).map((s) => s.date));
  let streak = 0;
  const d = new Date();
  if (!active.has(todayKey(d))) d.setDate(d.getDate() - 1);
  while (active.has(todayKey(d))) { streak++; d.setDate(d.getDate() - 1); }
  const shadowMin = Math.round(stats.reduce((a, s) => a + s.shadowMs, 0) / 60000);
  const sentences = stats.reduce((a, s) => a + s.sentences, 0);
  const dateFr = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  const accent = cur ? accentFor(cur.u.number) : 'var(--cobalt)';

  return (
    <>
      <TopBar kicker={<span>{dateFr}{streak ? <span className="text-[var(--accent)]"> · chuỗi {streak} ngày</span> : ''}</span>} right={<Link to="/settings" aria-label="Cài đặt" className="flex h-11 w-11 items-center justify-center text-xl">⚙</Link>} />
      <Page>
        <h1 className="display mt-5 text-[64px] leading-[0.88]">Aujourd'hui,<br /><i className="text-[var(--accent)]">{minutes} minutes.</i></h1>

        {units.length === 0 ? (
          <Empty title="Bắt đầu từ cuốn sách của bạn." body="Nhập gói nội dung Unité 0 và Unité 1 (D:\French\content\packs). Kế hoạch học hằng ngày sẽ xuất hiện ở đây." to="/import" cta="Nhập gói nội dung" />
        ) : (
          <>
            {cur && (
              <Link to={`/unit/${cur.u.id}`} className="-mr-4 mt-6 block p-4 text-white" style={{ background: accent }}>
                <div className="kicker" style={{ color: 'rgba(255,255,255,.85)' }}>Numéro {String(cur.u.number).padStart(2, '0')} / 12 · đang học</div>
                <div className="display mt-1 text-[44px] leading-none">{cur.u.title}</div>
                <div className="mt-3 grid grid-cols-6 gap-1">
                  {[cur.listening, cur.speaking, 0, 0, 0, 0].map((v, i) => (
                    <div key={i} className="h-[4px] bg-white/30"><div className="h-full bg-white" style={{ width: `${v * 100}%` }} /></div>
                  ))}
                </div>
                <div className="mt-1 grid grid-cols-6 gap-1 text-[10px] opacity-85">{['nghe', 'nói', 'đọc', 'viết', 'ngữ pháp', 'từ vựng'].map((s) => <span key={s}>{s}</span>)}</div>
              </Link>
            )}

            <section className="mt-6">
              {plan.map((p, i) => (
                <Link key={p.label} to={p.to} className="flex items-center gap-3 border-b hairline py-3">
                  <span className="serif w-7 text-[28px] leading-none text-[var(--accent)]">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className={`text-[16px] font-medium ${p.done ? 'line-through opacity-50' : ''}`}>{p.label}</div>
                    <div className="truncate text-[13px] text-muted">{p.sub}</div>
                  </div>
                  <span className="text-[13px] tabular-nums text-muted">{p.done ? '✓' : `${p.min}′`}</span>
                </Link>
              ))}
            </section>

            <section className="mt-8 grid grid-cols-2 gap-px bg-[var(--rule)]">
              {[[streak, 'ngày liên tiếp'], [shadowMin, 'phút shadowing'], [sentences, 'câu đã ghi âm'], [learned, 'từ đã học'], [ret === null ? '—' : `${Math.round(ret * 100)}%`, 'nhớ đúng (30 ngày)'], [units.length, 'bài đã nhập']].map(([v, l]) => (
                <div key={String(l)} className="bg-paper py-4"><div className="display text-[40px] leading-none">{v}</div><Kicker className="mt-1">{l}</Kicker></div>
              ))}
            </section>

            <section className="mt-8">
              <div className="flex items-baseline justify-between"><h2 className="display vi text-3xl">Bản đồ sách</h2><Link to="/library" className="text-[13px] underline">Thư viện</Link></div>
              <Rule className="mt-1" />
              <div className="mt-3 grid grid-cols-7 gap-1.5">
                {BOOK_UNITS.map((b) => {
                  const p = unitProgress.find((x) => x.u.number === b.number);
                  return (
                    <Link key={b.number} to={p ? `/unit/${p.u.id}` : '/import'} className="relative flex aspect-square flex-col justify-end p-1"
                      style={{ background: p ? b.accent : 'var(--paper-2)', color: p ? '#fff' : 'var(--muted)' }} aria-label={`Unité ${b.number}`}>
                      <span className="display text-[20px] leading-none">{b.number}</span>
                      {p && <span className="absolute inset-x-0 bottom-0 h-[3px] bg-white/30"><span className="block h-full bg-white" style={{ width: `${p.speaking * 100}%` }} /></span>}
                    </Link>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </Page>
    </>
  );
}
