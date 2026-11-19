import { useLiveQuery } from 'dexie-react-hooks';
import { db, type TrackRow } from './db';
import type { Segment, Unit } from './types';

export function useUnits(): Unit[] | undefined {
  return useLiveQuery(async () => (await db.units.orderBy('number').toArray()).map((u) => u.data), []);
}

export function useUnit(id: string | undefined): Unit | undefined | null {
  return useLiveQuery(async () => (id ? (await db.units.get(id))?.data ?? null : null), [id]);
}

/** A track with your boundary overrides applied. */
export function useTrack(id: string | undefined): TrackRow | undefined | null {
  return useLiveQuery(async () => (id ? (await loadTrack(id)) ?? null : null), [id]);
}

export async function loadTrack(id: string): Promise<TrackRow | undefined> {
  const t = await db.tracks.get(id);
  if (!t) return undefined;
  const ov = await db.overrides.where('trackId').equals(id).toArray();
  if (!ov.length) return t;
  const map = new Map(ov.map((o) => [o.idx, o]));
  return { ...t, segments: t.segments.map((s) => (map.has(s.idx) ? { ...s, start: map.get(s.idx)!.start, end: map.get(s.idx)!.end } : s)) };
}

export async function segmentByRef(trackId: string, idx: number): Promise<Segment | undefined> {
  return (await loadTrack(trackId))?.segments[idx];
}

export const segKey = (trackId: string, idx: number) => `${trackId}#${idx}`;

export function usePageUrl(pdfPage: number | null): string | null {
  return useLiveQuery(async () => {
    if (!pdfPage) return null;
    const row = await db.pages.get(`p${String(pdfPage).padStart(3, '0')}`);
    return row ? URL.createObjectURL(row.blob) : null;
  }, [pdfPage]) ?? null;
}

export function useOffset(): number {
  return useLiveQuery(async () => (await db.packs.toCollection().first())?.manifest.pageOffset ?? 4, []) ?? 4;
}
