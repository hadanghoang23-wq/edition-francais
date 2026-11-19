import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useOffset, usePageUrl, useUnit } from '../../engine/content';
import { db } from '../../engine/db';
import { FR_NUM, Kicker, Loading, Page, ROMAN, Row, Section, Sheet, TopBar, two } from '../../ui/kit';
import { Icon } from '../../ui/icons';
import { accentFor } from './bookUnits';

const KIND_VI: Record<string, string> = {
  ouverture: 'Mở đầu', communication: 'Giao tiếp', grammaire: 'Ngữ pháp', vocabulaire: 'Từ vựng', phonetique: 'Ngữ âm',
  socioculturel: 'Văn hoá', essentiel: 'Tóm tắt', ateliers: 'Dự án', detente: 'Giải trí', delf: 'DELF',
};

export function PageViewer({ pdf, onClose }: { pdf: number | null; onClose: () => void }) {
  const url = usePageUrl(pdf);
  const offset = useOffset();
  return (
    <Sheet open={pdf !== null} onClose={onClose} title={pdf ? `Trang ${pdf - offset} trong sách` : ''}>
      {url ? <img src={url} alt="Trang sách" className="mb-6 w-full" /> : <p className="t-body py-8 text-muted">Trang này không có trong gói.</p>}
    </Sheet>
  );
}

export default function UnitCover() {
  const { unitId } = useParams();
  const unit = useUnit(unitId);
  const offset = useOffset();
  const [page, setPage] = useState<number | null>(null);
  const [showFlags, setShowFlags] = useState(false);
  const ladders = useLiveQuery(() => db.ladder.toArray(), []);
  if (unit === undefined) return <Loading />;
  if (!unit) return <Loading label="Không tìm thấy bài" />;
  const accent = accentFor(unit.number);
  const shadowDocs = unit.docs.filter((d) => d.shadowing && d.trackId);

  return (
    <>
      <TopBar back="/library" kicker="Bibliothèque" right={<span className="t-label">p. {unit.printedPages[0]} — {unit.printedPages[1]}</span>} />
      <Page>
        {/* The issue cover: huge numeral, italic title, gold rule */}
        <div className="t-num mt-6 text-[176px] leading-[0.78] tracking-[-0.04em]" style={{ color: accent }}>{two(unit.number)}</div>
        <Kicker className="mt-6">Unité {FR_NUM[unit.number] ?? unit.number}</Kicker>
        <h1 className="t-hero mt-3 italic">{unit.title}</h1>
        {unit.titleVi && <p className="t-body mt-3 text-ink2">{unit.titleVi}</p>}
        {unit.subtitle && <p className="t-gloss measure mt-3 text-[18px] leading-snug text-ink2">{unit.subtitle}</p>}
        <div className="gold-rule mt-8" />
        <button className="btn-text btn mt-2 !px-0 !text-[10px]" onClick={() => setPage(unit.printedPages[0] + offset)}>
          Xem trang mở đầu <Icon name="arrow" size={16} />
        </button>

        {unit.objectives && (
          <Section n="01" title="Mục tiêu">
            <ul className="mt-4 space-y-2">{unit.objectives.map((o) => <li key={o} className="t-gloss text-[19px] leading-snug">{o}</li>)}</ul>
          </Section>
        )}

        <Section n="02" title="Sommaire">
          {unit.sections.map((s, i) => (
            <button key={s.id} onClick={() => setPage(s.printedPage + offset)} className="flex min-h-[48px] w-full items-baseline gap-3 py-2.5 text-left">
              <span className="t-num w-8 shrink-0 text-[15px]" style={{ color: accent }}>{ROMAN[i] ?? i + 1}</span>
              <span className="min-w-0">
                <span className="serif block text-[18px] leading-snug">{s.title}{s.needsDvd ? ' · DVD' : ''}</span>
                <span className="t-label !text-[9px]">{KIND_VI[s.kind] ?? s.kind}</span>
              </span>
              <span className="mx-1 mb-[6px] min-w-[16px] flex-1 border-b border-dotted border-[var(--rule-strong)]" />
              <span className="t-num shrink-0 text-[16px] text-ink2">{s.printedPage}</span>
            </button>
          ))}
        </Section>

        <Section n="03" title="Shadowing" meta={`${shadowDocs.length} bài`}>
          {shadowDocs.map((d) => {
            const step = ladders?.find((l) => l.docId === `${unit.id}:${d.id}`)?.unlocked ?? 0;
            return (
              <Row key={d.id} to={`/studio/${unit.id}/${d.id}`} n={d.trackId?.slice(1).replace(/^0+/, '')}
                title={<span className="serif text-[18px]">{d.title}</span>}
                sub={<span className="t-meta">p. {d.printedPage} · bậc {Math.min(7, step + 1)} / 7</span>}>
                <Ladder step={step} accent={accent} />
              </Row>
            );
          })}
        </Section>

        <Section n="04" title="Ngữ pháp">
          {unit.grammar.map((g, i) => (
            <Row key={g.id} to={`/unit/${unit.id}/grammar/${g.id}`} n={ROMAN[i]} title={<span className="serif text-[18px]">{g.title}</span>} meta={g.printedPage} />
          ))}
        </Section>

        <Section n="05" title="Ngữ âm">
          {unit.phonetics.map((p, i) => (
            <Row key={p.id} to={`/lab/lesson/${unit.id}:${p.id}`} n={ROMAN[i]} title={<span className="serif text-[18px]">{p.title}</span>} meta={p.printedPage} />
          ))}
        </Section>

        <section className="mt-12">
          <div className="gold-rule" />
          <div className="grid grid-cols-3 pt-6 text-center">
            {[[unit.vocab.length + (unit.countries?.length ?? 0), 'từ'], [unit.exercises.length, 'bài tập'], [unit.grammar.length, 'điểm ngữ pháp']].map(([n, l]) => (
              <div key={String(l)}><div className="t-num text-[40px] leading-none">{n}</div><div className="t-label mt-2 !text-[9px]">{l}</div></div>
            ))}
          </div>
          <div className="gold-rule mt-6" />
          <Link to="/cards" className="btn btn-line mt-6 w-full">Ôn từ vựng của bài này</Link>
        </section>

        {unit.flags.length > 0 && (
          <section className="mt-10">
            <button className="t-label flex min-h-[44px] items-center gap-2" onClick={() => setShowFlags(!showFlags)}>
              <Icon name={showFlags ? 'close' : 'plus'} size={13} /> {unit.flags.length} ghi chú về nội dung cần kiểm tra
            </button>
            {showFlags && <ul className="mt-2 space-y-3">{unit.flags.map((f) => <li key={f.where} className="t-small text-ink2"><span className="t-label mr-2">{f.severity}</span><b>{f.where}</b> — {f.issue}</li>)}</ul>}
          </section>
        )}
      </Page>
      <PageViewer pdf={page} onClose={() => setPage(null)} />
    </>
  );
}

/** Seven fine ticks; completed steps in the issue's accent. */
export function Ladder({ step, accent }: { step: number; accent: string }) {
  return (
    <div className="flex shrink-0 items-end gap-[4px] self-center" aria-label={`Đã mở ${step} trên 7 bậc`}>
      {Array.from({ length: 7 }, (_, i) => (
        <span key={i} className="w-px" style={{ height: 8 + i * 2, background: i < step ? accent : 'var(--rule-strong)' }} />
      ))}
    </div>
  );
}
