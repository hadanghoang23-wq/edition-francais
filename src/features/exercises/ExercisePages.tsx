import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useUnit, useUnits } from '../../engine/content';
import { db } from '../../engine/db';
import { Empty, Loading, Page, Row, Section, TopBar, two } from '../../ui/kit';
import { Icon } from '../../ui/icons';
import { accentFor } from '../library/bookUnits';
import ExerciseRunner from './ExerciseRunner';
import { GROUPS, inGroup, type GroupKey } from './skills';

/** One book exercise; "Bài tiếp" moves through the same practice group. */
export function ExercisePage() {
  const { unitId, exId, group } = useParams();
  const unit = useUnit(unitId);
  const nav = useNavigate();
  if (unit === undefined) return <Loading />;
  if (!unit) return <Loading label="Không tìm thấy bài" />;
  const ex = unit.exercises.find((e) => e.id === exId);
  if (!ex) return <Loading label="Không tìm thấy bài tập" />;
  const list = group && group in GROUPS ? unit.exercises.filter((e) => inGroup(e, group as GroupKey)) : unit.exercises.filter((e) => !e.needsDvd);
  const next = list[list.findIndex((e) => e.id === ex.id) + 1];
  return (
    <>
      <TopBar back={group && group in GROUPS ? `/practice/ex/${group}` : `/unit/${unit.id}`} kicker={group && group in GROUPS ? GROUPS[group as GroupKey].title : 'Exercice'} title={`Unité ${unit.number}`} />
      <Page>
        <div className="mt-8" key={ex.id}>
          <ExerciseRunner unit={unit} ex={ex} onNext={next ? () => nav(`/practice/${group ?? 'all'}/${unit.id}/${next.id}`) : undefined} />
        </div>
      </Page>
    </>
  );
}

/** All book exercises of one practice group, unit by unit, with your best score. */
export function GroupExercises() {
  const { group = 'nghe' } = useParams();
  const g = GROUPS[group as GroupKey] ?? GROUPS.nghe;
  const units = useUnits();
  const results = useLiveQuery(() => db.exerciseResults.toArray(), []);
  if (!units || !results) return <Loading />;
  const best = new Map(results.map((r) => [r.id, r]));
  const total = units.reduce((n, u) => n + u.exercises.filter((e) => inGroup(e, group as GroupKey)).length, 0);
  return (
    <>
      <TopBar back="/practice" kicker="Luyện tập" title={g.vi} />
      <Page>
        <h1 className="t-display mt-10">{g.title}</h1>
        <p className="t-small mt-2 text-ink2">{total} bài tập của sách, làm lại thành bài tương tác. Đáp án lấy từ sách giáo viên.</p>
        {total === 0 && <Empty kicker="Chưa có bài" title="Rien ici encore." body="Nhập gói nội dung của một bài để có bài tập." to="/import" cta="Nhập gói" />}
        {units.map((u) => {
          const list = u.exercises.filter((e) => inGroup(e, group as GroupKey));
          if (!list.length) return null;
          return (
            <Section key={u.id} n={two(u.number)} title={<span className="serif normal-case tracking-normal text-[20px] italic text-ink">{u.title}</span>} meta={`${list.length} bài`}>
              {list.map((e) => {
                const r = best.get(e.id);
                return (
                  <Row key={e.id} to={`/practice/${group}/${u.id}/${e.id}`} n={e.number}
                    title={<span className="serif text-[18px]">{e.instructionFr}</span>}
                    sub={<span className="t-meta">p. {e.printedPage}{r ? ` · tốt nhất ${Math.round(r.best * 100)} %` : ''}</span>}>
                    {r && r.best >= 0.999 ? <Icon name="check" size={16} className="mt-1 text-ok" /> : <span className="mt-2 h-px w-4" style={{ background: r ? accentFor(u.number) : 'var(--rule-strong)' }} />}
                  </Row>
                );
              })}
            </Section>
          );
        })}
        <div className="mt-10"><Link to="/practice" className="btn btn-line w-full">Về Luyện tập</Link></div>
      </Page>
    </>
  );
}
