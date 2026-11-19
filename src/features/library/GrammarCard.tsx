import { useParams } from 'react-router-dom';
import { useUnit } from '../../engine/content';
import { Kicker, Loading, Page, Section, TopBar, WithIpa } from '../../ui/kit';
import { AudioChip } from '../shared/AudioChip';
import { accentFor } from './bookUnits';

/** Grammar card (read mode). Interactive drills and the error log arrive in Phase 2. */
export default function GrammarCard() {
  const { unitId, gid } = useParams();
  const unit = useUnit(unitId);
  const g = unit?.grammar.find((x) => x.id === gid);
  if (unit === undefined) return <Loading />;
  if (!unit || !g) return <Loading label="Không tìm thấy thẻ ngữ pháp" />;
  const accent = accentFor(unit.number);
  const verbs = (unit.verbs ?? []).filter((v) => g.verbIds?.includes(v.id));
  return (
    <>
      <TopBar back={`/unit/${unit.id}`} kicker={`Unité ${unit.number} · Grammaire`} right={<span className="t-label">p. {g.printedPage}</span>} />
      <Page>
        <h1 className="t-display mt-10">{g.title}</h1>
        <div className="mt-6 h-px w-12" style={{ background: accent }} />

        <section className="mt-8 space-y-8">
          {g.rules.map((r, i) => (
            <div key={i}>
              <p className="t-gloss text-[21px] leading-snug">{r.fr}</p>
              <p className="t-body measure mt-2 text-ink2"><WithIpa text={r.vi} /></p>
            </div>
          ))}
        </section>

        {g.pronunciationVi && (
          <Section title="Khi nói">
            <p className="t-body measure mt-4 text-ink2"><WithIpa text={g.pronunciationVi} /></p>
          </Section>
        )}

        {verbs.map((v) => (
          <Section key={v.id} title={<span className="serif normal-case tracking-normal text-[26px] text-ink">{v.infinitive}</span>} meta={<span className="ipa normal-case tracking-normal">{v.ipa}</span>}>
            <p className="t-small mt-3 text-ink2">{v.vi}</p>
            {v.present && (
              <table className="mt-3 w-full">
                <tbody>
                  {v.present.map(([p, f, ipa]) => (
                    <tr key={p} className="border-b border-[var(--rule)]">
                      <td className="t-gloss w-24 py-3 text-[17px] text-muted">{p}</td>
                      <td className="serif py-3 text-[20px]">{f}</td>
                      <td className="ipa py-3 text-right text-[12px]">{ipa}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {v.noteVi && <p className="t-small measure mt-4 text-ink2">{v.noteVi}</p>}
          </Section>
        ))}

        <Section title="Exemples du livre">
          {g.examples.map((ex, i) => (
            <div key={i} className="flex items-start gap-4 border-b border-[var(--rule)] py-4">
              <div className="min-w-0 flex-1">
                <p className="t-fr">{ex.fr}</p>
                <p className="t-small mt-1 text-ink2">{ex.vi}</p>
              </div>
              {ex.audio && <AudioChip audio={ex.audio} />}
            </div>
          ))}
        </Section>

        {g.exceptions?.length ? (
          <Section title="Chú ý">
            <ul className="mt-4 space-y-4">{g.exceptions.map((e, i) => <li key={i} className="t-body measure flex gap-3 text-ink2"><span className="mt-[11px] h-px w-3 shrink-0 bg-[var(--gold)]" /><span><WithIpa text={e.vi} /></span></li>)}</ul>
          </Section>
        ) : null}

        {(g.compareVi || g.compareEn) && (
          <section className="mt-12 space-y-8">
            {g.compareVi && <div><Kicker>So với tiếng Việt</Kicker><p className="t-body measure mt-2 text-ink2">{g.compareVi}</p></div>}
            {g.compareEn && <div><Kicker>So với tiếng Anh</Kicker><p className="t-body measure mt-2 text-ink2">{g.compareEn}</p></div>}
          </section>
        )}
        <div className="gold-rule mt-12" />
        <p className="t-meta mt-4">Bài luyện tương tác và sổ lỗi sai cho phần ngữ pháp sẽ có ở giai đoạn 2.</p>
      </Page>
    </>
  );
}
