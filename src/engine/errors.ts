import { bumpStat, db, type ErrorLogRow } from './db';

/**
 * Error log: every mistake is stored with a `ref` that lets the app ask the same item again.
 * An entry comes back after a delay (1 day, then 3 days) and is resolved after two correct
 * answers in a row.
 */
const DAY = 864e5;

export async function logError(e: Omit<ErrorLogRow, 'id' | 'createdAt' | 'resolved' | 'streak' | 'dueAt'>) {
  if (e.source !== 'writing') await bumpStat({ items: 1 }); // an answered practice item (for streak and Today)
  if (e.ref) {
    const open = await db.errorLog.where('ref').equals(e.ref).filter((x) => !x.resolved).first();
    if (open) {
      await db.errorLog.update(open.id!, { given: e.given, streak: 0, dueAt: new Date(Date.now() + DAY / 2) });
      return;
    }
  }
  await db.errorLog.add({ ...e, createdAt: new Date(), resolved: false, streak: 0, dueAt: new Date(Date.now() + DAY / 2) });
}

/** Call after a correct answer to an item that may be in the log. */
export async function markCorrect(ref: string) {
  await bumpStat({ items: 1 });
  const open = await db.errorLog.where('ref').equals(ref).filter((x) => !x.resolved).first();
  if (!open) return;
  const streak = (open.streak ?? 0) + 1;
  await db.errorLog.update(open.id!, streak >= 2
    ? { streak, resolved: true }
    : { streak, dueAt: new Date(Date.now() + 3 * DAY) });
}

export async function dueErrors(sources?: string[], now = new Date()) {
  return (await db.errorLog.filter((x) => !x.resolved && !!x.ref && (!x.dueAt || x.dueAt <= now)).toArray())
    .filter((x) => !sources || sources.includes(x.source));
}
