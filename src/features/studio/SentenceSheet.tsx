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
import { ErrorNote, Kicker, Sheet } from '../../ui/kit';
import { Icon } from '../../ui/icons';
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
    <Sheet open={open} onClose={() => { if (recording) stopRec(); onClose(); }} title={seg.speaker ? seg.speaker : `Câu ${seg.idx + 1}`}>
      {mic.sheet}
      <p className="t-fr !text-[27px] !leading-[1.22]">{seg.text}</p>
      {seg.vi && <p className="t-small mt-2 text-ink2">{seg.vi}</p>}

      <div className="mt-8">
        <div className="flex items-baseline justify-between"><Kicker>Dạng sóng</Kicker><span className="t-label"><span className="!text-accent" style={{ color: 'var(--accent)' }}>gốc</span> · <span style={{ color: 'var(--ink)' }}>bạn</span></span></div>
        <div className="mt-3"><Waveforms native={native?.samples} mine={mine?.samples} /></div>
      </div>
      <div className="mt-6">
        <div className="flex items-baseline justify-between"><Kicker>Ngữ điệu</Kicker><span className="t-label"><span style={{ color: 'var(--accent)' }}>gốc</span> · <span style={{ color: 'var(--ink)' }}>bạn</span></span></div>
        <div className="mt-3"><PitchOverlay native={native?.contour} mine={mine?.aligned} /></div>
        {mine && <p className="t-small measure mt-3 text-ink">{mine.report.verdictVi}{!Number.isNaN(mine.report.meanDiff) && <span className="text-muted"> Lệch trung bình {mine.report.meanDiff.toFixed(1)} nửa cung.</span>}</p>}
        {!mine && <p className="t-small measure mt-3 text-ink2">Ghi âm để thấy đường ngữ điệu của bạn chồng lên bản gốc. Tiếng Pháp không có thanh điệu: đường của bạn nên phẳng trên từng âm tiết, chỉ đổi ở cuối nhóm nhịp.</p>}
      </div>

      {recording && <div className="mt-4"><LevelMeter active={recording} getLevel={() => recorder.current.level} /></div>}
      {busy && <p className="t-label breathe mt-4">{busy}</p>}
      {mic.error && <ErrorNote>{mic.error}</ErrorNote>}

      <div className="mt-8 grid grid-cols-3 border-y border-[var(--rule)]">
        <button className="flex min-h-[64px] flex-col items-center justify-center gap-1.5 text-ink" onClick={playNative}>
          <Icon name="play" size={16} /><span className="t-label !text-ink">Gốc</span>
        </button>
        <button className="flex min-h-[64px] flex-col items-center justify-center gap-1.5 border-x border-[var(--rule)] transition-colors duration-300"
          style={{ color: 'var(--accent)', background: recording ? 'var(--accent-soft)' : 'transparent' }} onClick={recording ? stopRec : startRec}>
          <Icon name={recording ? 'stop' : 'record'} size={recording ? 13 : 15} /><span className="t-label" style={{ color: 'var(--accent)' }}>{recording ? 'Dừng' : 'Ghi'}</span>
        </button>
        <button className="flex min-h-[64px] flex-col items-center justify-center gap-1.5 text-ink disabled:opacity-35" disabled={!mine} onClick={ab}>
          <Icon name="ab" size={18} /><span className="t-label !text-ink">A / B</span>
        </button>
      </div>
      <div className="flex flex-wrap gap-x-6">
        {mine && <button className="btn btn-text !px-0" onClick={() => playBlob(mine.blob)}><Icon name="speaker" size={16} />Nghe giọng tôi</button>}
        {recognitionAvailable() && <button className="btn btn-text !px-0" onClick={check}><Icon name="ear" size={16} />Nhận dạng giọng nói</button>}
      </div>
      {heard !== null && (
        <p className="t-fr mt-2">
          {heard === '' ? <span className="t-small text-muted">Không nghe thấy gì.</span> :
            wordsHeard(seg.text, heard).map((w, i) => w.space ? w.tok : <span key={i} className={w.ok ? '' : 'text-accent underline decoration-[0.5px] underline-offset-4'}>{w.tok}</span>)}
        </p>
      )}

      <div className="mt-8">
        <Kicker>Câu này khó với bạn thế nào?</Kicker>
        <div className="mt-3 grid grid-cols-4 border-y border-[var(--rule)]">
          {[[Rating.Again, 'Lại'], [Rating.Hard, 'Khó'], [Rating.Good, 'Được'], [Rating.Easy, 'Dễ']].map(([g, l], i) => (
            <button key={g} className={`flex min-h-[64px] flex-col items-center justify-center disabled:opacity-35 ${i ? 'border-l border-[var(--rule)]' : ''}`} disabled={rated} onClick={() => rate(g as number)}>
              <span className="text-[14px] text-ink">{l}</span>{intervals && <span className="t-num mt-0.5 text-[14px] text-muted">{intervals[g as number]}</span>}
            </button>
          ))}
        </div>
        {rated && <p className="t-small mt-3 text-ink2">Đã lưu. Câu khó sẽ quay lại sớm hơn trong phần ôn tập.</p>}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <span className="t-meta">{recs?.length ?? 0} bản ghi{recs?.length ? ` · lần đầu ${recs[0].createdAt.toLocaleDateString('vi-VN')}` : ''}</span>
        <div className="flex gap-4">
          {(recs?.length ?? 0) >= 2 && <Link className="t-label flex min-h-[44px] items-center !text-ink" to={`/then-now?seg=${encodeURIComponent(segKey)}`}>Avant · Après</Link>}
          <button className="t-label flex min-h-[44px] items-center !text-ink" onClick={() => setEditing(!editing)}>Chỉnh mốc</button>
        </div>
      </div>
      {editing && <BoundaryEditor trackId={trackId} seg={seg} player={player} onSaved={() => setEditing(false)} />}
      <div className="h-6" />
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
    <div className="flex items-center gap-2 border-b border-[var(--rule)] py-1">
      <span className="t-label w-20">{label}</span>
      <span className="t-num w-20 text-[18px] tabular-nums">{fmt(v)}</span>
      {nudges.map((d) => <button key={d} className="opt flex-1 text-[13px] !text-ink2" onClick={() => set(Math.max(0, +(v + d).toFixed(3)))}>{d > 0 ? '+' : '−'}{Math.abs(d * 1000)}</button>)}
    </div>
  );
  return (
    <div className="mt-4">
      <div className="gold-rule" />
      <Kicker className="mt-4">Chỉnh mốc câu · mili giây</Kicker>
      <div className="mt-2">
        {row('Bắt đầu', start, setStart)}
        {row('Kết thúc', end, setEnd)}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <button className="btn btn-line" onClick={async () => { await player.load(trackId); await player.playRange(start, end); }}>Thử</button>
        <button className="btn btn-primary" onClick={async () => { await db.overrides.put({ key, trackId, idx: seg.idx, start, end, updatedAt: new Date() }); onSaved(); }}>Lưu</button>
        <button className="btn btn-line" disabled={!hasOverride} onClick={async () => { await db.overrides.delete(key); onSaved(); }}>Gốc</button>
      </div>
      <p className="t-meta mt-3">Các chỉnh sửa có thể xuất ra trong Cài đặt để cập nhật pipeline trên laptop.</p>
    </div>
  );
}
