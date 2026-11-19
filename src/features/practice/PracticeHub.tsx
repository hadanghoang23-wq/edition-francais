import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../engine/db';
import { useUnits } from '../../engine/content';
import { Empty, Kicker, Loading, Page, Row, Section, TopBar, two } from '../../ui/kit';
import { Icon } from '../../ui/icons';
import { GROUPS, inGroup, type GroupKey } from '../exercises/skills';

/** The practice tab: book exercises by skill, listening and reading tools, grammar trainers, phonétique and the error log. */
export default function PracticeHub() {
  const units = useUnits();
  const stats = useLiveQuery(async () => {
    const res = await db.exerciseResults.toArray();
    const now = new Date();
    const open = await db.errorLog.filter((e) => !e.resolved).toArray();
    return { done: new Set(res.map((r) => r.id)), open: open.length, due: open.filter((e) => !e.dueAt || e.dueAt <= now).length };
  }, []);
  if (!units || !stats) return <Loading />;
  const all = units.flatMap((u) => u.exercises);
  const count = (g: GroupKey) => all.filter((e) => inGroup(e, g));
  const doneIn = (g: GroupKey) => count(g).filter((e) => stats.done.has(e.id)).length;
  const verbs = units.reduce((a, u) => a + (u.verbs?.length ?? 0), 0);

  const tools: { to: string; kicker: string; title: string; sub: string }[] = [
    { to: '/practice/dictee', kicker: 'Nghe', title: 'Dictée', sub: 'Nghe từng câu, gõ lại — tách lỗi dấu và lỗi chính tả' },
    { to: '/practice/gaps', kicker: 'Nghe', title: 'Trous à l’écoute', sub: 'Nghe và điền các từ bị che' },
    { to: '/practice/read', kicker: 'Đọc', title: 'Lire', sub: 'Văn bản của sách · chạm một từ để tra' },
    { to: '/practice/verbs', kicker: 'Ngữ pháp', title: 'Conjugaison', sub: verbs ? `${verbs} động từ · lỗi cũ hỏi trước` : 'Có khi nhập bài có động từ' },
    { to: '/practice/articles', kicker: 'Ngữ pháp', title: 'Le ou la ?', sub: 'Giống của danh từ — un / une, le / la, l’' },
    { to: '/practice/agreement', kicker: 'Ngữ pháp', title: 'Il est… elle est…', sub: 'Quốc tịch giống đực / giống cái' },
  ];

  return (
    <>
      <TopBar kicker="Pratique" title="Luyện tập" />
      <Page>
        <h1 className="t-hero mt-10">Exercices</h1>
        <p className="t-body measure mt-4 text-ink2">Bài tập của sách được chấm theo đáp án trong sách giáo viên. Câu sai được ghi vào sổ lỗi và quay lại sau.</p>

        <Link to="/practice/errors" className="mt-10 block">
          <div className="gold-rule" />
          <div className="flex items-center gap-4 py-6">
            <div className="flex-1">
              <Kicker>Sổ lỗi · carnet des erreurs</Kicker>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="t-num text-[52px] leading-none" style={{ color: stats.due ? 'var(--accent)' : undefined }}>{stats.due}</span>
                <span className="t-small text-ink2">lỗi đến hạn ôn · {stats.open} đang mở</span>
              </div>
            </div>
            <Icon name="arrow" size={20} className="text-muted" />
          </div>
          <div className="gold-rule" />
        </Link>

        {units.length === 0 && <Empty kicker="Chưa có bài" title="Pas encore d'exercices." body="Nhập gói nội dung để luyện bài tập của sách." to="/import" cta="Nhập gói" />}

        {units.length > 0 && (
          <Section n="01" title="Exercices du livre" meta={`${all.filter((e) => !e.needsDvd).length} bài`}>
            {(Object.keys(GROUPS) as GroupKey[]).filter((g) => count(g).length).map((g) => (
              <Row key={g} to={`/practice/ex/${g}`} title={<span className="serif text-[19px]">{GROUPS[g].title}</span>}
                sub={<span className="t-meta">{GROUPS[g].vi}</span>}
                meta={<span className="t-num text-[17px]">{doneIn(g)}<span className="text-faint"> / {count(g).length}</span></span>} />
            ))}
          </Section>
        )}

        <Section n="02" title="Outils">
          {tools.map((t, i) => (
            <Row key={t.to} to={t.to} n={two(i + 1)} title={<span className="serif text-[19px]">{t.title}</span>} sub={<span className="t-meta">{t.kicker} · {t.sub}</span>} />
          ))}
        </Section>

        <Section n="03" title="Phonétique">
          <Row to="/lab" title={<span className="serif text-[19px]">Laboratoire</span>} sub={<span className="t-meta">Cặp âm tối thiểu, ngữ điệu, đánh vần G ≠ J</span>} />
          <Row to="/lab/spell" title={<span className="serif text-[19px]">Épeler</span>} sub={<span className="t-meta">Nghe chữ cái, gõ lại</span>} />
        </Section>
      </Page>
    </>
  );
}
