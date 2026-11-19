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

function peaks(samples: Float32Array, buckets: number) {
  const out = new Float32Array(buckets);
  const step = Math.max(1, Math.floor(samples.length / buckets));
  let max = 1e-6;
  for (let b = 0; b < buckets; b++) {
    let m = 0;
    for (let i = b * step; i < Math.min(samples.length, (b + 1) * step); i += 2) m = Math.max(m, Math.abs(samples[i]));
    out[b] = m;
    max = Math.max(max, m);
  }
  for (let b = 0; b < buckets; b++) out[b] /= max;
  return out;
}

/**
 * Overlaid waveforms: native (ink, above the axis) and yours (tomato, mirrored below),
 * each stretched to the full width so their shapes can be compared. `progress` draws a playhead.
 */
export function Waveforms({ native, mine, height = 84, progress }: { native?: Float32Array | null; mine?: Float32Array | null; height?: number; progress?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const draw = () => {
      const { g, w, h } = setupCanvas(c, height);
      g.clearRect(0, 0, w, h);
      const mid = h / 2;
      const bars = Math.floor(w / 3);
      const paint = (s: Float32Array, color: string, dir: 1 | -1) => {
        const p = peaks(s, bars);
        g.fillStyle = color;
        for (let i = 0; i < bars; i++) {
          const v = Math.max(0.03, p[i]) * (mid - 4);
          g.fillRect(i * 3, dir === 1 ? mid - v : mid, 2, v);
        }
      };
      if (native) paint(native, cssVar('--ink'), 1);
      if (mine) paint(mine, cssVar('--tomato'), -1);
      g.fillStyle = cssVar('--rule');
      g.fillRect(0, mid, w, 1);
      if (progress !== undefined && progress > 0) {
        g.fillStyle = cssVar('--cobalt');
        g.fillRect(Math.min(w - 2, progress * w), 0, 2, h);
      }
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(c);
    return () => ro.disconnect();
  }, [native, mine, height, progress]);
  return <canvas ref={ref} className="block h-auto w-full" style={{ height }} aria-label="Dạng sóng: bản gốc phía trên, của bạn phía dưới" />;
}

/**
 * Intonation overlay: native contour (cobalt) and yours (tomato, dashed) on a semitone scale.
 * Horizontal guides every 3 semitones; the centre line is each speaker's own median pitch.
 */
export function PitchOverlay({ native, mine, height = 120 }: { native?: Float32Array | null; mine?: Float32Array | null; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const draw = () => {
      const { g, w, h } = setupCanvas(c, height);
      g.clearRect(0, 0, w, h);
      const range = 9; // ± semitones shown
      const y = (st: number) => h / 2 - (Math.max(-range, Math.min(range, st)) / range) * (h / 2 - 8);
      g.strokeStyle = cssVar('--rule');
      g.lineWidth = 1;
      for (let s = -range + 3; s < range; s += 3) {
        g.setLineDash(s === 0 ? [] : [2, 4]);
        g.beginPath(); g.moveTo(0, y(s)); g.lineTo(w, y(s)); g.stroke();
      }
      const line = (a: Float32Array, color: string, width: number, dash: number[]) => {
        g.strokeStyle = color; g.lineWidth = width; g.setLineDash(dash); g.lineJoin = 'round'; g.lineCap = 'round';
        g.beginPath();
        let pen = false;
        for (let i = 0; i < a.length; i++) {
          const v = a[i];
          const x = (i / (a.length - 1)) * w;
          if (Number.isNaN(v)) { pen = false; continue; }
          if (!pen) { g.moveTo(x, y(v)); pen = true; } else g.lineTo(x, y(v));
        }
        g.stroke();
      };
      if (native) line(native, cssVar('--cobalt'), 3, []);
      if (mine) line(mine, cssVar('--tomato'), 2.2, [6, 4]);
      g.setLineDash([]);
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(c);
    return () => ro.disconnect();
  }, [native, mine, height]);
  return <canvas ref={ref} className="block w-full" style={{ height }} aria-label="Đường ngữ điệu: xanh là bản gốc, đỏ đứt nét là của bạn" />;
}

/** Live microphone level, drawn as a breathing bar strip. */
export function LevelMeter({ getLevel, active }: { getLevel: () => number; active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!active) return;
    const c = ref.current!;
    const hist: number[] = [];
    let raf = 0;
    const loop = () => {
      const { g, w, h } = setupCanvas(c, 36);
      hist.push(getLevel());
      const n = Math.floor(w / 4);
      while (hist.length > n) hist.shift();
      g.clearRect(0, 0, w, h);
      g.fillStyle = cssVar('--tomato');
      hist.forEach((v, i) => {
        const bh = Math.max(2, v * (h - 2));
        g.fillRect(w - (hist.length - i) * 4, (h - bh) / 2, 2.5, bh);
      });
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [active, getLevel]);
  return <canvas ref={ref} className="block w-full" style={{ height: 36 }} aria-hidden />;
}
