import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useUnits } from '../../engine/content';
import { db } from '../../engine/db';
import { Empty, Page, TopBar } from '../../ui/kit';
import { BOOK_UNITS } from './bookUnits';

export default function Library() {
  const units = useUnits();
  const ladders = useLiveQuery(() => db.ladder.toArray(), []);
  if (units === undefined) return null;
  const have = new Map(units.map((u) => [u.number, u]));
  return (
    <>
      <TopBar kicker="Édito A1 · 2016" title="Thư viện" right={<Link to="/import" className="chip">+ Nhập gói</Link>} />
      <Page>
        {units.length === 0 && (
          <Empty title="Chưa có bài nào." body="Nhập gói nội dung do pipeline tạo (Unité 0 và Unité 1 đã sẵn sàng trong D:\French\content\packs)." to="/import" cta="Nhập gói nội dung" />
        )}
        <div className="mt-6 grid grid-cols-2 gap-3">
          {BOOK_UNITS.map((b) => {
            const u = have.get(b.number);
            const steps = u ? u.docs.filter((d) => d.shadowing).map((d) => ladders?.find((l) => l.docId === `${u.id}:${d.id}`)?.unlocked ?? 0) : [];
            const pct = steps.length ? steps.reduce((a, c) => a + Math.min(7, c), 0) / (steps.length * 7) : 0;
            const body = (
              <div className={`relative flex aspect-[3/4] flex-col justify-between p-3 ${u ? '' : 'opacity-40'}`}
                style={{ background: u ? b.accent : 'var(--paper-2)', color: u ? '#fff' : 'var(--ink)' }}>
                <div className="flex items-start justify-between">
                  <span className="kicker" style={{ color: 'inherit', opacity: 0.85 }}>N° {String(b.number).padStart(2, '0')}</span>
                  {!u && <span className="kicker" style={{ color: 'inherit' }}>chưa nhập</span>}
                </div>
                <div>
                  <div className="display text-[30px] leading-[0.9]">{u ? u.title : `Unité ${b.number}`}</div>
                  {u && <div className="mt-2 text-[11px] opacity-80">p. {u.printedPages[0]}–{u.printedPages[1]}</div>}
                  {u && <div className="mt-2 h-[3px] bg-white/30"><div className="h-full bg-white" style={{ width: `${pct * 100}%` }} /></div>}
                </div>
              </div>
            );
            return u ? <Link key={b.number} to={`/unit/${u.id}`}>{body}</Link> : <div key={b.number}>{body}</div>;
          })}
        </div>
      </Page>
    </>
  );
}
