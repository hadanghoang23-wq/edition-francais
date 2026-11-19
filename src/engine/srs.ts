import { createEmptyCard, fsrs, generatorParameters, Rating, type Grade } from 'ts-fsrs';
import { db, bumpStat, getSetting, todayKey, type CardRow, type CardType } from './db';
import type { Unit, Vocab } from './types';

export { Rating };
const scheduler = fsrs(generatorParameters({ enable_fuzz: true, request_retention: 0.9 }));

function newCard(id: string, refId: string, deck: CardRow['deck'], type: CardType, unitId: string | null): CardRow {
  return { ...createEmptyCard(new Date()), id, refId, deck, type, unitId, introduced: false, createdAt: new Date() };
}

/** Which card types a vocabulary item gets. */
export function cardTypesFor(v: Vocab): CardType[] {
  const types: CardType[] = ['fr-vi', 'vi-fr'];
  if (v.example?.audio) types.push('audio-vi');
  if (v.pos === 'noun' && (v.gender === 'm' || v.gender === 'f')) types.push('gender');
  return types;
}

/** Create missing vocab cards for a unit (idempotent; never resets existing progress). */
export async function ensureVocabCards(unit: Unit) {
  const wanted: CardRow[] = [];
  for (const v of unit.vocab) for (const t of cardTypesFor(v)) wanted.push(newCard(`${v.id}|${t}`, v.id, 'vocab', t, unit.id));
  for (const c of unit.countries ?? []) {
    wanted.push(newCard(`${c.id}|fr-vi`, c.id, 'vocab', 'fr-vi', unit.id));
    wanted.push(newCard(`${c.id}|vi-fr`, c.id, 'vocab', 'vi-fr', unit.id));
  }
  const existing = new Set(await db.cards.where('id').anyOf(wanted.map((c) => c.id)).primaryKeys());
  await db.cards.bulkAdd(wanted.filter((c) => !existing.has(c.id)));
}

/** Sentence cards are created when you first rate a sentence in the Studio. */
export async function rateSentence(segKey: string, unitId: string, rating: Grade) {
  const id = `${segKey}|sentence`;
  const card = (await db.cards.get(id)) ?? { ...newCard(id, segKey, 'sentence', 'sentence', unitId), introduced: true };
  await applyRating(card, rating);
}

export async function applyRating(card: CardRow, rating: Grade, elapsedMs = 0) {
  const now = new Date();
  const next = scheduler.next(card, now, rating).card;
  const wasNew = !card.introduced;
  await db.cards.put({ ...card, ...next, introduced: true });
  await db.reviewLogs.add({ cardId: card.id, rating, reviewedAt: now, elapsedMs });
  await bumpStat({ reviews: 1, correct: rating >= Rating.Good ? 1 : 0, newCards: wasNew ? 1 : 0 });
}

/** Preview the next interval for each grade (for button labels). */
export function previewIntervals(card: CardRow): Record<number, string> {
  const log = scheduler.repeat(card, new Date());
  const out: Record<number, string> = {};
  for (const g of [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy]) {
    const due = log[g as Grade].card.due.getTime() - Date.now();
    out[g] = humanize(due);
  }
  return out;
}

export function humanize(ms: number) {
  const m = ms / 60000;
  if (m < 60) return `${Math.max(1, Math.round(m))} ph`;
  const h = m / 60;
  if (h < 24) return `${Math.round(h)} giờ`;
  const d = h / 24;
  if (d < 30) return `${Math.round(d)} ngày`;
  return `${Math.round(d / 30)} tháng`;
}

/** Due reviews + today's ration of new cards. */
export async function buildQueue(opts: { deck?: CardRow['deck']; unitId?: string } = {}) {
  const now = new Date();
  const newPerDay = await getSetting('newPerDay', 15);
  const introducedToday = (await db.stats.get(todayKey()))?.newCards ?? 0;
  const match = (c: CardRow) => (!opts.deck || c.deck === opts.deck) && (!opts.unitId || c.unitId === opts.unitId);
  const due = (await db.cards.where('due').belowOrEqual(now).toArray()).filter((c) => c.introduced && match(c));
  const fresh = (await db.cards.filter((c) => !c.introduced && match(c)).toArray())
    .sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }))
    .slice(0, Math.max(0, newPerDay - introducedToday));
  // Keep the card types of one word apart: interleave by type so fr-vi comes before vi-fr.
  fresh.sort((a, b) => typeOrder(a.type) - typeOrder(b.type));
  due.sort((a, b) => a.due.getTime() - b.due.getTime());
  return { due, fresh, queue: [...due, ...fresh] };
}

const typeOrder = (t: CardType) => ['fr-vi', 'audio-vi', 'gender', 'vi-fr', 'sentence'].indexOf(t);

export async function retention(days = 30) {
  const since = new Date(Date.now() - days * 864e5);
  const logs = await db.reviewLogs.where('reviewedAt').above(since).toArray();
  if (!logs.length) return null;
  return logs.filter((l) => l.rating >= Rating.Good).length / logs.length;
}
