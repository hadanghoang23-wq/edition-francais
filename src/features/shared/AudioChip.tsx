import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { SegmentPlayer, unlockAudio, type Speed } from '../../engine/audio';
import { segmentByRef } from '../../engine/content';
import { db } from '../../engine/db';
import { speak } from '../../engine/speech';
import type { AudioRef } from '../../engine/types';
import { TtsBadge } from '../../ui/kit';
import { Icon } from '../../ui/icons';

const shared = { player: null as SegmentPlayer | null };
export function sharedPlayer() {
  if (!shared.player) shared.player = new SegmentPlayer();
  return shared.player;
}

/** True when the referenced book audio is on this device. */
export function useHasAudio(audio?: AudioRef | null) {
  return useLiveQuery(async () => (audio ? !!(await db.tracks.get(audio.trackId)) : false), [audio?.trackId]) ?? false;
}

/** Plays a referenced book segment, or speaks `tts` (labelled) when no book audio is available. */
export async function playRefOrTts(audio: AudioRef | null | undefined, tts: string | undefined, rate: Speed = 1) {
  await unlockAudio();
  if (audio) {
    const seg = await segmentByRef(audio.trackId, audio.segIdx);
    if (seg) {
      const p = sharedPlayer();
      await p.load(audio.trackId);
      p.setRate(rate);
      await p.playSegment(seg);
      return 'book';
    }
  }
  if (tts) { await speak(tts, { rate: rate === 1 ? 0.9 : rate }); return 'tts'; }
  return 'none';
}

export function AudioChip({ audio, tts, label = '▶', rate = 1 }: { audio?: AudioRef | null; tts?: string; label?: string; rate?: Speed }) {
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const has = useHasAudio(audio);
  if (!audio && !tts) return null;
  if (audio && !has && !tts) return null;
  const play = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try { await playRefOrTts(has ? audio : null, tts, rate); } finally { lock.current = false; setBusy(false); }
  };
  return (
    <button onClick={play} aria-label={has ? 'Nghe audio của sách' : 'Nghe giọng máy (TTS)'}
      className={`-mr-2 flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center gap-1.5 px-2 transition-colors duration-300 ${busy ? 'text-accent' : 'text-ink2'}`}>
      {label !== '▶' && <span className="t-label !text-ink2">{label.replace('▶', '').trim()}</span>}
      <Icon name={busy ? 'stop' : 'speaker'} size={busy ? 14 : 19} />
      {!has && <TtsBadge />}
    </button>
  );
}
