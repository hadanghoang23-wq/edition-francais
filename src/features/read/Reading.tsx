import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTrack, useUnit, useUnits } from '../../engine/content';
import type { DocRef, Unit } from '../../engine/types';
import { Empty, Kicker, Loading, Options, Page, Row, Section, TopBar, two } from '../../ui/kit';
import { SegButton } from '../exercises/parts';
import { TappableText } from '../shared/WordSheet';

const readable = (u: Unit) => u.docs.filter((d) => (d.kind === 'text' && d.lines?.length) || (d.trackId && (d.kind === 'dialogue' || d.kind === 'document')));
const questionsFor = (u: Unit, d: DocRef) => u.exercises.filter((e) => !e.needsDvd && ((e as { docId?: string }).docId === d.id || (d.trackId && e.trackId === d.trackId)) && ['comprehension-ecrite', 'comprehension-orale'].includes(e.skill));

export function ReadHome() {
  const units = useUnits();
  if (!units) return <Loading />;
  return (
    <>
      <TopBar back="/practice" kicker="Compréhension écrite" title="Đọc" />
      <Page>
        <h1 className="t-display mt-10">Lire</h1>
        <p className="t-small measure mt-2 text-ink2">Văn bản và hội thoại của sách. Chạm vào bất kỳ từ nào để xem nghĩa, IPA, giống, nghe phát âm và thêm vào thẻ ôn.</p>
        {units.length === 0 && <Empty kicker="Chưa có bài" title="Rien à lire." body="Nhập gói nội dung để có văn bản." to="/import" cta="Nhập gói" />}
        {units.map((u) => (
          <Section key={u.id} n={two(u.number)} title={<span className="serif normal-case tracking-normal text-[20px] italic text-ink">{u.title}</span>}>
            {readable(u).map((d) => (
              <Row key={d.id} to={`/practice/read/${u.id}/${d.id}`} title={<span className="serif text-[18px]">{d.title}</span>}
                sub={<span className="t-meta">p. {d.printedPage} · {d.kind === 'text' ? 'văn bản' : 'hội thoại'}{questionsFor(u, d).length ? ` · ${questionsFor(u, d).length} câu hỏi` : ''}</span>} />
            ))}
          </Section>
        ))}
      </Page>
    </>
  );
}

export function Reader() {
  const { unitId, docId } = useParams();
  const unit = useUnit(unitId);
  const doc = unit?.docs.find((d) => d.id === docId);
  const track = useTrack(doc?.trackId);
  const [vi, setVi] = useState<'off' | 'on'>('off');
  if (unit === undefined) return <Loading />;
  if (!unit || !doc) return <Loading label="Không tìm thấy văn bản" />;
  const lines = doc.lines ?? track?.segments.map((s) => ({ speaker: s.speaker ?? undefined, text: s.text, vi: s.vi ?? '', segIdx: s.idx })) ?? [];
  const qs = questionsFor(unit, doc);
  let last: string | undefined;
  return (
    <>
      <TopBar back="/practice/read" kicker={`Unité ${unit.number} · Lecture`} right={<span className="t-label">p. {doc.printedPage}</span>} />
      <Page>
        <h1 className="t-title mt-10 italic">{doc.title}</h1>
        <div className="mt-6 flex items-center justify-between"><Kicker>Chạm một từ để tra</Kicker><Options value={vi} onChange={setVi} options={[['off', 'FR'], ['on', 'FR + VI']]} /></div>
        <div className="rule mt-2" />
        <article className="mt-6">
          {lines.map((l, i) => {
            const showSpeaker = l.speaker && l.speaker !== last;
            last = l.speaker ?? last;
            return (
              <div key={i} className={showSpeaker ? 'pt-5' : 'pt-2'}>
                {showSpeaker && <Kicker className="mb-1">{l.speaker}</Kicker>}
                <div className="flex items-start gap-2">
                  <p className="t-fr measure flex-1"><TappableText text={l.text} /></p>
                  {'segIdx' in l && doc.trackId && <SegButton trackId={doc.trackId} segIdx={(l as { segIdx: number }).segIdx} />}
                </div>
                {vi === 'on' && l.vi && <p className="t-small mt-1 text-ink2">{l.vi}</p>}
              </div>
            );
          })}
        </article>
        {qs.length > 0 && (
          <Section n="01" title="Questions du livre" meta={`${qs.length} câu`}>
            {qs.map((e) => (
              <Row key={e.id} to={`/practice/${e.skill === 'comprehension-orale' ? 'nghe' : 'doc'}/${unit.id}/${e.id}`} n={e.number} title={<span className="serif text-[18px]">{e.instructionFr}</span>} sub={<span className="t-meta">{e.instructionVi}</span>} />
            ))}
          </Section>
        )}
        <div className="mt-10"><Link className="btn btn-line w-full" to="/practice/read">Văn bản khác</Link></div>
      </Page>
    </>
  );
}
