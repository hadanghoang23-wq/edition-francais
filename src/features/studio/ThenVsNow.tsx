import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { decodeBlob, playBlob, sliceMono, unlockAudio } from '../../engine/audio';
import { segmentByRef } from '../../engine/content';
import { db, type RecordingRow } from '../../engine/db';
import { Empty, Kicker, Page, Rule, TopBar } from '../../ui/kit';
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
      <TopBar back="/studio" kicker="Studio" title="Trước và nay" />
      <Page>
        <h1 className="display vi mt-6 text-[48px]">Trước <i>&</i> nay.</h1>
        <p className="mt-2 text-[14px] text-muted">Bản ghi đầu tiên và mới nhất của cùng một câu. Nghe để thấy mình đã tiến bộ thế nào.</p>
        {groups && groups.length === 0 && <Empty title="Chưa đủ bản ghi." body="Ghi âm một câu ít nhất hai lần (ở các ngày khác nhau càng tốt) để so sánh." to="/studio" cta="Mở Studio" />}
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
    <section className="mt-8">
      <div className="flex items-start gap-2">
        <p className="serif flex-1 text-[22px] leading-snug">{text}</p>
        {!isTake && trackId && <AudioChip audio={{ trackId, segIdx: Number(idx) }} label="▶ gốc" />}
      </div>
      <Kicker>{count} bản ghi</Kicker>
      <Rule className="mt-2" />
      {[['Trước', first], ['Nay', last]].map(([label, r]) => {
        const rec = r as RecordingRow;
        return (
          <div key={label as string} className="flex items-center gap-3 border-b hairline py-3">
            <div className="w-16"><div className="display vi text-2xl">{label as string}</div><div className="text-[11px] text-muted">{d(rec.createdAt)}</div></div>
            <div className="min-w-0 flex-1">{waves && <Waveforms native={label === 'Trước' ? waves[0] : waves[1]} height={40} />}</div>
            <button className="chip" onClick={async () => { await unlockAudio(); playBlob(rec.blob); }}>▶</button>
          </div>
        );
      })}
    </section>
  );
}
