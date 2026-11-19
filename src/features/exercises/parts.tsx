import { useEffect, useState, type ReactNode } from 'react';
import { unlockAudio, type Speed } from '../../engine/audio';
import { loadTrack } from '../../engine/content';
import type { TrackRow } from '../../engine/db';
import { Icon } from '../../ui/icons';
import { sharedPlayer } from '../shared/AudioChip';

export interface ItemResult { ok: boolean; prompt: string; given: string; expected: string; typed: boolean; ref?: string }
export type Report = (results: ItemResult[]) => void;

export function useTrackRow(trackId?: string) {
  const [t, setT] = useState<TrackRow | null>(null);
  useEffect(() => { if (trackId) loadTrack(trackId).then((x) => setT(x ?? null)); }, [trackId]);
  return t;
}

/** Plays a whole track (or one segment) with the four study speeds. */
export function TrackBar({ trackId, label = 'Nghe bài' }: { trackId: string; label?: string }) {
  const track = useTrackRow(trackId);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const p = sharedPlayer();
  useEffect(() => () => p.stop(), [p]);
  if (!track) return null;
  const segs = track.segments;
  const toggle = async () => {
    if (playing) { p.stop(); setPlaying(false); return; }
    await unlockAudio();
    await p.load(track.id);
    p.setRate(speed);
    setPlaying(true);
    await p.playRange(Math.max(0, segs[0].start - 0.2), segs[segs.length - 1].end);
    setPlaying(false);
  };
  return (
    <div className="flex items-center gap-3 border-y border-[var(--rule)] py-2">
      <button onClick={toggle} aria-label={playing ? 'Dừng' : label} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-accent" style={{ border: '1px solid var(--accent)' }}>
        <Icon name={playing ? 'stop' : 'play'} size={playing ? 13 : 18} />
      </button>
      <div className="min-w-0 flex-1"><div className="t-label">{label}</div><div className="t-meta">piste {track.number} · {Math.round(track.durationMs / 1000)} giây</div></div>
      <div className="flex">
        {([0.75, 0.85, 1] as Speed[]).map((s) => (
          <button key={s} className="opt serif text-[17px]" aria-pressed={speed === s} onClick={() => { setSpeed(s); p.setRate(s); }}><span className="opt-u">{s === 1 ? '1,0' : String(s).replace('.', ',')}</span></button>
        ))}
      </div>
    </div>
  );
}

/** Plays a single segment of a track. */
export function SegButton({ trackId, segIdx, label }: { trackId: string; segIdx: number; label?: string }) {
  const track = useTrackRow(trackId);
  const [busy, setBusy] = useState(false);
  if (!track || !track.segments[segIdx]) return null;
  return (
    <button aria-label="Nghe" className={`flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 ${busy ? 'text-accent' : 'text-ink'}`}
      onClick={async () => { await unlockAudio(); const p = sharedPlayer(); await p.load(trackId); setBusy(true); await p.playSegment(track.segments[segIdx]); setBusy(false); }}>
      <Icon name={busy ? 'stop' : 'speaker'} size={busy ? 13 : 18} />{label && <span className="t-label !text-ink">{label}</span>}
    </button>
  );
}

export const okColor = 'var(--ok)';
export const badColor = 'var(--accent)';

export function Mark({ ok }: { ok: boolean | null }) {
  if (ok === null) return null;
  return <Icon name={ok ? 'check' : 'close'} size={16} className="shrink-0" />;
}

/** A tappable choice line: hairline row, selection shown by a fine accent rule. */
export function ChoiceRow({ selected, state, onClick, children }: { selected: boolean; state?: 'ok' | 'bad' | null; onClick: () => void; children: ReactNode }) {
  const color = state === 'ok' ? okColor : state === 'bad' ? badColor : undefined;
  return (
    <button onClick={onClick} className="flex min-h-[52px] w-full items-center gap-3 border-b border-[var(--rule)] py-3 text-left transition-colors duration-300"
      style={{ color, background: selected && !state ? 'var(--accent-soft)' : undefined }}>
      <span className="h-3 w-3 shrink-0 rounded-full transition-colors duration-300" style={{ border: '1px solid currentColor', background: selected ? 'currentColor' : 'transparent', color: color ?? (selected ? 'var(--accent)' : 'var(--rule-strong)') }} />
      <span className="min-w-0 flex-1">{children}</span>
      {state && <Mark ok={state === 'ok'} />}
    </button>
  );
}

/** Small word options (multi or single) used inside an item row. */
export function Chips({ options, value, onToggle, multi, disabled, correct }: {
  options: { v: string; label: ReactNode }[]; value: string[]; onToggle: (v: string) => void; multi?: boolean; disabled?: boolean; correct?: string[] | null;
}) {
  return (
    <div className="flex flex-wrap gap-x-1 gap-y-1">
      {options.map((o) => {
        const on = value.includes(o.v);
        const isRight = correct?.includes(o.v);
        const color = correct ? (isRight ? okColor : on ? badColor : 'var(--faint)') : on ? 'var(--ink)' : 'var(--muted)';
        return (
          <button key={o.v} disabled={disabled} onClick={() => onToggle(o.v)} aria-pressed={on} data-multi={multi ? '1' : undefined}
            className="min-h-[40px] rounded-[2px] px-2.5 text-[15px] transition-colors duration-300"
            style={{ color, boxShadow: on ? 'inset 0 -1px 0 currentColor' : undefined, background: correct && isRight ? 'color-mix(in srgb, var(--ok) 9%, transparent)' : undefined }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function CheckBar({ onCheck, disabled, checked, label = 'Kiểm tra' }: { onCheck: () => void; disabled?: boolean; checked: boolean; label?: string }) {
  if (checked) return null;
  return <button className="btn btn-primary mt-8 w-full" disabled={disabled} onClick={onCheck}>{label}</button>;
}

/** Inline gap input inside a French sentence. */
export function GapInput({ value, onChange, state, expected, width = 6 }: { value: string; onChange: (v: string) => void; state: 'ok' | 'accent' | 'bad' | null; expected?: string; width?: number }) {
  const color = state === 'ok' ? okColor : state ? badColor : 'var(--ink)';
  return (
    <span className="inline-flex flex-col align-baseline">
      <input value={value} onChange={(e) => onChange(e.target.value)} disabled={state !== null} autoCapitalize="off" autoCorrect="off" spellCheck={false}
        aria-label="Điền vào chỗ trống" className="serif mx-1 border-b bg-transparent px-1 text-center text-[19px] outline-none"
        style={{ width: `${Math.max(width, (expected ?? value).length + 2)}ch`, borderColor: state ? color : 'var(--rule-strong)', color }} />
      {state && state !== 'ok' && <span className="t-meta mx-1 text-center !text-[12px]" style={{ color: okColor }}>{expected}{state === 'accent' ? ' · dấu' : ''}</span>}
    </span>
  );
}

export function ScoreLine({ score, total }: { score: number; total: number }) {
  return (
    <div className="mt-10">
      <div className="gold-rule" />
      <div className="flex items-baseline gap-3 pt-5">
        <span className="t-num text-[56px] leading-none">{score}</span><span className="t-num text-[24px] text-muted">/ {total}</span>
        <span className="t-small flex-1 text-right text-ink2">{score === total ? 'Hoàn hảo.' : 'Lỗi sai đã được ghi vào sổ lỗi và sẽ quay lại sau.'}</span>
      </div>
    </div>
  );
}
