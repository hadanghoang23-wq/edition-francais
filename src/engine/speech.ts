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

export function speak(text: string, { lang = 'fr-FR', rate = 0.9 } = {}): Promise<void> {
  if (!ttsAvailable()) return Promise.resolve();
  speechSynthesis.cancel();
  if (!voice) voice = pickVoice(lang.slice(0, 2));
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = rate;
    if (voice) u.voice = voice;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    speechSynthesis.speak(u);
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
