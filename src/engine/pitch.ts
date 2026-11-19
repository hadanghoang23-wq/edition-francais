import { PitchDetector } from 'pitchy';

/**
 * Intonation analysis.
 * Contours are in semitones relative to the speaker's own median pitch, so a male
 * native voice and your voice can be overlaid. Unvoiced frames are NaN.
 */

export interface Contour {
  hop: number;            // seconds per frame
  st: Float32Array;       // semitones relative to median (NaN = unvoiced)
  energy: Float32Array;   // 0..1
  medianHz: number;
}

export function extractContour(samples: Float32Array, sampleRate: number, hopSec = 0.01): Contour {
  const frame = 2048;
  const hop = Math.round(sampleRate * hopSec);
  const detector = PitchDetector.forFloat32Array(frame);
  detector.minVolumeDecibels = -45;
  const n = Math.max(0, Math.floor((samples.length - frame) / hop));
  const hz = new Float32Array(n);
  const energy = new Float32Array(n);
  let maxE = 1e-9;
  for (let i = 0; i < n; i++) {
    const w = samples.subarray(i * hop, i * hop + frame);
    let e = 0;
    for (let k = 0; k < w.length; k += 4) e += w[k] * w[k];
    energy[i] = Math.sqrt(e / (w.length / 4));
    maxE = Math.max(maxE, energy[i]);
    const [p, clarity] = detector.findPitch(w, sampleRate);
    hz[i] = clarity > 0.85 && p > 65 && p < 500 ? p : NaN;
  }
  for (let i = 0; i < n; i++) {
    energy[i] /= maxE;
    if (energy[i] < 0.06) hz[i] = NaN;
  }
  // remove octave jumps and single-frame spikes with a 5-frame median filter
  const clean = medianFilter(hz, 5);
  const voiced = [...clean].filter((v) => !Number.isNaN(v)).sort((a, b) => a - b);
  const medianHz = voiced.length ? voiced[Math.floor(voiced.length / 2)] : 150;
  const st = new Float32Array(n);
  for (let i = 0; i < n; i++) st[i] = Number.isNaN(clean[i]) ? NaN : 12 * Math.log2(clean[i] / medianHz);
  return { hop: hopSec, st, energy, medianHz };
}

function medianFilter(a: Float32Array, k: number) {
  const out = new Float32Array(a.length);
  const h = Math.floor(k / 2);
  for (let i = 0; i < a.length; i++) {
    if (Number.isNaN(a[i])) { out[i] = NaN; continue; }
    const win: number[] = [];
    for (let j = i - h; j <= i + h; j++) if (j >= 0 && j < a.length && !Number.isNaN(a[j])) win.push(a[j]);
    win.sort((x, y) => x - y);
    out[i] = win[Math.floor(win.length / 2)];
  }
  return out;
}

/** Trim leading/trailing low-energy frames. */
export function speechSpan(c: Contour): [number, number] {
  let a = 0, b = c.energy.length - 1;
  while (a < b && c.energy[a] < 0.08) a++;
  while (b > a && c.energy[b] < 0.08) b--;
  return [a, b];
}

/** Resample the speech span to `n` points (linear time normalisation, NaN kept). */
export function normalise(c: Contour, n = 160): Float32Array {
  const [a, b] = speechSpan(c);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const src = a + ((b - a) * i) / (n - 1);
    out[i] = c.st[Math.round(src)] ?? NaN;
  }
  return out;
}

/**
 * Dynamic time warping of your contour onto the native one, so syllables line up
 * even if you speak faster or slower. Returns your contour on the native time axis.
 */
export function dtwAlign(native: Float32Array, mine: Float32Array, band = 0.2): Float32Array {
  const n = native.length, m = mine.length;
  const fill = (a: Float32Array) => {
    const o = Float32Array.from(a);
    let last = 0;
    for (let i = 0; i < o.length; i++) { if (Number.isNaN(o[i])) o[i] = last; else last = o[i]; }
    return o;
  };
  const A = fill(native), B = fill(mine);
  const w = Math.max(Math.abs(n - m), Math.floor(Math.max(n, m) * band));
  const INF = 1e12;
  const D = new Float64Array((n + 1) * (m + 1)).fill(INF);
  const at = (i: number, j: number) => i * (m + 1) + j;
  D[0] = 0;
  for (let i = 1; i <= n; i++) {
    const jMin = Math.max(1, Math.floor((i * m) / n) - w), jMax = Math.min(m, Math.ceil((i * m) / n) + w);
    for (let j = jMin; j <= jMax; j++) {
      const cost = Math.abs(A[i - 1] - B[j - 1]);
      D[at(i, j)] = cost + Math.min(D[at(i - 1, j)], D[at(i, j - 1)], D[at(i - 1, j - 1)]);
    }
  }
  // backtrack: for each native index keep the mean of matched "mine" values
  const sum = new Float64Array(n), cnt = new Float64Array(n);
  let i = n, j = m;
  while (i > 0 && j > 0) {
    if (!Number.isNaN(mine[j - 1])) { sum[i - 1] += mine[j - 1]; cnt[i - 1]++; }
    const d = D[at(i - 1, j - 1)], u = D[at(i - 1, j)], l = D[at(i, j - 1)];
    if (d <= u && d <= l) { i--; j--; } else if (u < l) i--; else j--;
  }
  const out = new Float32Array(n);
  for (let k = 0; k < n; k++) out[k] = cnt[k] ? sum[k] / cnt[k] : NaN;
  return out;
}

export interface IntonationReport {
  meanDiff: number;      // semitones, lower = closer to native
  wobbleMine: number;    // average |frame-to-frame jump| in your contour
  wobbleNative: number;
  verdictVi: string;
}

/** Compares two aligned contours. "Wobble" catches Vietnamese-style tone movement on each syllable. */
export function compareIntonation(native: Float32Array, mineAligned: Float32Array): IntonationReport {
  let diff = 0, nd = 0;
  for (let i = 0; i < native.length; i++) {
    if (!Number.isNaN(native[i]) && !Number.isNaN(mineAligned[i])) { diff += Math.abs(native[i] - mineAligned[i]); nd++; }
  }
  const wob = (a: Float32Array) => {
    let s = 0, k = 0;
    for (let i = 1; i < a.length; i++) if (!Number.isNaN(a[i]) && !Number.isNaN(a[i - 1])) { s += Math.abs(a[i] - a[i - 1]); k++; }
    return k ? s / k : 0;
  };
  const meanDiff = nd ? diff / nd : NaN;
  const wobbleMine = wob(mineAligned), wobbleNative = wob(native);
  let verdictVi: string;
  if (Number.isNaN(meanDiff)) verdictVi = 'Chưa nghe rõ giọng của bạn. Thử nói to và gần micro hơn.';
  else if (wobbleMine > wobbleNative * 1.8 && wobbleMine > 0.6)
    verdictVi = 'Giọng bạn lên xuống trên từng âm tiết — dấu hiệu của thanh điệu tiếng Việt. Giữ các âm tiết ngang, chỉ đổi cao độ ở cuối nhóm nhịp.';
  else if (meanDiff < 1.5) verdictVi = 'Rất gần ngữ điệu gốc.';
  else if (meanDiff < 3) verdictVi = 'Khá gần. So sánh chỗ hai đường tách xa nhau nhất.';
  else verdictVi = 'Ngữ điệu còn khác bản gốc. Nghe lại ở tốc độ 0.75× rồi nhại theo đường xanh.';
  return { meanDiff, wobbleMine, wobbleNative, verdictVi };
}
