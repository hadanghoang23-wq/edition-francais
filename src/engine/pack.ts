import { unzipSync, strFromU8 } from 'fflate';
import { db } from './db';
import type { PackManifest, Track, Unit } from './types';
import { ensureVocabCards } from './srs';
import { clearVoiceCache } from './voice';

export interface ImportResult { packId: string; title: string; tracks: number; segments: number; replaced: boolean; kind?: 'unit' | 'voice' }

async function sha256Hex(data: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Import a content-pack zip into IndexedDB. Verifies every file's sha256 against the manifest. */
export async function importPack(file: Blob, onProgress?: (msg: string) => void): Promise<ImportResult> {
  onProgress?.('Đang đọc tệp…');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const files = unzipSync(bytes);
  if (!files['manifest.json']) throw new Error('Tệp này không phải gói nội dung (thiếu manifest.json).');
  const manifest = JSON.parse(strFromU8(files['manifest.json'])) as PackManifest;
  if (manifest.format !== 1) throw new Error(`Định dạng gói ${manifest.format} chưa được hỗ trợ.`);

  onProgress?.('Đang kiểm tra tính toàn vẹn…');
  if (crypto?.subtle) {
    for (const [name, meta] of Object.entries(manifest.files)) {
      const data = files[name];
      if (!data) throw new Error(`Gói bị thiếu tệp ${name}.`);
      if ((await sha256Hex(data)) !== meta.sha256) throw new Error(`Tệp ${name} bị hỏng (sai mã kiểm tra).`);
    }
  }

  const replaced = !!(await db.packs.get(manifest.packId));

  // Voice pack: synthetic French clips, one MP3 per spoken text.
  if (manifest.kind === 'voice') {
    onProgress?.('Đang lưu giọng đọc…');
    const clips = Object.keys(files).filter((n) => n.startsWith('voice/') && n.endsWith('.mp3'));
    await db.transaction('rw', [db.packs, db.audio], async () => {
      await db.audio.where('packId').equals(manifest.packId).delete();
      await db.packs.put({ packId: manifest.packId, manifest, importedAt: new Date(), bytes: bytes.byteLength });
      await db.audio.bulkPut(clips.map((n) => ({ id: `v:${n.slice(6, -4)}`, packId: manifest.packId, blob: new Blob([files[n]], { type: 'audio/mpeg' }) })));
    });
    clearVoiceCache();
    return { packId: manifest.packId, title: manifest.title, tracks: 0, segments: clips.length, replaced, kind: 'voice' };
  }

  const unit = JSON.parse(strFromU8(files['unit.json'])) as Unit;
  const tracks = JSON.parse(strFromU8(files['tracks.json'])) as Track[];

  onProgress?.('Đang lưu vào máy…');
  await db.transaction('rw', [db.packs, db.units, db.tracks, db.audio, db.pages], async () => {
    await removePackData(manifest.packId);
    await db.packs.put({ packId: manifest.packId, manifest, importedAt: new Date(), bytes: bytes.byteLength });
    await db.units.put({ id: unit.id, packId: manifest.packId, number: unit.number, data: unit });
    for (const t of tracks) {
      await db.tracks.put({ ...t, packId: manifest.packId });
      await db.audio.put({ id: t.id, packId: manifest.packId, blob: new Blob([files[t.file]], { type: 'audio/mpeg' }) });
    }
    for (const name of Object.keys(files)) {
      if (name.startsWith('pages/')) {
        const id = name.slice(6).replace('.jpg', '');
        await db.pages.put({ id, packId: manifest.packId, blob: new Blob([files[name]], { type: 'image/jpeg' }) });
      }
    }
  });
  onProgress?.('Đang tạo thẻ từ vựng…');
  await ensureVocabCards(unit);
  return { packId: manifest.packId, title: manifest.title, tracks: tracks.length,
    segments: tracks.reduce((n, t) => n + t.segments.length, 0), replaced };
}

async function removePackData(packId: string) {
  await db.units.where('packId').equals(packId).delete();
  await db.tracks.where('packId').equals(packId).delete();
  await db.audio.where('packId').equals(packId).delete();
  await db.pages.where('packId').equals(packId).delete();
}

/** Delete a pack's content. Progress (cards, recordings) is kept so a re-import continues where you left off. */
export async function deletePack(packId: string) {
  await db.transaction('rw', [db.packs, db.units, db.tracks, db.audio, db.pages], async () => {
    await removePackData(packId);
    await db.packs.delete(packId);
  });
}
