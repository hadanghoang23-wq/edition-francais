import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useUnit } from '../../engine/content';
import type { GrammarPoint, Unit } from '../../engine/types';
import { Kicker, Loading, Options, Page, Section, TopBar, WithIpa } from '../../ui/kit';
import { DrillSet, expandDrills } from '../exercises/Drills';
import { recordSet } from '../exercises/record';
import { AudioChip } from '../shared/AudioChip';
import { accentFor } from './bookUnits';

/** Grammar card: rules, verb tables, book examples, then interactive drills whose mistakes go to the error log. */
export default function GrammarCard() {
  const { unitId, gid } = useParams();
  const unit = useUnit(unitId);
  const g = unit?.grammar.find((x) => x.id === gid);
  if (unit === undefined) return <Loading />;
  if (!unit || !g) return <Loading label="Không tìm thấy thẻ ngữ pháp" />;
  return <GrammarBody unit={unit} g={g} accent={accentFor(unit.number)} />;
}

function GrammarBody({ unit, g, accent }: { unit: Unit; g: GrammarPoint; accent: string }) {
  const [tolerant, setTolerant] = useState<'strict' | 'loose'>('strict');
  const [round, setRound] = useState(0);
  const qs = useMemo(() => expandDrills(unit, g.id, g.drills ?? []), [unit, g]);
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
        {qs.length > 0 && (
          <Section title="Exercices" meta={`${qs.length} câu`}>
            <div className="mt-4 flex items-center justify-between">
              <span className="t-small text-ink2">Chấm dấu</span>
              <Options value={tolerant} onChange={setTolerant} options={[['strict', 'Nghiêm'], ['loose', 'Bỏ qua dấu']]} />
            </div>
            <DrillSet key={round} qs={qs} tolerant={tolerant === 'loose'} report={(res) => { void recordSet(`grammar:${unit.id}:${g.id}`, unit.id, 'grammaire', res, 'grammar', g.title); }} />
            <div className="mt-6 flex gap-3">
              <button className="btn btn-line flex-1" onClick={() => setRound(round + 1)}>Làm lại</button>
              <Link className="btn btn-text flex-1" to="/practice/errors">Sổ lỗi</Link>
            </div>
          </Section>
        )}
        <div className="gold-rule mt-12" />
        <p className="t-meta mt-4">Câu sai được ghi vào sổ lỗi và quay lại trong các buổi ôn sau.</p>
      </Page>
    </>
  );
}
