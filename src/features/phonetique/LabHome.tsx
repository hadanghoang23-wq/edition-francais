import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { LAB } from '../../content/frLab';
import { useUnits } from '../../engine/content';
import { db } from '../../engine/db';
import { Kicker, Page, Rule, TopBar } from '../../ui/kit';
import { accentFor } from '../library/bookUnits';

export default function LabHome() {
  const units = useUnits();
  const errors = useLiveQuery(() => db.errorLog.where('source').equals('phon').filter((e) => !e.resolved).count(), []);
  return (
    <>
      <TopBar kicker="Ngữ âm" title="Phonétique Lab" />
      <Page>
        <h1 className="display vi mt-6 text-[48px]">Đúng âm,<br /><i className="text-[var(--cobalt)]">trước khi nhanh.</i></h1>
        <p className="mt-3 max-w-[40ch] text-[14px] leading-relaxed text-muted">Các bài viết riêng cho người Việt: vị trí lưỡi, môi, hàm — chỗ nào tiếng Việt giúp được, chỗ nào đánh lừa bạn. Mỗi bài có phần nghe phân biệt và phần nói.</p>
        {!!errors && <p className="mt-3 text-[13px]"><span className="text-[var(--tomato)]">●</span> {errors} cặp âm bạn hay nhầm sẽ xuất hiện lại trong bài nghe.</p>}

        <Link to="/lab/spell" className="mt-6 flex items-center justify-between border-2 p-4" style={{ borderColor: 'var(--ink)' }}>
          <div><Kicker>Đánh vần · épeler</Kicker><div className="display mt-1 text-3xl">G ≠ J · E ≠ I</div><div className="text-[13px] text-muted">Nghe chữ cái, gõ lại — có tên dấu é è ê ç</div></div>
          <span className="text-2xl">→</span>
        </Link>

        <section className="mt-8">
          <h2 className="display vi text-3xl">Bài trọng tâm</h2>
          <Rule className="mt-1" />
          {LAB.map((l, i) => (
            <Link key={l.id} to={`/lab/lesson/core:${l.id}`} className="flex items-center gap-3 border-b hairline py-3">
              <span className="serif w-8 text-2xl text-[var(--accent)]">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-medium">{l.title}</div>
                <div className="truncate text-[12px] text-muted">{l.oneLiner}</div>
              </div>
              {l.ipa.length > 0 && <span className="ipa text-[13px] text-muted">/{l.ipa.join('/ /')}/</span>}
            </Link>
          ))}
        </section>

        {units?.map((u) => (
          <section key={u.id} className="mt-8">
            <h2 className="display text-3xl" style={{ color: accentFor(u.number) }}>Phonétique · Unité {u.number}</h2>
            <Rule className="mt-1" />
            {u.phonetics.map((p) => (
              <Link key={p.id} to={`/lab/lesson/${u.id}:${p.id}`} className="flex items-center justify-between border-b hairline py-3">
                <span className="text-[15px] font-medium">{p.title}</span><span className="text-[12px] text-muted">p. {p.printedPage} →</span>
              </Link>
            ))}
          </section>
        ))}
      </Page>
    </>
  );
}
