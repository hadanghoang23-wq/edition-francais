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
export interface StatRow { date: string; shadowMs: number; sentences: number; reviews: number; correct: number; newCards: number; items?: number; writing?: number }
export interface SettingRow { key: string; value: unknown }
export interface PitchRow { key: string; data: number[]; updatedAt: Date }
export interface CustomCardRow { id: string; front: string; back: string; ipa?: string; gender?: 'm' | 'f' | 'mf'; createdAt: Date }
export interface ErrorLogRow {
  id?: number; source: string; prompt: string; given: string; expected: string; createdAt: Date; resolved: boolean;
  ref?: string;          // how to ask it again, e.g. "drill:u01-g5:3", "verb:etre:2", "gender:u01-v006"
  hint?: string;         // Vietnamese hint shown when re-asked
  streak?: number;       // correct answers in a row since the mistake (resolved at 2)
  dueAt?: Date;          // not before this time
}
export interface ExerciseResultRow { id: string; unitId: string; skill: string; best: number; last: number; attempts: number; updatedAt: Date }
/** A piece of writing. `versions` keeps every corrected submission so you can compare then and now. */
export interface DraftRow {
  id: string;                 // `${unitId}:${taskId}` for book tasks, `free:${n}` for free writing
  unitId: string | null;
  taskId: string | null;
  title: string;
  text: string;
  updatedAt: Date;
  versions: { at: Date; text: string; feedback?: unknown; model?: string; costUsd?: number; selfCheck?: number }[];
}

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
  exerciseResults!: Table<ExerciseResultRow, string>;
  drafts!: Table<DraftRow, string>;

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
    // Phase 2: exercise results; error-log entries carry a ref so the item can be asked again.
    this.version(2).stores({
      exerciseResults: 'id, unitId, skill, updatedAt',
      errorLog: '++id, source, createdAt, resolved, ref',
    });
    // Phase 3: writing drafts with their corrected versions.
    this.version(3).stores({ drafts: 'id, unitId, updatedAt' });
  }
}

export const db = new StudyDB();
if (import.meta.env.DEV && typeof window !== 'undefined') (window as any).__db = db; // dev-only handle for testing

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
    for (const [k, v] of Object.entries(patch)) (row as any)[k] = ((row as any)[k] ?? 0) + (v as number);
    await db.stats.put(row);
  });
}
