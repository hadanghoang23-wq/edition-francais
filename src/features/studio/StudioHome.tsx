import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useUnits } from '../../engine/content';
import { db } from '../../engine/db';
import { Empty, Loading, Page, Row, Section, TopBar, two } from '../../ui/kit';
import { accentFor } from '../library/bookUnits';
import { Ladder } from '../library/UnitCover';
import { STEPS } from './steps';

export default function StudioHome() {
  const units = useUnits();
  const ladders = useLiveQuery(() => db.ladder.toArray(), []);
  const takes = useLiveQuery(() => db.recordings.where('kind').equals('sentence').count(), []);
  if (!units) return <Loading />;
  return (
    <>
      <TopBar kicker="Studio" title="Shadowing" right={<Link className="t-label -mr-2 flex h-11 items-center px-2 !text-ink" to="/then-now">Avant · Après</Link>} />
      <Page>
        <h1 className="t-hero mt-10">Écouter,<br /><span className="italic">répéter.</span></h1>
        <p className="t-body measure mt-6 text-ink2">
          Mỗi đoạn có bảy bậc, mở lần lượt: nghe không chữ, nghe có chữ, nhại từng câu, lẩm nhẩm theo, nhại có chữ, nhại không chữ, và ghi một lượt hoàn chỉnh.
        </p>
        <p className="t-label mt-4">{takes ?? 0} bản ghi câu</p>
        {units.length === 0 && <Empty kicker="Studio trống" title="Rien à écouter encore." body="Nhập gói nội dung để bắt đầu shadowing với audio của sách." to="/import" cta="Nhập gói" />}
        {units.map((u) => {
          const accent = accentFor(u.number);
          const docs = u.docs.filter((d) => d.shadowing && d.trackId);
          return (
            <Section key={u.id} n={two(u.number)} title={<span className="serif normal-case tracking-normal text-[22px] italic text-ink">{u.title}</span>} meta={`${docs.length} bài`}>
              {docs.map((d) => {
                const step = ladders?.find((l) => l.docId === `${u.id}:${d.id}`)?.unlocked ?? 0;
                return (
                  <Row key={d.id} to={`/studio/${u.id}/${d.id}`} title={<span className="serif text-[18px]">{d.title}</span>}
                    sub={<span className="t-meta">p. {d.printedPage} · {step >= 7 ? 'hoàn thành' : STEPS[step].short.toLowerCase()}</span>}>
                    <Ladder step={step} accent={accent} />
                  </Row>
                );
              })}
            </Section>
          );
        })}
      </Page>
    </>
  );
}
