import { db } from '../../engine/db';
import { logError, markCorrect } from '../../engine/errors';
import type { ItemResult } from './parts';

/** Save a practice set's score and send every mistake to the error log (and clear items answered right). */
export async function recordSet(id: string, unitId: string, skill: string, items: ItemResult[], source: string, hint?: string) {
  const total = items.length;
  const pct = total ? items.filter((r) => r.ok).length / total : 1;
  const prev = await db.exerciseResults.get(id);
  await db.exerciseResults.put({ id, unitId, skill, best: Math.max(prev?.best ?? 0, pct), last: pct, attempts: (prev?.attempts ?? 0) + 1, updatedAt: new Date() });
  for (const r of items) {
    if (!r.ref) continue;
    if (r.ok) await markCorrect(r.ref);
    else await logError({ source, prompt: r.prompt, given: r.given, expected: r.expected, ref: r.ref, hint });
  }
}
