import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { audioContext, decodeBlob, decodeTrack, playBlob, SegmentPlayer, sleep, sliceMono, unlockAudio } from '../../engine/audio';
import { bumpStat, db, type RecordingRow } from '../../engine/db';
import { compareIntonation, dtwAlign, extractContour, normalise, type IntonationReport } from '../../engine/pitch';
import { Recorder } from '../../engine/recorder';
import { rateSentence, previewIntervals, Rating } from '../../engine/srs';
import { recognitionAvailable, recognizeOnce, wordsHeard } from '../../engine/speech';
import type { Segment } from '../../engine/types';
import { Kicker, Sheet } from '../../ui/kit';
import { LevelMeter, PitchOverlay, Waveforms } from '../../ui/viz';
import { useMic } from '../shared/useMic';

const nativeCache = new Map<string, { samples: Float32Array; contour: Float32Array }>();

async function nativeAnalysis(trackId: string, seg: Segment) {
  const key = `${trackId}#${seg.idx}@${seg.start.toFixed(3)}-${seg.end.toFixed(3)}`;
  if (!nativeCache.has(key)) {
    const buf = await decodeTrack(trackId);
    const samples = sliceMono(buf, seg.start, seg.end);
    nativeCache.set(key, { samples, contour: normalise(extractContour(samples, buf.sampleRate)) });
  }
  return nativeCache.get(key)!;
}

interface Props {
  open: boolean;
  onClose: () => void;
  trackId: string;
  unitId: string;
  seg: Segment | null;
  player: SegmentPlayer;
  ladderStep: number;
}

