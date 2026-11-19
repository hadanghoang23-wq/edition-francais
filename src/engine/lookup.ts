import { db } from './db';
import { stripAccents } from './diff';
import type { Gender } from './types';

/** One dictionary entry for tap-a-word, built from the imported units (vocab, verbs, countries, numbers). */
export interface WordEntry {
  surface: string;
  lemma: string;
  article?: string | null;
  gender?: Gender;
  ipa: string;
  vi: string;
  kind: 'vocab' | 'verb' | 'country' | 'nationality' | 'number' | 'custom';
  refId?: string;          // vocab / country id, for "add to deck"
  note?: string;
  example?: string;
  unitNumber?: number;
}

const ELISION = /^(l|d|j|m|t|s|n|qu|c|jusqu|lorsqu|puisqu)'/;

export const normWord = (w: string) => w.toLowerCase().replace(/[’`]/g, "'").replace(/^[«»"“”(.,;:!?…—–-]+|[«»"“”).,;:!?…—–-]+$/g, '');

let cache: Map<string, WordEntry> | null = null;
export function invalidateLookup() { cache = null; }

export async function buildLookup(): Promise<Map<string, WordEntry>> {
  if (cache) return cache;
  const map = new Map<string, WordEntry>();
  const put = (surface: string, e: WordEntry) => {
    const k = normWord(surface);
    if (k && !map.has(k)) map.set(k, e);
    const s = stripAccents(k);
    if (s !== k && !map.has('~' + s)) map.set('~' + s, e);
  };
  for (const { data: u } of await db.units.orderBy('number').toArray()) {
    for (const v of u.vocab) {
      const e: WordEntry = { surface: v.lemma, lemma: v.lemma, article: v.article, gender: v.gender, ipa: v.ipa, vi: v.vi, kind: 'vocab', refId: v.id, note: v.note, example: v.example?.fr, unitNumber: u.number };
      if (!v.lemma.includes(' ')) put(v.lemma, e);
      for (const f of Object.values(v.forms ?? {})) for (const w of String(f).split(' ').slice(-1)) put(w, e);
    }
    for (const c of u.countries ?? []) {
      put(c.country, { surface: c.country, lemma: c.country, article: c.article, gender: c.gender, ipa: c.ipa, vi: c.vi, kind: 'country', refId: c.id, note: `« ${c.prep} ${c.country} »`, unitNumber: u.number });
      put(c.nat.m, { surface: c.nat.m, lemma: c.nat.m, ipa: c.nat.ipaM, vi: `(người / thuộc) ${c.vi} — giống đực`, kind: 'nationality', refId: c.id, note: `giống cái: ${c.nat.f}`, unitNumber: u.number });
      put(c.nat.f, { surface: c.nat.f, lemma: c.nat.m, ipa: c.nat.ipaF, vi: `(người / thuộc) ${c.vi} — giống cái`, kind: 'nationality', refId: c.id, note: `giống đực: ${c.nat.m}`, unitNumber: u.number });
    }
    for (const verb of u.verbs ?? []) {
      put(verb.infinitive.replace(/^s'/, ''), { surface: verb.infinitive, lemma: verb.infinitive, ipa: verb.ipa, vi: verb.vi, kind: 'verb', note: verb.group, unitNumber: u.number });
      for (const [person, form, ipa] of verb.present ?? []) {
        const last = form.split(' ').slice(-1)[0].replace(ELISION, '');
        put(last, { surface: last, lemma: verb.infinitive, ipa, vi: `${verb.vi} — ${person} ${form}`, kind: 'verb', note: `động từ ${verb.infinitive}, thì hiện tại`, unitNumber: u.number });
      }
    }
    for (const ns of u.numberSets ?? []) for (const it of ns.items ?? []) put(it.words, { surface: it.words, lemma: it.words, ipa: it.ipa, vi: `số ${it.n}`, kind: 'number', unitNumber: u.number });
  }
  for (const c of await db.customCards.toArray()) {
    const last = c.front.split(' ').slice(-1)[0];
    put(last, { surface: c.front, lemma: c.front, ipa: c.ipa ?? '', vi: c.back, kind: 'custom', refId: c.id, gender: c.gender });
  }
  cache = map;
  return map;
}

/** Look a tapped word up, trying the elided form (l'été → été) and an accent-insensitive match. */
export function lookupWord(map: Map<string, WordEntry>, raw: string): WordEntry | null {
  const w = normWord(raw);
  const bare = w.replace(ELISION, '');
  return map.get(w) ?? map.get(bare) ?? map.get('~' + stripAccents(bare)) ?? null;
}

/** Split French text into tappable words and the spaces/punctuation between them. */
export function splitWords(text: string): { t: string; word: boolean }[] {
  return text.split(/([\p{L}\p{M}'’-]+)/u).filter((s) => s !== '').map((t) => ({ t, word: /[\p{L}]/u.test(t) }));
}
