import { db } from '../../engine/db';
import type { AudioRef, BookExample, Gender } from '../../engine/types';

/** A uniform view of everything a card can point to (unit vocab, countries, your own cards). */
export interface LexItem {
  id: string;
  unitId: string | null;
  unitNumber: number | null;
  lemma: string;
  article?: string | null;
  gender?: Gender;
  pos: string;
  ipa: string;
  vi: string;
  forms?: { m?: string; f?: string };
  extra?: string;
  loan?: string;
  note?: string;
  example?: BookExample | null;
  audio?: AudioRef | null;
}

export async function loadLexicon(): Promise<Map<string, LexItem>> {
  const map = new Map<string, LexItem>();
  for (const { data: u } of await db.units.toArray()) {
    for (const v of u.vocab) {
      map.set(v.id, { id: v.id, unitId: u.id, unitNumber: u.number, lemma: v.lemma, article: v.article, gender: v.gender, pos: v.pos,
        ipa: v.ipa, vi: v.vi, forms: v.forms, loan: v.viLoanword, note: v.note, example: v.example, audio: v.example?.audio ?? null });
    }
    for (const c of u.countries ?? []) {
      map.set(c.id, { id: c.id, unitId: u.id, unitNumber: u.number, lemma: c.country, article: c.article, gender: c.gender, pos: 'noun',
        ipa: c.ipa, vi: c.vi, extra: `${c.nat.m} · ${c.nat.f}  ${c.nat.ipaM === c.nat.ipaF ? c.nat.ipaM : `${c.nat.ipaM} · ${c.nat.ipaF}`}`,
        note: `« ${c.prep} ${c.country} » = ở ${c.vi}${c.note ? ` — ${c.note}` : ''}`, example: c.example ?? null, audio: c.example?.audio ?? null });
    }
  }
  for (const c of await db.customCards.toArray()) {
    map.set(c.id, { id: c.id, unitId: null, unitNumber: null, lemma: c.front, gender: c.gender, pos: 'custom', ipa: c.ipa ?? '', vi: c.back });
  }
  return map;
}

export const articleOf = (x: LexItem) => (x.article ? (x.article.endsWith("'") ? x.article : `${x.article} `) : '');
export const fullForm = (x: LexItem) => `${articleOf(x)}${x.lemma}`;

const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const tidy = (s: string) => s.toLowerCase().replace(/[’]/g, "'").replace(/[.!?…,;:]/g, '').replace(/\s+/g, ' ').trim();

/** exact | accents (only accent marks differ) | article (missing/wrong article) | wrong */
export function judgeTyping(given: string, x: LexItem): 'exact' | 'accents' | 'article' | 'wrong' {
  const g = tidy(given);
  const targets = [fullForm(x), x.lemma, ...(x.forms ? Object.values(x.forms) : [])].map(tidy);
  if (g === tidy(fullForm(x)) || (!x.article && targets.includes(g))) return 'exact';
  if (targets.map(strip).includes(strip(g)) && strip(g) === strip(tidy(fullForm(x)))) return 'accents';
  if (x.article && targets.includes(g)) return 'article';
  if (targets.map(strip).includes(strip(g))) return 'accents';
  return 'wrong';
}