export default function SentenceSheet({ open, onClose, trackId, unitId, seg, player, ladderStep }: Props) {
  const segKey = seg ? `${trackId}#${seg.idx}` : '';
  const recs = useLiveQuery(async () => (segKey ? db.recordings.where('segKey').equals(segKey).sortBy('createdAt') : []), [segKey]);
  const card = useLiveQuery(async () => (segKey ? db.cards.get(`${segKey}|sentence`) : undefined), [segKey]);
  const [native, setNative] = useState<{ samples: Float32Array; contour: Float32Array } | null>(null);
  const [mine, setMine] = useState<{ samples: Float32Array; aligned: Float32Array; report: IntonationReport; blob: Blob } | null>(null);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [heard, setHeard] = useState<string | null>(null);
  const [rated, setRated] = useState(false);
  const [editing, setEditing] = useState(false);
  const recorder = useRef(new Recorder());
  const autoStop = useRef<number>(0);
  const mic = useMic();

  useEffect(() => {
    setMine(null); setHeard(null); setRated(false); setEditing(false);
    if (!open || !seg) return;
    let alive = true;
    nativeAnalysis(trackId, seg).then((n) => alive && setNative(n)).catch(() => undefined);
    return () => { alive = false; };
  }, [open, seg, trackId]);

  const analyse = useCallback(async (blob: Blob) => {
    if (!native) return;
    const buf = await decodeBlob(blob);
    const samples = sliceMono(buf);
    const mineC = normalise(extractContour(samples, buf.sampleRate));
    const aligned = dtwAlign(native.contour, mineC);
    setMine({ samples, aligned, report: compareIntonation(native.contour, aligned), blob });
  }, [native]);

  // Show the latest recording when the sheet opens.
  useEffect(() => {
    if (open && native && recs?.length && !mine) analyse(recs[recs.length - 1].blob).catch(() => undefined);
  }, [open, native, recs, mine, analyse]);

  if (!seg) return null;
  const dur = seg.end - seg.start;

  const playNative = async () => { await unlockAudio(); await player.load(trackId); await player.playSegment(seg); };

  const startRec = async () => {
    await unlockAudio();
    if (!(await mic.ensure())) return;
    player.stop();
    await recorder.current.start(audioContext());
    setRecording(true);
    autoStop.current = window.setTimeout(stopRec, Math.max(3000, dur * 2500 + 1500));
  };
  const stopRec = async () => {
    clearTimeout(autoStop.current);
    if (!recorder.current.recording) return;
    const r = await recorder.current.stop();
    setRecording(false);
    const row: RecordingRow = { segKey, kind: 'sentence', ladderStep, blob: r.blob, mime: r.mime, durationMs: r.durationMs, createdAt: new Date() };
    await db.recordings.add(row);
    await bumpStat({ sentences: 1 });
    setBusy('Đang phân tích ngữ điệu…');
    await analyse(r.blob).catch(() => undefined);
    setBusy(null);
  };

  const ab = async () => {
    if (!mine) return;
    await playNative();
    await sleep(300);
    await playBlob(mine.blob).done;
  };

  const check = async () => {
    setBusy('Đang nghe… hãy đọc câu');
    try { setHeard(await recognizeOnce('fr-FR')); } catch { setHeard(''); }
    setBusy(null);
  };

  const rate = async (g: number) => {
    await rateSentence(segKey, unitId, g as any);
    setRated(true);
  };

  const intervals = card ? previewIntervals(card) : null;

  return (
    <Sheet open={open} onClose={() => { if (recording) stopRec(); onClose(); }} title={seg.speaker ? `${seg.speaker}` : `Câu ${seg.idx + 1}`}>
      {mic.sheet}
      <p className="serif text-[26px] leading-tight">{seg.text}</p>
      {seg.vi && <p className="mt-1 text-[14px] text-muted">{seg.vi}</p>}

      <div className="mt-4">
        <div className="flex items-center justify-between"><Kicker>Dạng sóng</Kicker><Kicker><span className="text-ink">▲ gốc</span> · <span className="text-[var(--tomato)]">▼ bạn</span></Kicker></div>
        <Waveforms native={native?.samples} mine={mine?.samples} />
      </div>
      <div className="mt-3">
        <div className="flex items-center justify-between"><Kicker>Ngữ điệu</Kicker><Kicker><span className="text-[var(--cobalt)]">— gốc</span> · <span className="text-[var(--tomato)]">- - bạn</span></Kicker></div>
        <PitchOverlay native={native?.contour} mine={mine?.aligned} />
        {mine && <p className="mt-2 text-[14px] leading-snug">{mine.report.verdictVi}{!Number.isNaN(mine.report.meanDiff) && <span className="text-muted"> (lệch trung bình {mine.report.meanDiff.toFixed(1)} nửa cung)</span>}</p>}
        {!mine && <p className="mt-2 text-[13px] text-muted">Ghi âm để thấy đường ngữ điệu của bạn chồng lên bản gốc. Tiếng Pháp không có thanh điệu: đường của bạn nên phẳng trên từng âm tiết, chỉ đổi ở cuối nhóm nhịp.</p>}
      </div>

      {recording && <div className="mt-3"><LevelMeter active={recording} getLevel={() => recorder.current.level} /></div>}
      {busy && <p className="mt-2 animate-pulse text-[14px]">{busy}</p>}
      {mic.error && <p className="mt-2 text-[14px] text-[var(--tomato)]">{mic.error}</p>}

      <div className="mt-4 grid grid-cols-3 gap-2">
        <button className="btn btn-ghost" onClick={playNative}>▶ Gốc</button>
        <button className={`btn ${recording ? 'btn-accent' : 'btn-ink'}`} onClick={recording ? stopRec : startRec}>{recording ? '◼ Dừng' : '● Ghi'}</button>
        <button className="btn btn-ghost" disabled={!mine} onClick={ab}>A / B</button>
      </div>
      {mine && <button className="btn btn-ghost mt-2 w-full" onClick={() => playBlob(mine.blob)}>▶ Nghe giọng tôi</button>}

      {recognitionAvailable() && (
        <div className="mt-4">
          <button className="chip" onClick={check}>Kiểm tra bằng nhận dạng giọng nói</button>
          {heard !== null && (
            <p className="serif mt-2 text-[20px] leading-snug">
              {heard === '' ? <span className="text-[15px] text-muted">Không nghe thấy gì.</span> :
                wordsHeard(seg.text, heard).map((w, i) => w.space ? w.tok : <span key={i} className={w.ok ? '' : 'text-[var(--tomato)] underline decoration-2'}>{w.tok}</span>)}
            </p>
          )}
        </div>
      )}

      <div className="mt-6">
        <Kicker>Câu này khó với bạn thế nào?</Kicker>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {[[Rating.Again, 'Lại'], [Rating.Hard, 'Khó'], [Rating.Good, 'Được'], [Rating.Easy, 'Dễ']].map(([g, l]) => (
            <button key={g} className="btn btn-ghost flex-col !gap-0 px-1 py-1" disabled={rated} onClick={() => rate(g as number)}>
              <span>{l}</span>{intervals && <span className="text-[11px] text-muted">{intervals[g as number]}</span>}
            </button>
          ))}
        </div>
        {rated && <p className="mt-2 text-[13px] text-muted">Đã lưu. Câu khó sẽ quay lại sớm hơn trong phần ôn tập.</p>}
      </div>

      <div className="mt-6 flex items-center justify-between border-t hairline pt-3 text-[13px]">
        <span className="text-muted">{recs?.length ?? 0} bản ghi{recs?.length ? ` · lần đầu ${recs[0].createdAt.toLocaleDateString('vi-VN')}` : ''}</span>
        <div className="flex gap-3">
          {(recs?.length ?? 0) >= 2 && <Link className="underline" to={`/then-now?seg=${encodeURIComponent(segKey)}`}>Trước / Nay</Link>}
          <button className="underline" onClick={() => setEditing(!editing)}>Chỉnh mốc</button>
        </div>
      </div>
      {editing && <BoundaryEditor trackId={trackId} seg={seg} player={player} onSaved={() => setEditing(false)} />}
      <div className="h-4" />
    </Sheet>
  );
}

