/** Text-to-speech fallback (always labelled "TTS" in the UI) and the optional recognition check. */

let voice: SpeechSynthesisVoice | null = null;
function pickVoice(lang: string) {
  const voices = speechSynthesis.getVoices();
  const pref = ['Thomas', 'Amélie', 'Audrey', 'Google français', 'Microsoft Denise', 'Microsoft Henri'];
  return voices.find((v) => v.lang.startsWith(lang) && pref.some((p) => v.name.includes(p)))
    ?? voices.find((v) => v.lang.replace('_', '-').startsWith(lang)) ?? null;
}

export function ttsAvailable() {
  return typeof speechSynthesis !== 'undefined';
}

/**
 * iOS only lets speech start from a tap. Call this synchronously at the start of a tap handler
 * (unlockAudio does): it speaks a silent utterance once, after which later speech is allowed.
 */
let ttsUnlocked = false;
export function unlockTts() {
  if (ttsUnlocked || !ttsAvailable()) return;
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    speechSynthesis.speak(u);
    ttsUnlocked = true;
  } catch { /* ignore */ }
}

function waitForVoices(ms = 600): Promise<void> {
  if (speechSynthesis.getVoices().length) return Promise.resolve();
  return new Promise((res) => {
    const t = setTimeout(res, ms);
    speechSynthesis.addEventListener('voiceschanged', () => { clearTimeout(t); res(); }, { once: true });
  });
}

export async function speak(text: string, { lang = 'fr-FR', rate = 0.9 } = {}): Promise<void> {
  if (!ttsAvailable()) return;
  // Cancelling and speaking in the same tick makes iOS drop the new utterance: give it a moment.
  if (speechSynthesis.speaking || speechSynthesis.pending) {
    speechSynthesis.cancel();
    await new Promise((r) => setTimeout(r, 150));
  }
  if (!voice) { await waitForVoices(); voice = pickVoice(lang.slice(0, 2)); }
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = rate;
    u.volume = 1;
    if (voice) u.voice = voice;
    const guard = setTimeout(resolve, 8000); // never hang if iOS drops the end event
    u.onend = () => { clearTimeout(guard); resolve(); };
    u.onerror = () => { clearTimeout(guard); resolve(); };
    speechSynthesis.speak(u);
    if (speechSynthesis.paused) speechSynthesis.resume();
  });
}
if (ttsAvailable()) speechSynthesis.onvoiceschanged = () => { voice = null; };

// ---------------------------------------------------------------- recognition
const SR: any = typeof window !== 'undefined' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null;
export const recognitionAvailable = () => !!SR;

/** Listen once and return the transcript (fr-FR). Resolves '' if nothing was heard. */
export function recognizeOnce(lang = 'fr-FR', timeoutMs = 8000): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!SR) return reject(new Error('unsupported'));
    const r = new SR();
    r.lang = lang;
    r.interimResults = false;
    r.maxAlternatives = 1;
    let text = '';
    const timer = setTimeout(() => r.stop(), timeoutMs);
    r.onresult = (e: any) => { text = Array.from(e.results).map((x: any) => x[0].transcript).join(' '); };
    r.onerror = (e: any) => { clearTimeout(timer); e.error === 'no-speech' ? resolve('') : reject(new Error(e.error)); };
    r.onend = () => { clearTimeout(timer); resolve(text); };
    r.start();
  });
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[’']/g, ' ').replace(/[^a-z0-9\s-]/g, ' ').split(/[\s-]+/).filter(Boolean);

/** Marks each expected word as heard or missed. */
export function wordsHeard(expected: string, heard: string) {
  const h = norm(heard);
  return expected.split(/(\s+)/).map((tok) => {
    if (/^\s+$/.test(tok)) return { tok, ok: true, space: true };
    const n = norm(tok);
    if (!n.length) return { tok, ok: true, space: false };
    return { tok, ok: n.every((w) => h.includes(w)), space: false };
  });
}
