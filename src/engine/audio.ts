import { db } from './db';
import type { Segment } from './types';

/**
 * Audio engine.
 * - Playback uses one HTMLAudioElement per track so playbackRate + preservesPitch
 *   give natural slow-downs (Web Audio's playbackRate would change pitch).
 * - iOS needs a user gesture before the first play(): call unlockAudio() inside a tap handler.
 * - Decoding (for waveforms and pitch) uses a shared AudioContext.
 */

let ctx: AudioContext | null = null;
export function audioContext() {
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return ctx;
}
export async function unlockAudio() {
  const c = audioContext();
  if (c.state === 'suspended') await c.resume();
}

const urlCache = new Map<string, string>();
export async function trackUrl(trackId: string) {
  if (!urlCache.has(trackId)) {
    const row = await db.audio.get(trackId);
    if (!row) throw new Error(`Không tìm thấy âm thanh ${trackId}. Hãy nhập lại gói nội dung.`);
    urlCache.set(trackId, URL.createObjectURL(row.blob));
  }
  return urlCache.get(trackId)!;
}

const bufferCache = new Map<string, Promise<AudioBuffer>>();
export function decodeTrack(trackId: string) {
  if (!bufferCache.has(trackId)) {
    bufferCache.set(trackId, (async () => {
      const row = await db.audio.get(trackId);
      if (!row) throw new Error(`missing audio ${trackId}`);
      return decodeBlob(row.blob);
    })());
  }
  return bufferCache.get(trackId)!;
}
export async function decodeBlob(blob: Blob): Promise<AudioBuffer> {
  const ab = await blob.arrayBuffer();
  const c = audioContext();
  return await new Promise<AudioBuffer>((resolve, reject) => {
    const p = c.decodeAudioData(ab, resolve, reject);
    if (p && typeof (p as Promise<AudioBuffer>).then === 'function') (p as Promise<AudioBuffer>).then(resolve, reject);
  });
}

/** Mono samples of [start, end) seconds. */
export function sliceMono(buf: AudioBuffer, start = 0, end = buf.duration): Float32Array {
  const a = Math.max(0, Math.floor(start * buf.sampleRate));
  const b = Math.min(buf.length, Math.ceil(end * buf.sampleRate));
  const out = new Float32Array(Math.max(0, b - a));
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const data = buf.getChannelData(ch).subarray(a, b);
    for (let i = 0; i < out.length; i++) out[i] += data[i] / buf.numberOfChannels;
  }
  return out;
}

export type Speed = 0.6 | 0.75 | 0.85 | 1;

export class SegmentPlayer {
  el: HTMLAudioElement;
  trackId: string | null = null;
  private raf = 0;
  private stopAt: number | null = null;
  private resolveStop: (() => void) | null = null;
  onTime?: (t: number) => void;
  rate: Speed = 1;

  constructor() {
    this.el = new Audio();
    this.el.preload = 'auto';
    (this.el as any).playsInline = true;
    this.setRate(1);
  }

  async load(trackId: string) {
    if (this.trackId === trackId) return;
    this.stop();
    this.trackId = trackId;
    this.el.src = await trackUrl(trackId);
    await new Promise<void>((res) => {
      if (this.el.readyState >= 1) return res();
      this.el.addEventListener('loadedmetadata', () => res(), { once: true });
      this.el.load();
    });
  }

  setRate(r: Speed) {
    this.rate = r;
    this.el.playbackRate = r;
    (this.el as any).preservesPitch = true;
    (this.el as any).webkitPreservesPitch = true;
    (this.el as any).mozPreservesPitch = true;
  }

  /** Play [start, end] and resolve when done (or when stopped). */
  async playRange(start: number, end: number) {
    this.cancelLoop();
    this.el.currentTime = start;
    this.stopAt = end;
    this.el.playbackRate = this.rate;
    const done = new Promise<void>((res) => (this.resolveStop = res));
    await this.el.play();
    const tick = () => {
      const t = this.el.currentTime;
      this.onTime?.(t);
      if (this.stopAt !== null && t >= this.stopAt) {
        this.el.pause();
        this.finish();
        return;
      }
      if (this.el.ended || this.el.paused) { this.finish(); return; }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
    return done;
  }

  playSegment(s: Pick<Segment, 'start' | 'end'>) {
    return this.playRange(s.start, s.end);
  }

  private finish() {
    this.cancelLoop();
    this.stopAt = null;
    const r = this.resolveStop;
    this.resolveStop = null;
    r?.();
  }
  private cancelLoop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }
  stop() {
    this.el.pause();
    this.finish();
  }
  get playing() { return !this.el.paused; }
}

/** Plays a Blob (e.g. a recording) once. */
export function playBlob(blob: Blob, rate = 1): { done: Promise<void>; stop: () => void; el: HTMLAudioElement } {
  const el = new Audio(URL.createObjectURL(blob));
  (el as any).playsInline = true;
  el.playbackRate = rate;
  const done = new Promise<void>((res) => {
    el.onended = () => res();
    el.onpause = () => res();
  });
  el.play().catch(() => undefined);
  return { done, stop: () => el.pause(), el };
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