function BoundaryEditor({ trackId, seg, player, onSaved }: { trackId: string; seg: Segment; player: SegmentPlayer; onSaved: () => void }) {
  const [start, setStart] = useState(seg.start);
  const [end, setEnd] = useState(seg.end);
  const key = `${trackId}#${seg.idx}`;
  const hasOverride = useLiveQuery(() => db.overrides.get(key), [key]);
  const fmt = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}`;
  const nudges = useMemo(() => [-0.05, -0.01, 0.01, 0.05], []);
  const row = (label: string, v: number, set: (x: number) => void) => (
    <div className="flex items-center gap-2 py-1">
      <span className="w-14 text-[13px] text-muted">{label}</span>
      <span className="w-20 font-mono text-[14px] tabular-nums">{fmt(v)}</span>
      {nudges.map((d) => <button key={d} className="chip flex-1 px-1" onClick={() => set(Math.max(0, +(v + d).toFixed(3)))}>{d > 0 ? '+' : '−'}{Math.abs(d * 1000)}</button>)}
    </div>
  );
  return (
    <div className="mt-3 border hairline p-3">
      <Kicker>Chỉnh mốc câu (ms)</Kicker>
      {row('Bắt đầu', start, setStart)}
      {row('Kết thúc', end, setEnd)}
      <div className="mt-2 grid grid-cols-3 gap-2">
        <button className="btn btn-ghost" onClick={async () => { await player.load(trackId); await player.playRange(start, end); }}>▶ Thử</button>
        <button className="btn btn-ink" onClick={async () => { await db.overrides.put({ key, trackId, idx: seg.idx, start, end, updatedAt: new Date() }); onSaved(); }}>Lưu</button>
        <button className="btn btn-ghost" disabled={!hasOverride} onClick={async () => { await db.overrides.delete(key); onSaved(); }}>Gốc</button>
      </div>
      <p className="mt-2 text-[12px] text-muted">Các chỉnh sửa có thể xuất ra trong Cài đặt để cập nhật pipeline trên laptop.</p>
    </div>
  );
}
