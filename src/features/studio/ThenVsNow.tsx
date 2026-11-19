import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { decodeBlob, playBlob, sliceMono, unlockAudio } from '../../engine/audio';
import { segmentByRef } from '../../engine/content';
import { db, type RecordingRow } from '../../engine/db';
import { Empty, Kicker, Loading, Page, TopBar } from '../../ui/kit';
import { Icon } from '../../ui/icons';
import { Waveforms } from '../../ui/viz';
import { AudioChip } from '../shared/AudioChip';

/** "Then vs Now": your first and your latest take of the same sentence (or full-dialogue take). */
export default function ThenVsNow() {
  const [params] = useSearchParams();
  const focus = params.get('seg');
  const groups = useLiveQuery(async () => {
    const all = await db.recordings.orderBy('createdAt').toArray();
    const map = new Map<string, RecordingRow[]>();
    for (const r of all) map.set(r.segKey, [...(map.get(r.segKey) ?? []), r]);
    return [...map.entries()].filter(([, v]) => v.length >= 2)
      .sort((a, b) => (a[0] === focus ? -1 : b[0] === focus ? 1 : b[1].at(-1)!.createdAt.getTime() - a[1].at(-1)!.createdAt.getTime()));
  }, [focus]);
  return (
    <>
      <TopBar back="/studio" kicker="Studio" title="Avant · Après" />
      <Page>
        <h1 className="t-hero mt-10">Avant,<br /><span className="italic">après.</span></h1>
        <p className="t-body measure mt-6 text-ink2">Bản ghi đầu tiên và mới nhất của cùng một câu. Nghe để thấy mình đã tiến bộ thế nào.</p>
        {groups === undefined && <Loading />}
        {groups && groups.length === 0 && <Empty kicker="Chưa đủ bản ghi" title="Il faut deux prises." body="Ghi âm một câu ít nhất hai lần (ở các ngày khác nhau càng tốt) để so sánh." to="/studio" cta="Mở Studio" />}
        {groups?.map(([key, recs]) => <Pair key={key} segKey={key} first={recs[0]} last={recs[recs.length - 1]} count={recs.length} />)}
      </Page>
    </>
  );
}

function Pair({ segKey, first, last, count }: { segKey: string; first: RecordingRow; last: RecordingRow; count: number }) {
  const [text, setText] = useState<string>('');
  const [waves, setWaves] = useState<[Float32Array, Float32Array] | null>(null);
  const isTake = segKey.startsWith('take:');
  const [trackId, idx] = isTake ? [null, null] : segKey.split('#');
  useEffect(() => {
    if (!isTake && trackId) segmentByRef(trackId, Number(idx)).then((s) => setText(s?.text ?? segKey));
    else setText('Bản ghi cả đoạn');
    Promise.all([decodeBlob(first.blob), decodeBlob(last.blob)]).then(([a, b]) => setWaves([sliceMono(a), sliceMono(b)])).catch(() => undefined);
  }, [segKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const d = (x: Date) => x.toLocaleDateString('vi-VN', { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <section className="mt-12">
      <div className="flex items-start gap-2">
        <p className="t-fr flex-1">{text}</p>
        {!isTake && trackId && <AudioChip audio={{ trackId, segIdx: Number(idx) }} label="gốc" />}
      </div>
      <Kicker className="mt-2">{count} bản ghi</Kicker>
      <div className="rule mt-3" />
      {[['Avant', first], ['Après', last]].map(([label, r]) => {
        const rec = r as RecordingRow;
        return (
          <div key={label as string} className="flex items-center gap-4 border-b border-[var(--rule)] py-4">
            <div className="w-20"><div className="t-gloss text-[20px]">{label as string}</div><div className="t-meta">{d(rec.createdAt)}</div></div>
            <div className="min-w-0 flex-1">{waves && <Waveforms native={label === 'Avant' ? waves[0] : waves[1]} height={36} />}</div>
            <button className="flex h-11 w-11 items-center justify-center text-ink" aria-label="Nghe" onClick={async () => { await unlockAudio(); playBlob(rec.blob); }}><Icon name="play" size={15} /></button>
          </div>
        );
      })}
    </section>
  );
}
