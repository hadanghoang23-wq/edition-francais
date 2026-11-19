import { useEffect, useRef } from 'react';

function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#000';
}

function setupCanvas(c: HTMLCanvasElement, h: number) {
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const w = c.clientWidth;
  c.width = Math.round(w * dpr);
  c.height = Math.round(h * dpr);
  const g = c.getContext('2d')!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { g, w, h };
}

/** Smoothed peak envelope, normalised to 0..1. */
function envelope(samples: Float32Array, points: number) {
  const out = new Float32Array(points);
  const step = Math.max(1, Math.floor(samples.length / points));
  let max = 1e-6;
  for (let b = 0; b < points; b++) {
    let m = 0;
    for (let i = b * step; i < Math.min(samples.length, (b + 1) * step); i += 2) m = Math.max(m, Math.abs(samples[i]));
    out[b] = m;
    max = Math.max(max, m);
  }
  const sm = new Float32Array(points);
  for (let b = 0; b < points; b++) sm[b] = ((out[b - 1] ?? out[b]) + 2 * out[b] + (out[b + 1] ?? out[b])) / 4 / max;
  return sm;
}

/**
 * Waveforms as fine lines: the native speaker above the axis in the accent,
 * yours mirrored below in ink. Each stretched to the full width.
 */
export function Waveforms({ native, mine, height = 72, progress }: { native?: Float32Array | null; mine?: Float32Array | null; height?: number; progress?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const draw = () => {
      const { g, w, h } = setupCanvas(c, height);
      g.clearRect(0, 0, w, h);
      const mid = h / 2;
      const pts = Math.max(60, Math.floor(w / 2));
      const trace = (s: Float32Array, color: string, dir: 1 | -1, width: number) => {
        const e = envelope(s, pts);
        g.beginPath();
        for (let i = 0; i < pts; i++) {
          const x = (i / (pts - 1)) * w;
          const y = mid - dir * Math.max(0.5, e[i] * (mid - 3));
          i ? g.lineTo(x, y) : g.moveTo(x, y);
        }
        g.strokeStyle = color; g.lineWidth = width; g.lineJoin = 'round'; g.stroke();
        g.lineTo(w, mid); g.lineTo(0, mid); g.closePath();
        g.globalAlpha = 0.07; g.fillStyle = color; g.fill(); g.globalAlpha = 1;
      };
      g.fillStyle = cssVar('--rule');
      g.fillRect(0, Math.round(mid), w, 1);
      if (native) trace(native, cssVar('--accent'), 1, 1.1);
      if (mine) trace(mine, cssVar('--ink'), -1, 0.9);
      if (progress !== undefined && progress > 0) {
        g.fillStyle = cssVar('--gold');
        g.fillRect(Math.min(w - 1, progress * w), 0, 1, h);
      }
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(c);
    return () => ro.disconnect();
  }, [native, mine, height, progress]);
  return <canvas ref={ref} className="block w-full" style={{ height }} aria-label="Dạng sóng: bản gốc phía trên, của bạn phía dưới" />;
}

/**
 * Intonation overlay on a semitone scale: native contour in the accent, yours in ink.
 * Hairline guides every 3 semitones; the centre is each speaker's own median pitch.
 */
export function PitchOverlay({ native, mine, height = 112 }: { native?: Float32Array | null; mine?: Float32Array | null; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const draw = () => {
      const { g, w, h } = setupCanvas(c, height);
      g.clearRect(0, 0, w, h);
      const range = 9;
      const y = (st: number) => h / 2 - (Math.max(-range, Math.min(range, st)) / range) * (h / 2 - 6);
      g.fillStyle = cssVar('--rule');
      for (let s = -range + 3; s < range; s += 3) g.fillRect(0, Math.round(y(s)), w, s === 0 ? 1 : 0.5);
      const line = (a: Float32Array, color: string, width: number) => {
        g.strokeStyle = color; g.lineWidth = width; g.lineJoin = 'round'; g.lineCap = 'round';
        g.beginPath();
        // Drawing only: bridge short unvoiced gaps (≤ 8 points) so the contour reads as one phrase, not specks.
        let last = -1;
        for (let i = 0; i < a.length; i++) {
          const v = a[i];
          if (Number.isNaN(v)) continue;
          const x = (i / (a.length - 1)) * w;
          if (last >= 0 && i - last <= 8) g.lineTo(x, y(v)); else g.moveTo(x, y(v));
          last = i;
        }
        g.stroke();
      };
      if (native) line(native, cssVar('--accent'), 1.6);
      if (mine) line(mine, cssVar('--ink'), 1);
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(c);
    return () => ro.disconnect();
  }, [native, mine, height]);
  return <canvas ref={ref} className="block w-full" style={{ height }} aria-label="Đường ngữ điệu: màu đỏ rượu là bản gốc, màu mực là của bạn" />;
}

/** Live microphone level, drawn as a fine moving line. */
export function LevelMeter({ getLevel, active }: { getLevel: () => number; active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!active) return;
    const c = ref.current!;
    const hist: number[] = [];
    let raf = 0;
    const loop = () => {
      const { g, w, h } = setupCanvas(c, 28);
      hist.push(getLevel());
      const n = Math.floor(w / 3);
      while (hist.length > n) hist.shift();
      g.clearRect(0, 0, w, h);
      g.strokeStyle = cssVar('--accent'); g.lineWidth = 1;
      g.beginPath();
      hist.forEach((v, i) => {
        const x = w - (hist.length - i) * 3;
        const a = Math.max(0.5, v * (h / 2 - 1));
        g.moveTo(x, h / 2 - a); g.lineTo(x, h / 2 + a);
      });
      g.stroke();
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [active, getLevel]);
  return <canvas ref={ref} className="block w-full" style={{ height: 28 }} aria-hidden />;
}
