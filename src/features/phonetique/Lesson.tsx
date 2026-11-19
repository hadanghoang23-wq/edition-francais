import { Link, useParams } from 'react-router-dom';
import { LAB } from '../../content/frLab';
import { useUnit } from '../../engine/content';
import { Kicker, Loading, Page, Section, TopBar, two, WithIpa } from '../../ui/kit';
import { Icon } from '../../ui/icons';
import { accentFor } from '../library/bookUnits';
import { AudioChip } from '../shared/AudioChip';

export default function Lesson() {
  const { lessonId = '' } = useParams();
  const [scope, id] = lessonId.split(':');
  return scope === 'core' ? <CoreLesson id={id} /> : <UnitLesson unitId={scope} pid={id} />;
}

function Para({ text }: { text: string }) {
  return <>{text.split('\n').map((l, i) => <p key={i} className="t-body measure mt-3 text-ink2"><WithIpa text={l} /></p>)}</>;
}

function Note({ label, tone, children }: { label: string; tone: 'ok' | 'warn'; children: React.ReactNode }) {
  return (
    <div className="mt-8">
      <div className="flex items-center gap-3">
        <span className="h-px w-6" style={{ background: tone === 'ok' ? 'var(--ok)' : 'var(--accent)' }} />
        <span className="t-label" style={{ color: tone === 'ok' ? 'var(--ok)' : 'var(--accent)' }}>{label}</span>
      </div>
      <div className="t-body measure mt-2 text-ink">{children}</div>
    </div>
  );
}

function CoreLesson({ id }: { id: string }) {
  const l = LAB.find((x) => x.id === id);
  if (!l) return <Loading label="Không tìm thấy bài" />;
  return (
    <>
      <TopBar back="/lab" kicker="Phonétique" title="Leçon" />
      <Page>
        <h1 className="t-display mt-10"><WithIpa text={l.title} /></h1>
        {l.ipa.length > 0 && <div className="ipa mt-3 !text-[15px]">/{l.ipa.join('/   /')}/</div>}
        <p className="t-body mt-4 text-accent">{l.oneLiner}</p>
        <div className="gold-rule mt-8" />
        <section className="mt-4"><Para text={l.explanationVi} /></section>

        <Section n="01" title="Miệng, lưỡi, môi">
          <ol className="mt-4 space-y-5">
            {l.articulation.map((a, i) => (
              <li key={i} className="flex gap-4"><span className="t-num w-6 shrink-0 text-[19px] text-accent">{two(i + 1)}</span><span className="t-body measure text-ink">{a}</span></li>
            ))}
          </ol>
        </Section>
        {l.vnGood && <Note label="Tiếng Việt giúp được" tone="ok">{l.vnGood}</Note>}
        {l.vnWarn && <Note label="Coi chừng" tone="warn">{l.vnWarn}</Note>}

        {l.pairs.length > 0 && (
          <Section n="02" title="Paires minimales" meta={`${l.pairs.length} cặp`}>
            {l.pairs.map((p) => (
              <div key={p.a + p.b} className="grid grid-cols-2 gap-4 border-b border-[var(--rule)] py-4">
                {([[p.a, p.ipaA, p.viA, p.audioA], [p.b, p.ipaB, p.viB, p.audioB]] as const).map(([w, ipa, vi, audio]) => (
                  <div key={w} className="flex items-start gap-1">
                    <div className="min-w-0 flex-1">
                      <div className="serif text-[24px] leading-none">{w}</div>
                      <div className="ipa mt-1.5">/{ipa}/</div>
                      {vi && <div className="t-meta mt-0.5 truncate">{vi}</div>}
                    </div>
                    <AudioChip audio={audio ?? null} tts={w} />
                  </div>
                ))}
              </div>
            ))}
          </Section>
        )}
        <div className="mt-10 grid gap-3">
          {l.pairs.length > 0 && <Link to={`/lab/pairs/core:${l.id}?mode=listen`} className="btn btn-primary"><Icon name="ear" size={16} />Nghe và chọn</Link>}
          <Link to={`/lab/pairs/core:${l.id}?mode=say`} className="btn btn-line"><Icon name="mic" size={15} />Nói và ghi âm{l.focusPitch ? ' · ngữ điệu' : ''}</Link>
          {l.linkSpeller && <Link to="/lab/spell" className="btn btn-line">Luyện đánh vần</Link>}
        </div>
      </Page>
    </>
  );
}

function UnitLesson({ unitId, pid }: { unitId: string; pid: string }) {
  const unit = useUnit(unitId);
  const p = unit?.phonetics.find((x) => x.id === pid);
  if (unit === undefined) return <Loading />;
  if (!unit || !p) return <Loading label="Không tìm thấy bài" />;
  const accent = accentFor(unit.number);
  const docs = unit.docs.filter((d) => d.trackId && p.trackIds.includes(d.trackId));
  return (
    <>
      <TopBar back="/lab" kicker={`Unité ${unit.number} · Phonétique`} right={<span className="t-label">p. {p.printedPage}</span>} />
      <Page>
        <h1 className="t-display mt-10">{p.title}</h1>
        <div className="mt-6 h-px w-12" style={{ background: accent }} />
        {p.bookRule && (
          <blockquote className="mt-8">
            <p className="t-gloss text-[20px] leading-snug">{p.bookRule}</p>
            <Kicker className="mt-3">Sách, p. {p.printedPage}</Kicker>
          </blockquote>
        )}
        {p.bookNote && <p className="t-gloss mt-6 text-[20px]">{p.bookNote}</p>}
        <section className="mt-4"><Para text={p.explanationVi} /></section>
        <Section n="01" title="Cách luyện"><Para text={p.articulationVi} /></Section>
        {p.misleadingMappingVi && <Note label="Coi chừng" tone="warn"><Para text={p.misleadingMappingVi} /></Note>}
        {p.letters && (
          <Section n="02" title="L'alphabet · audio của sách">
            <div className="mt-2 grid grid-cols-4">
              {p.letters.map((le) => (
                <div key={le.l} className="flex flex-col items-center border-b border-[var(--rule)] py-3">
                  <span className="serif text-[34px] leading-none" style={{ color: ['G', 'J', 'E', 'I'].includes(le.l) ? 'var(--accent)' : undefined }}>{le.l}</span>
                  <span className="ipa mt-1 !text-[11px]">{le.ipa}</span>
                  <AudioChip audio={{ trackId: p.trackIds[0], segIdx: le.segIdx }} tts={le.l} />
                </div>
              ))}
            </div>
          </Section>
        )}
        {docs.length > 0 && (
          <Section n={p.letters ? '03' : '02'} title="Luyện với audio của bài">
            {docs.map((d) => (
              <Link key={d.id} to={`/studio/${unit.id}/${d.id}`} className="flex min-h-[56px] items-center justify-between border-b border-[var(--rule)] py-3">
                <span className="serif text-[18px]">{d.title}</span><span className="t-label flex items-center gap-1">Studio <Icon name="forward" size={14} /></span>
              </Link>
            ))}
          </Section>
        )}
        {p.minimalPairs.length > 0 && <Link to={`/lab/pairs/${unit.id}:${p.id}?mode=listen`} className="btn btn-primary mt-10 w-full"><Icon name="ear" size={16} />Nghe và chọn</Link>}
      </Page>
    </>
  );
}
