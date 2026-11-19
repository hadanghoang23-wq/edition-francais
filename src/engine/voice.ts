import { db } from './db';

/**
 * Offline synthetic voice clips (voice pack built on the laptop with Piper).
 * A clip is found by hashing its text exactly like pipeline/build_voice_pack.py does,
 * so the pack needs no lookup table. Clips play as ordinary audio: the iPhone silent
 * switch and the "speech must start from a tap" rule don't apply to them.
 */
export function normVoice(text: string) {
  return text.normalize('NFC').replace(/’/g, "'").replace(/…/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export async function voiceKey(text: string): Promise<string> {
  const data = new TextEncoder().encode(normVoice(text));
  const buf = await crypto.subtle.digest('SHA-1', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

const cache = new Map<string, Blob | null>();
export async function voiceClip(text: string): Promise<Blob | null> {
  if (!crypto?.subtle) return null;
  const k = await voiceKey(text);
  if (!cache.has(k)) cache.set(k, (await db.audio.get(`v:${k}`))?.blob ?? null);
  return cache.get(k)!;
}

export function clearVoiceCache() { cache.clear(); }
