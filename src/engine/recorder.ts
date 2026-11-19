/**
 * Microphone recorder.
 * One getUserMedia stream is opened once and kept for the whole session, so iOS
 * does not ask for permission again on every recording. iOS Safari records audio/mp4;
 * Chrome/Edge record audio/webm. Both decode with decodeAudioData.
 */

let stream: MediaStream | null = null;

export type MicState = 'unknown' | 'granted' | 'denied' | 'unsupported';

export function micSupported() {
  return !!navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function' && typeof MediaRecorder !== 'undefined';
}

export async function micPermission(): Promise<MicState> {
  if (!micSupported()) return 'unsupported';
  if (stream) return 'granted';
  try {
    const st = await (navigator.permissions as any)?.query({ name: 'microphone' });
    if (st?.state === 'granted') return 'granted';
    if (st?.state === 'denied') return 'denied';
  } catch { /* Safari: permissions API may not know "microphone" */ }
  return 'unknown';
}

export async function openMic(): Promise<MediaStream> {
  if (stream && stream.getAudioTracks().some((t) => t.readyState === 'live')) return stream;
  stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
  });
  return stream;
}

export function closeMic() {
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
}

function pickMime() {
  const candidates = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
  return candidates.find((m) => (MediaRecorder as any).isTypeSupported?.(m)) ?? '';
}

export interface Recording { blob: Blob; mime: string; durationMs: number }

export class Recorder {
  private rec: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private startedAt = 0;
  level = 0;
  private analyser: AnalyserNode | null = null;
  private levelRaf = 0;

  async start(ctx?: AudioContext) {
    const s = await openMic();
    const mime = pickMime();
    this.rec = new MediaRecorder(s, mime ? { mimeType: mime } : undefined);
    this.chunks = [];
    this.rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.rec.start();
    this.startedAt = performance.now();
    if (ctx) {
      const src = ctx.createMediaStreamSource(s);
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 512;
      src.connect(this.analyser);
      const data = new Float32Array(this.analyser.fftSize);
      const loop = () => {
        this.analyser!.getFloatTimeDomainData(data);
        let sum = 0;
        for (const v of data) sum += v * v;
        this.level = Math.min(1, Math.sqrt(sum / data.length) * 6);
        this.levelRaf = requestAnimationFrame(loop);
      };
      loop();
    }
  }

  stop(): Promise<Recording> {
    return new Promise((resolve, reject) => {
      if (!this.rec) return reject(new Error('not recording'));
      const rec = this.rec;
      rec.onstop = () => {
        cancelAnimationFrame(this.levelRaf);
        this.analyser?.disconnect();
        const type = rec.mimeType || this.chunks[0]?.type || 'audio/mp4';
        resolve({ blob: new Blob(this.chunks, { type }), mime: type, durationMs: performance.now() - this.startedAt });
      };
      rec.stop();
      this.rec = null;
    });
  }

  get recording() { return !!this.rec; }
}
