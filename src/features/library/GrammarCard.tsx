import { useParams } from 'react-router-dom';
import { useUnit } from '../../engine/content';
import { Kicker, Page, Rule, TopBar } from '../../ui/kit';
import { AudioChip } from '../shared/AudioChip';
import { accentFor } from './bookUnits';

/** Grammar card (read mode). Interactive drills and the error log arrive in Phase 2. */
export default function GrammarCard() {
  const { unitId, gid } = useParams();
  const unit = useUnit(unitId);
  const g = unit?.grammar.find((x) => x.id === gid);
  if (!unit || !g) return null;
  const accent = accentFor(unit.number);
  const verbs = (unit.verbs ?? []).filter((v) => g.verbIds?.includes(v.id));
  return (
    <>
      <TopBar back={`/unit/${unit.id}`} kicker={`Unité ${unit.number} · Grammaire · p. ${g.printedPage}`} title={g.title} />
      <Page>
        <h1 className="display mt-6 text-[46px]" style={{ color: accent }}>{g.title}</h1>
        <section className="mt-6 space-y-5">
          {g.rules.map((r, i) => (
            <div key={i} className="border-l-2 pl-3" style={{ borderColor: accent }}>
              <p className="serif text-[20px] leading-snug">{r.fr}</p>
              <p className="mt-1 text-[15px] leading-relaxed">{r.vi}</p>
            </div>
          ))}
        </section>
        {g.pronunciationVi && (
          <section className="mt-6 card p-4"><Kicker>Khi nói</Kicker><p className="mt-1 text-[15px] leading-relaxed">{g.pronunciationVi}</p></section>
        )}
        {verbs.map((v) => (
          <section key={v.id} className="mt-6">
            <div className="flex items-baseline gap-2"><h3 className="display text-3xl">{v.infinitive}</h3><span className="ipa text-muted">{v.ipa}</span><span className="text-[14px]">— {v.vi}</span></div>
            <Rule className="mt-1" />
            {v.present && (
              <table className="mt-1 w-full text-[15px]">
                <tbody>
                  {v.present.map(([p, f, ipa]) => (
                    <tr key={p} className="border-b hairline"><td className="w-24 py-2 text-muted">{p}</td><td className="py-2 font-semibold">{f}</td><td className="ipa py-2 text-right text-[13px] text-muted">{ipa}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
            {v.noteVi && <p className="mt-2 text-[14px] leading-relaxed text-muted">{v.noteVi}</p>}
          </section>
        ))}
        <section className="mt-8">
          <Kicker>Ví dụ trong sách</Kicker>
          <Rule className="mt-1" />
          {g.examples.map((ex, i) => (
            <div key={i} className="flex items-start gap-3 border-b hairline py-3">
              <div className="min-w-0 flex-1">
                <p className="serif text-[19px] leading-snug">{ex.fr}</p>
                <p className="text-[14px] text-muted">{ex.vi}</p>
              </div>
              {ex.audio && <AudioChip audio={ex.audio} />}
            </div>
          ))}
        </section>
        {g.exceptions?.length ? (
          <section className="mt-6"><Kicker>Chú ý</Kicker>
            <ul className="mt-2 space-y-2 text-[15px] leading-relaxed">{g.exceptions.map((e, i) => <li key={i}>• {e.vi}</li>)}</ul>
          </section>
        ) : null}
        {(g.compareVi || g.compareEn) && (
          <section className="mt-6 grid gap-3">
            {g.compareVi && <div className="card p-4"><Kicker>So với tiếng Việt</Kicker><p className="mt-1 text-[15px] leading-relaxed">{g.compareVi}</p></div>}
            {g.compareEn && <div className="card p-4"><Kicker>So với tiếng Anh</Kicker><p className="mt-1 text-[15px] leading-relaxed">{g.compareEn}</p></div>}
          </section>
        )}
        <p className="mt-8 text-[13px] text-muted">Bài luyện tương tác và sổ lỗi sai cho phần ngữ pháp sẽ có ở giai đoạn 2.</p>
      </Page>
    </>
  );
}
