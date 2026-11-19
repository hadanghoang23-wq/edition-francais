import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useOffset, usePageUrl, useUnit } from '../../engine/content';
import { db } from '../../engine/db';
import { Kicker, Page, Rule, Sheet, TopBar } from '../../ui/kit';
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
      {url ? <img src={url} alt="Trang sách" className="mb-4 w-full border hairline" /> : <p className="py-8 text-muted">Trang này không có trong gói.</p>}
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
  if (!unit) return null;
  const accent = accentFor(unit.number);
  const shadowDocs = unit.docs.filter((d) => d.shadowing && d.trackId);

  return (
    <>
      <TopBar back="/library" kicker={`Unité ${unit.number}`} title={unit.title} />
      <div className="relative overflow-hidden px-4 pb-8 pt-6 text-white" style={{ background: accent }}>
        <div className="mx-auto max-w-[640px]">
          <div className="flex items-baseline justify-between">
            <span className="kicker" style={{ color: 'rgba(255,255,255,.85)' }}>Numéro {String(unit.number).padStart(2, '0')} / 12</span>
            <span className="kicker" style={{ color: 'rgba(255,255,255,.85)' }}>p. {unit.printedPages[0]}–{unit.printedPages[1]}</span>
          </div>
          <h1 className="display mt-8 text-[72px] leading-[0.85]">{unit.title}</h1>
          {unit.titleVi && <div className="serif vi mt-2 text-2xl italic opacity-90">{unit.titleVi}</div>}
          {unit.subtitle && <p className="mt-6 max-w-[34ch] text-[14px] leading-snug opacity-90">{unit.subtitle}</p>}
          <button className="mt-6 border border-white/70 px-3 py-2 text-[13px]" onClick={() => setPage(unit.printedPages[0] + offset)}>Xem trang mở đầu</button>
        </div>
        <div className="display pointer-events-none absolute -bottom-10 -right-4 text-[220px] leading-none opacity-15">{unit.number}</div>
      </div>
      <Page>
        {unit.objectives && (
          <section className="mt-6">
            <Kicker>Mục tiêu</Kicker>
            <ul className="mt-2 space-y-1 text-[15px]">{unit.objectives.map((o) => <li key={o}>— {o}</li>)}</ul>
          </section>
        )}

        <section className="mt-8">
          <div className="flex items-baseline justify-between"><h2 className="display text-3xl">Shadowing</h2><Kicker>{shadowDocs.length} bài</Kicker></div>
          <Rule className="mt-2" />
          {shadowDocs.map((d) => {
            const step = ladders?.find((l) => l.docId === `${unit.id}:${d.id}`)?.unlocked ?? 0;
            return (
              <Link key={d.id} to={`/studio/${unit.id}/${d.id}`} className="flex items-center gap-3 border-b hairline py-3">
                <span className="serif w-8 text-2xl" style={{ color: accent }}>{d.trackId?.slice(1).replace(/^0+/, '')}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-medium">{d.title}</div>
                  <div className="text-[12px] text-muted">p. {d.printedPage} · bước {Math.min(7, step + 1)}/7</div>
                </div>
                <Ladder step={step} accent={accent} />
              </Link>
            );
          })}
        </section>

        <section className="mt-8">
          <h2 className="display vi text-3xl">Ngữ pháp</h2>
          <Rule className="mt-2" />
          {unit.grammar.map((g) => (
            <Link key={g.id} to={`/unit/${unit.id}/grammar/${g.id}`} className="flex items-center justify-between border-b hairline py-3">
              <span className="text-[15px] font-medium">{g.title}</span><span className="text-[12px] text-muted">p. {g.printedPage} →</span>
            </Link>
          ))}
        </section>

        <section className="mt-8">
          <h2 className="display vi text-3xl">Ngữ âm</h2>
          <Rule className="mt-2" />
          {unit.phonetics.map((p) => (
            <Link key={p.id} to={`/lab/lesson/${unit.id}:${p.id}`} className="flex items-center justify-between border-b hairline py-3">
              <span className="text-[15px] font-medium">{p.title}</span><span className="text-[12px] text-muted">p. {p.printedPage} →</span>
            </Link>
          ))}
        </section>

        <section className="mt-8">
          <h2 className="display vi text-3xl">Các mục trong bài</h2>
          <Rule className="mt-2" />
          {unit.sections.map((s) => (
            <button key={s.id} className="flex w-full items-center gap-3 border-b hairline py-3 text-left" onClick={() => setPage(s.printedPage + offset)}>
              <span className="kicker w-20 shrink-0">{KIND_VI[s.kind] ?? s.kind}</span>
              <span className="min-w-0 flex-1 truncate text-[15px]">{s.title}{s.needsDvd ? ' · (DVD)' : ''}</span>
              <span className="text-[12px] text-muted">p. {s.printedPage}</span>
            </button>
          ))}
        </section>

        <section className="mt-8">
          <div className="grid grid-cols-3 gap-px bg-[var(--rule)] text-center">
            {[[unit.vocab.length + (unit.countries?.length ?? 0), 'từ'], [unit.exercises.length, 'bài tập'], [unit.grammar.length, 'điểm ngữ pháp']].map(([n, l]) => (
              <div key={String(l)} className="bg-paper py-4"><div className="display text-4xl">{n}</div><div className="kicker mt-1">{l}</div></div>
            ))}
          </div>
          <Link to="/cards" className="btn btn-ghost mt-3 w-full">Ôn từ vựng của bài này</Link>
        </section>

        {unit.flags.length > 0 && (
          <section className="mt-8">
            <button className="kicker" onClick={() => setShowFlags(!showFlags)}>{showFlags ? '▾' : '▸'} {unit.flags.length} ghi chú về nội dung cần bạn kiểm tra</button>
            {showFlags && <ul className="mt-2 space-y-2 text-[13px] leading-snug text-muted">{unit.flags.map((f) => <li key={f.where}>[{f.severity}] <b>{f.where}</b> — {f.issue}</li>)}</ul>}
          </section>
        )}
      </Page>
      <PageViewer pdf={page} onClose={() => setPage(null)} />
    </>
  );
}

export function Ladder({ step, accent }: { step: number; accent: string }) {
  return (
    <div className="flex items-end gap-[3px]" aria-label={`Đã mở ${step} trên 7 bước`}>
      {Array.from({ length: 7 }, (_, i) => (
        <span key={i} className="w-[5px]" style={{ height: 6 + i * 2.5, background: i < step ? accent : 'var(--rule)' }} />
      ))}
    </div>
  );
}
