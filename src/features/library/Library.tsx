import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useUnits } from '../../engine/content';
import { db } from '../../engine/db';
import { Empty, Kicker, Loading, Page, TopBar, two } from '../../ui/kit';
import { Icon } from '../../ui/icons';
import { accentFor, BOOK_UNITS } from './bookUnits';

export default function Library() {
  const units = useUnits();
  const ladders = useLiveQuery(() => db.ladder.toArray(), []);
  if (units === undefined) return <Loading />;
  const have = new Map(units.map((u) => [u.number, u]));
  return (
    <>
      <TopBar kicker="Bibliothèque" title="Édito A1" right={<Link to="/import" className="-mr-2 flex h-11 items-center gap-1.5 px-2 t-label !text-ink"><Icon name="plus" size={15} />Nhập gói</Link>} />
      <Page>
        <h1 className="t-hero mt-10">Les numéros</h1>
        <p className="t-gloss mt-2 text-[22px] text-ink2">treize numéros, un livre</p>
        {units.length === 0 && (
          <Empty kicker="Thư viện trống" title="Aucun numéro encore." body="Nhập gói nội dung do pipeline tạo (Unité 0 và Unité 1 đã sẵn sàng trong D:\French\content\packs)." to="/import" cta="Nhập gói nội dung" />
        )}
        <div className="mt-10 rule">
          {BOOK_UNITS.map((b) => {
            const u = have.get(b.number);
            const steps = u ? u.docs.filter((d) => d.shadowing).map((d) => ladders?.find((l) => l.docId === `${u.id}:${d.id}`)?.unlocked ?? 0) : [];
            const pct = steps.length ? steps.reduce((a, c) => a + Math.min(7, c), 0) / (steps.length * 7) : 0;
            const body = (
              <div className="flex min-h-[88px] items-center gap-5 border-b border-[var(--rule)] py-5">
                <span className="t-num w-16 text-[52px] leading-none" style={{ color: u ? accentFor(b.number) : 'var(--faint)' }}>{two(b.number)}</span>
                <div className="min-w-0 flex-1">
                  {u ? (
                    <>
                      <div className="t-head italic">{u.title}</div>
                      <div className="mt-2 flex items-center gap-3">
                        <div className="h-px flex-1 bg-[var(--rule)]"><div className="h-px" style={{ width: `${pct * 100}%`, background: accentFor(b.number) }} /></div>
                        <span className="t-meta shrink-0">p. {u.printedPages[0]}–{u.printedPages[1]}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="t-head text-faint">Unité {b.number}</div>
                      <Kicker className="mt-1 !text-faint">Chưa nhập</Kicker>
                    </>
                  )}
                </div>
                {u && <Icon name="forward" size={18} className="text-muted" />}
              </div>
            );
            return u ? <Link key={b.number} to={`/unit/${u.id}`}>{body}</Link> : <div key={b.number}>{body}</div>;
          })}
        </div>
      </Page>
    </>
  );
}
