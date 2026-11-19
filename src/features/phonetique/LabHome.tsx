import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { LAB } from '../../content/frLab';
import { useUnits } from '../../engine/content';
import { db } from '../../engine/db';
import { Kicker, Page, ROMAN, Row, Section, TopBar, two, WithIpa } from '../../ui/kit';
import { Icon } from '../../ui/icons';

export default function LabHome() {
  const units = useUnits();
  const errors = useLiveQuery(() => db.errorLog.where('source').equals('phon').filter((e) => !e.resolved).count(), []);
  return (
    <>
      <TopBar back="/practice" kicker="Phonétique" title="Laboratoire" />
      <Page>
        <h1 className="t-hero mt-10">La justesse<br /><span className="italic">avant la vitesse.</span></h1>
        <p className="t-body measure mt-6 text-ink2">Các bài viết riêng cho người Việt: vị trí lưỡi, môi, hàm — chỗ nào tiếng Việt giúp được, chỗ nào đánh lừa bạn. Mỗi bài có phần nghe phân biệt và phần nói.</p>
        {!!errors && <p className="t-small mt-4 flex items-center gap-2 text-ink"><span className="h-px w-4 bg-[var(--accent)]" />{errors} cặp âm bạn hay nhầm sẽ xuất hiện lại trong bài nghe.</p>}

        <Link to="/lab/spell" className="mt-10 block">
          <div className="gold-rule" />
          <div className="flex items-center gap-4 py-6">
            <div className="flex-1">
              <Kicker>Épeler · đánh vần</Kicker>
              <div className="t-display mt-2">G ≠ J <span className="text-faint">·</span> E ≠ I</div>
              <div className="t-small mt-2 text-ink2">Nghe chữ cái, gõ lại — có tên dấu é è ê ç</div>
            </div>
            <Icon name="arrow" size={20} className="text-muted" />
          </div>
          <div className="gold-rule" />
        </Link>

        <Section n="01" title="Leçons essentielles" meta={`${LAB.length} bài`}>
          {LAB.map((l, i) => (
            <Row key={l.id} to={`/lab/lesson/core:${l.id}`} n={two(i + 1)}
              title={<WithIpa text={l.title} />}
              sub={<span className="t-meta block truncate">{l.oneLiner}</span>}
              meta={l.ipa.length > 0 ? <span className="ipa !text-[12px]">/{l.ipa.join('/ /')}/</span> : undefined} />
          ))}
        </Section>

        {units?.map((u) => (
          <Section key={u.id} n={two(u.number)} title={<>Phonétique · <span className="serif normal-case tracking-normal text-[17px] italic text-ink">{u.title}</span></>}>
            {u.phonetics.map((p, i) => (
              <Row key={p.id} to={`/lab/lesson/${u.id}:${p.id}`} n={ROMAN[i]} title={<span className="serif text-[18px]">{p.title}</span>} meta={p.printedPage} />
            ))}
          </Section>
        ))}
      </Page>
    </>
  );
}
