import Dexie, { type Table } from 'dexie';
import type { Card as FsrsCard } from 'ts-fsrs';
import type { PackManifest, Track, Unit } from './types';

export interface PackRow { packId: string; manifest: PackManifest; importedAt: Date; bytes: number }
export interface UnitRow { id: string; packId: string; number: number; data: Unit }
export interface TrackRow extends Track { packId: string }
export interface BlobRow { id: string; packId: string; blob: Blob }
export interface OverrideRow { key: string; trackId: string; idx: number; start: number; end: number; updatedAt: Date }
export interface RecordingRow {
  id?: number;
  segKey: string;          // `${trackId}#${idx}` | `take:${docId}` | `pair:${word}`
  kind: 'sentence' | 'take' | 'pair';
  ladderStep?: number;
  blob: Blob;
  mime: string;
  durationMs: number;
  createdAt: Date;
}
export type CardDeck = 'vocab' | 'sentence' | 'custom';
export type CardType = 'fr-vi' | 'vi-fr' | 'audio-vi' | 'gender' | 'sentence';
export interface CardRow extends FsrsCard {
  id: string;              // `${refId}|${type}`
  deck: CardDeck;
  type: CardType;
  refId: string;           // vocab id, `${trackId}#${idx}`, or custom id
  unitId: string | null;
  introduced: boolean;     // false = still in the "new" pool
  createdAt: Date;
}
export interface ReviewLogRow { id?: number; cardId: string; rating: number; reviewedAt: Date; elapsedMs: number }
export interface LadderRow { docId: string; unlocked: number; counts: Record<number, number>; updatedAt: Date }
export interface StatRow { date: string; shadowMs: number; sentences: number; reviews: number; correct: number; newCards: number }
export interface SettingRow { key: string; value: unknown }
export interface PitchRow { key: string; data: number[]; updatedAt: Date }
export interface CustomCardRow { id: string; front: string; back: string; ipa?: string; gender?: 'm' | 'f' | 'mf'; createdAt: Date }
export interface ErrorLogRow { id?: number; source: string; prompt: string; given: string; expected: string; createdAt: Date; resolved: boolean }

class StudyDB extends Dexie {
  packs!: Table<PackRow, string>;
  units!: Table<UnitRow, string>;
  tracks!: Table<TrackRow, string>;
  audio!: Table<BlobRow, string>;
  pages!: Table<BlobRow, string>;
  overrides!: Table<OverrideRow, string>;
  recordings!: Table<RecordingRow, number>;
  cards!: Table<CardRow, string>;
  reviewLogs!: Table<ReviewLogRow, number>;
  ladder!: Table<LadderRow, string>;
  stats!: Table<StatRow, string>;
  settings!: Table<SettingRow, string>;
  pitch!: Table<PitchRow, string>;
  customCards!: Table<CustomCardRow, string>;
  errorLog!: Table<ErrorLogRow, number>;

  constructor() {
    super('edition-study');
    this.version(1).stores({
      packs: 'packId',
      units: 'id, packId, number',
      tracks: 'id, packId, unitId',
      audio: 'id, packId',
      pages: 'id, packId',
      overrides: 'key, trackId',
      recordings: '++id, segKey, kind, createdAt, [segKey+createdAt]',
      cards: 'id, deck, refId, unitId, due, introduced, [introduced+due]',
      reviewLogs: '++id, cardId, reviewedAt',
      ladder: 'docId',
      stats: 'date',
      settings: 'key',
      pitch: 'key',
      customCards: 'id',
      errorLog: '++id, source, createdAt, resolved',
    });
  }
}

export const db = new StudyDB();
if (import.meta.env.DEV) (window as any).__db = db; // dev-only handle for testing

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key);
  return row ? (row.value as T) : fallback;
}
export async function setSetting(key: string, value: unknown) {
  await db.settings.put({ key, value });
}

export function todayKey(d = new Date()) {
  const z = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

export async function bumpStat(patch: Partial<Omit<StatRow, 'date'>>) {
  const date = todayKey();
  await db.transaction('rw', db.stats, async () => {
    const row = (await db.stats.get(date)) ?? { date, shadowMs: 0, sentences: 0, reviews: 0, correct: 0, newCards: 0 };
    for (const [k, v] of Object.entries(patch)) (row as any)[k] += v as number;
    await db.stats.put(row);
  });
}
