import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { db } from './db';

/**
 * Backup = all progress + recordings (not the content packs, which you can re-import).
 * Format: zip with progress.json and recordings/<id>.<ext>.
 */
const PROGRESS_TABLES = ['overrides', 'cards', 'reviewLogs', 'ladder', 'stats', 'settings', 'customCards', 'errorLog', 'exerciseResults', 'drafts'] as const;

const reviveDates = (o: any): any => {
  if (Array.isArray(o)) return o.map(reviveDates);
  if (o && typeof o === 'object') {
    if (o.__date) return new Date(o.__date);
    for (const k of Object.keys(o)) o[k] = reviveDates(o[k]);
  }
  return o;
};
const replacer = function (this: any, key: string, value: unknown) {
  const raw = this[key];
  return raw instanceof Date ? { __date: raw.toISOString() } : value;
};

export async function exportBackup(): Promise<Blob> {
  const progress: Record<string, unknown[]> = {};
  for (const t of PROGRESS_TABLES) progress[t] = await (db as any)[t].toArray();
  const settings = progress.settings as { key: string }[];
  progress.settings = settings.filter((s) => s.key !== 'apiKey'); // never export your API key
  const recs = await db.recordings.toArray();
  const files: Record<string, Uint8Array> = {};
  const recMeta = [];
  for (const r of recs) {
    const ext = r.mime.includes('mp4') ? 'm4a' : r.mime.includes('webm') ? 'webm' : 'bin';
    const name = `recordings/${r.id}.${ext}`;
    files[name] = new Uint8Array(await r.blob.arrayBuffer());
    const { blob: _b, ...meta } = r;
    recMeta.push({ ...meta, file: name });
  }
  files['progress.json'] = strToU8(JSON.stringify({ format: 1, exportedAt: new Date(), progress, recordings: recMeta }, replacer));
  return new Blob([zipSync(files, { level: 0 })], { type: 'application/zip' });
}

export async function importBackup(file: Blob) {
  const files = unzipSync(new Uint8Array(await file.arrayBuffer()));
  if (!files['progress.json']) throw new Error('Tệp sao lưu không hợp lệ.');
  const data = reviveDates(JSON.parse(strFromU8(files['progress.json'])));
  await db.transaction('rw', [...PROGRESS_TABLES.map((t) => (db as any)[t]), db.recordings], async () => {
    for (const t of PROGRESS_TABLES) {
      await (db as any)[t].clear();
      await (db as any)[t].bulkPut(data.progress[t] ?? []);
    }
    await db.recordings.clear();
    for (const r of data.recordings as any[]) {
      const { file: name, ...meta } = r;
      await db.recordings.put({ ...meta, blob: new Blob([files[name]], { type: meta.mime }) });
    }
  });
  return { cards: data.progress.cards.length, recordings: data.recordings.length };
}

export function download(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}
