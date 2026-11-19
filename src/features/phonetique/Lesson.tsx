import { Link, useParams } from 'react-router-dom';
import { LAB } from '../../content/frLab';
import { useUnit } from '../../engine/content';
import { Kicker, Page, Rule, TopBar } from '../../ui/kit';
import { accentFor } from '../library/bookUnits';
import { AudioChip } from '../shared/AudioChip';

export default function Lesson() {
  const { lessonId = '' } = useParams();
  const [scope, id] = lessonId.split(':');
  return scope === 'core' ? <CoreLesson id={id} /> : <UnitLesson unitId={scope} pid={id} />;
}

function Para({ text }: { text: string }) {
  return <>{text.split('\n').map((l, i) => <p key={i} className="mt-2 text-[15px] leading-relaxed">{l}</p>)}</>;
}

function CoreLesson({ id }: { id: string }) {
  const l = LAB.find((x) => x.id === id);
  if (!l) return null;
  return (
    <>
      <TopBar back="/lab" kicker="Phonétique Lab" title={l.title} />
      <Page>
        <h1 className="display mt-6 text-[50px] leading-[0.9]">{l.title}</h1>
        {l.ipa.length > 0 && <div className="ipa mt-2 text-xl text-[var(--cobalt)]">/{l.ipa.join('/  /')}/</div>}
        <p className="serif vi mt-4 text-[20px] italic leading-snug text-[var(--accent)]">{l.oneLiner}</p>
        <section className="mt-4"><Para text={l.explanationVi} /></section>
        <section className="mt-6">
          <Kicker>Miệng, lưỡi, môi</Kicker>
          <ol className="mt-2 space-y-3">
            {l.articulation.map((a, i) => (
              <li key={i} className="flex gap-3 text-[15px] leading-relaxed"><span className="serif text-2xl leading-none text-[var(--cobalt)]">{i + 1}</span><span>{a}</span></li>
            ))}
          </ol>
        </section>
        {l.vnGood && <div className="mt-5 border-l-4 py-1 pl-3 text-[15px]" style={{ borderColor: 'var(--ok)' }}><Kicker>Tiếng Việt giúp được</Kicker>{l.vnGood}</div>}
        {l.vnWarn && <div className="mt-3 border-l-4 py-1 pl-3 text-[15px]" style={{ borderColor: 'var(--tomato)' }}><Kicker>Coi chừng</Kicker>{l.vnWarn}</div>}
        {l.pairs.length > 0 && (
          <section className="mt-8">
            <Kicker>Cặp tối thiểu</Kicker>
            <Rule className="mt-1" />
            {l.pairs.map((p) => (
              <div key={p.a + p.b} className="grid grid-cols-2 gap-3 border-b hairline py-3">
                {([[p.a, p.ipaA, p.viA, p.audioA], [p.b, p.ipaB, p.viB, p.audioB]] as const).map(([w, ipa, vi, audio]) => (
                  <div key={w} className="flex items-center gap-2">
                    <AudioChip audio={audio ?? null} tts={w} />
                    <div className="min-w-0"><div className="serif text-[22px] leading-none">{w}</div><div className="ipa text-[12px] text-muted">/{ipa}/{vi ? ` · ${vi}` : ''}</div></div>
                  </div>
                ))}
              </div>
            ))}
          </section>
        )}
        <div className="mt-8 grid gap-2">
          {l.pairs.length > 0 && <Link to={`/lab/pairs/core:${l.id}?mode=listen`} className="btn btn-ink">Nghe và chọn ({l.pairs.length} cặp)</Link>}
          <Link to={`/lab/pairs/core:${l.id}?mode=say`} className="btn btn-ghost">Nói và ghi âm{l.focusPitch ? ' · xem ngữ điệu' : ''}</Link>
          {l.linkSpeller && <Link to="/lab/spell" className="btn btn-ghost">Luyện đánh vần</Link>}
        </div>
      </Page>
    </>
  );
}

function UnitLesson({ unitId, pid }: { unitId: string; pid: string }) {
  const unit = useUnit(unitId);
  const p = unit?.phonetics.find((x) => x.id === pid);
  if (!unit || !p) return null;
  const accent = accentFor(unit.number);
  const docs = unit.docs.filter((d) => d.trackId && p.trackIds.includes(d.trackId));
  return (
    <>
      <TopBar back="/lab" kicker={`Unité ${unit.number} · Phonétique · p. ${p.printedPage}`} title={p.title} />
      <Page>
        <h1 className="display mt-6 text-[46px] leading-[0.92]" style={{ color: accent }}>{p.title}</h1>
        {p.bookRule && <blockquote className="serif mt-4 border-l-2 pl-3 text-[19px] leading-snug" style={{ borderColor: accent }}>{p.bookRule}<div className="kicker mt-1">Sách, p. {p.printedPage}</div></blockquote>}
        {p.bookNote && <p className="serif mt-4 text-[19px]">{p.bookNote}</p>}
        <section className="mt-4"><Para text={p.explanationVi} /></section>
        <section className="mt-6"><Kicker>Cách luyện</Kicker><Para text={p.articulationVi} /></section>
        {p.misleadingMappingVi && <div className="mt-5 border-l-4 py-1 pl-3" style={{ borderColor: 'var(--tomato)' }}><Kicker>Coi chừng</Kicker><Para text={p.misleadingMappingVi} /></div>}
        {p.letters && (
          <section className="mt-8">
            <Kicker>Bảng chữ cái (audio của sách)</Kicker>
            <div className="mt-2 grid grid-cols-4 gap-px bg-[var(--rule)]">
              {p.letters.map((le) => (
                <div key={le.l} className="flex flex-col items-center bg-paper py-2">
                  <span className={`display text-3xl ${['G', 'J', 'E', 'I'].includes(le.l) ? 'text-[var(--accent)]' : ''}`}>{le.l}</span>
                  <span className="ipa text-[12px] text-muted">{le.ipa}</span>
                  <div className="mt-1"><AudioChip audio={{ trackId: p.trackIds[0], segIdx: le.segIdx }} tts={le.l} /></div>
                </div>
              ))}
            </div>
          </section>
        )}
        {docs.length > 0 && (
          <section className="mt-8">
            <Kicker>Luyện với audio của bài</Kicker>
            <Rule className="mt-1" />
            {docs.map((d) => (
              <Link key={d.id} to={`/studio/${unit.id}/${d.id}`} className="flex items-center justify-between border-b hairline py-3">
                <span className="text-[15px]">{d.title}</span><span className="text-[12px] text-muted">Studio →</span>
              </Link>
            ))}
          </section>
        )}
        {p.minimalPairs.length > 0 && <Link to={`/lab/pairs/${unit.id}:${p.id}?mode=listen`} className="btn btn-ink mt-6 w-full">Nghe và chọn</Link>}
      </Page>
    </>
  );
}
