import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useUnits } from '../../engine/content';
import { db } from '../../engine/db';
import { Empty, Kicker, Page, Rule, TopBar } from '../../ui/kit';
import { accentFor } from '../library/bookUnits';
import { Ladder } from '../library/UnitCover';
import { STEPS } from './steps';

export default function StudioHome() {
  const units = useUnits();
  const ladders = useLiveQuery(() => db.ladder.toArray(), []);
  const takes = useLiveQuery(() => db.recordings.where('kind').equals('sentence').count(), []);
  if (!units) return null;
  return (
    <>
      <TopBar kicker="Nói · nhại theo" title="Shadowing Studio" right={<Link className="chip" to="/then-now">Trước / Nay</Link>} />
      <Page>
        <h1 className="display vi mt-6 text-[48px]">Nghe. Nhại.<br /><i className="text-[var(--accent)]">Lặp lại.</i></h1>
        <p className="mt-3 max-w-[40ch] text-[14px] leading-relaxed text-muted">
          Mỗi đoạn hội thoại có 7 bậc, mở lần lượt: nghe mù → nghe có chữ → nhại từng câu → lẩm nhẩm theo → nhại đầy đủ có chữ → không chữ → ghi một lượt hoàn chỉnh.
        </p>
        <div className="mt-4 flex gap-4 text-[13px] text-muted"><span>{takes ?? 0} bản ghi câu</span></div>
        {units.length === 0 && <Empty title="Chưa có bài." body="Nhập gói nội dung để bắt đầu shadowing." to="/import" cta="Nhập gói" />}
        {units.map((u) => {
          const accent = accentFor(u.number);
          const docs = u.docs.filter((d) => d.shadowing && d.trackId);
          return (
            <section key={u.id} className="mt-8">
              <div className="flex items-baseline justify-between">
                <h2 className="display text-3xl" style={{ color: accent }}>Unité {u.number} · {u.title}</h2>
              </div>
              <Rule className="mt-1" />
              {docs.map((d) => {
                const step = ladders?.find((l) => l.docId === `${u.id}:${d.id}`)?.unlocked ?? 0;
                return (
                  <Link key={d.id} to={`/studio/${u.id}/${d.id}`} className="flex items-center gap-3 border-b hairline py-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[15px] font-medium">{d.title}</div>
                      <Kicker>p. {d.printedPage} · {step >= 7 ? 'hoàn thành' : STEPS[step].short}</Kicker>
                    </div>
                    <Ladder step={step} accent={accent} />
                  </Link>
                );
              })}
            </section>
          );
        })}
      </Page>
    </>
  );
}
