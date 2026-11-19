// Offline self-check for short A1 texts: no AI, no network. Catches the mistakes a Vietnamese
// learner makes most at this level (elision, contractions, être/avoir for age, missing accents,
// capitals, French spacing before ? ! : ;). Rules are deliberately conservative: a false alarm
// teaches the wrong thing, so anything uncertain is phrased as « kiểm tra lại ».
import { stripAccents } from './diff';

export interface LintHit { start: number; end: number; text: string; suggestion?: string; kind: 'elision' | 'contraction' | 'grammar' | 'accent' | 'capital' | 'punctuation'; vi: string }

const VOWEL = 'aeiouyàâäéèêëîïôöûùüœæ';
// Words starting with an aspirated h (no elision). Short A1-relevant list.
const H_ASPIRE = new Set(['haut', 'haute', 'hollandais', 'hollandaise', 'hongrois', 'hongroise', 'héros', 'hockey', 'huit', 'hamburger', 'handball', 'hasard', 'honte', 'hall']);

const ELIDE: Record<string, string> = { je: "j'", me: "m'", te: "t'", se: "s'", le: "l'", la: "l'", de: "d'", ne: "n'", que: "qu'" };

/** Accent-free form → accented form, from the learner's own word list (lexicon) plus common A1 words. */
const COMMON_ACCENTED = ['été', 'très', 'déjà', 'à', 'où', 'français', 'française', 'étudiant', 'étudiante', 'école', 'ça', 'garçon', 'frère', 'père', 'mère', 'café', 'cinéma', 'télé', 'téléphone', 'âge', 'préféré', 'préférée', 'américain', 'américaine', 'mexicain', 'célibataire', 'marié', 'mariée', 'né', 'née', 'élève', 'deuxième', 'troisième', 'première', 'là', 'voilà', 'après', 'éléphant', 'musée', 'réalisateur', 'écrivain', 'médecin', 'prénom', 'numéro', 'adresse', 'désolé', 'désolée', 'enchanté', 'enchantée', 'bientôt', 'fenêtre', 'même', 'êtes', 'août', 'février', 'décembre', 'québécois', 'québécoise', 'sénégalais', 'sénégalaise', 'coréen', 'coréenne', 'européen', 'européenne', 'chinois'];

export function lintFrench(text: string, lexicon: string[] = []): LintHit[] {
  const hits: LintHit[] = [];
  const add = (h: LintHit) => { if (!hits.some((x) => x.start < h.end && h.start < x.end)) hits.push(h); };
  let m: RegExpExecArray | null;

  // 0. s'appeler is pronominal: « je appelle Ha » / « j'appelle Ha » means "I call Ha".
  const reApp = /(?<!\p{L})(je|j'|tu|il|elle)\s*(appelle|appelles)(?!\p{L})/giu;
  const PRON: Record<string, string> = { je: "je m'appelle", "j'": "je m'appelle", tu: "tu t'appelles", il: "il s'appelle", elle: "elle s'appelle" };
  while ((m = reApp.exec(text))) {
    const [all, subj] = m;
    let sug = PRON[subj.toLowerCase()];
    if (subj[0] === subj[0].toUpperCase()) sug = sug[0].toUpperCase() + sug.slice(1);
    add({ start: m.index, end: m.index + all.length, text: all, suggestion: sug, kind: 'grammar', vi: `« Tên là » dùng động từ phản thân s'appeler (verbe pronominal): cần đại từ me / te / se → « ${sug} ». Thiếu đại từ thì nghĩa thành « gọi ai đó ».` });
  }

  // 0b. « à » (to / in a city) written as « a » (has) after a verb of place.
  const reA = /(?<!\p{L})(habite|habites|habitez|habitons|habitent|vais|vas|va|allons|allez|vont|suis|es|est|sommes|êtes|sont|travaille|travailles|étudie|études)\s+a(?=\s+\p{Lu})/gu;
  while ((m = reA.exec(text))) {
    const pos = m.index + m[0].length - 1;
    add({ start: pos, end: pos + 1, text: 'a', suggestion: 'à', kind: 'accent', vi: '« à » (ở, tới — giới từ) có dấu huyền; « a » không dấu là động từ avoir (« có »). Trước tên thành phố: « à Hanoï ».' });
  }

  // 1. Elision: je aime → j'aime, le ami → l'ami, de Italie → d'Italie.
  const reEl = new RegExp(`\\b(je|me|te|se|le|la|de|ne|que)\\s+(h?[${VOWEL}][\\p{L}'-]*)`, 'giu');
  while ((m = reEl.exec(text))) {
    const [all, w, next] = m;
    const lw = w.toLowerCase();
    if (H_ASPIRE.has(next.toLowerCase())) continue;
    if (lw === 'le' || lw === 'la') { if (/^(un|une|onze|oui|y)$/i.test(next)) continue; }
    const cap = w[0] === w[0].toUpperCase() ? ELIDE[lw][0].toUpperCase() + ELIDE[lw].slice(1) : ELIDE[lw];
    const h = next.toLowerCase().startsWith('h');
    add({ start: m.index, end: m.index + all.length, text: all, suggestion: `${cap}${next}`, kind: 'elision',
      vi: h ? `Trước h câm thường lược âm: « ${w} » → « ${cap} » (élision). Kiểm tra lại nếu đây là h bật hơi (h aspiré).` : `Trước nguyên âm, « ${w} » mất e/a và thành « ${cap} » (élision).` });
  }

  // 2. Contractions: de le → du, de les → des, à le → au, à les → aux.
  // (JS \b is ASCII-only, so boundaries around « à » use Unicode lookarounds.)
  const reCt = /(?<!\p{L})(de|à)\s+(le|les)(?!\p{L})/giu;
  while ((m = reCt.exec(text))) {
    const [all, p, art] = m;
    const sug = p.toLowerCase() === 'de' ? (art.toLowerCase() === 'le' ? 'du' : 'des') : (art.toLowerCase() === 'le' ? 'au' : 'aux');
    add({ start: m.index, end: m.index + all.length, text: all, suggestion: sug, kind: 'contraction', vi: `« ${p} + ${art} » luôn gộp thành « ${sug} » (article contracté).` });
  }

  // 3. Age with être: je suis 25 ans → j'ai 25 ans.
  const reAge = /\b(je suis|tu es|il est|elle est|nous sommes|vous êtes|vous etes|ils sont|elles sont)\s+(\d+|[a-zé-]+)\s+ans\b/giu;
  const AVOIR: Record<string, string> = { 'je suis': "j'ai", 'tu es': 'tu as', 'il est': 'il a', 'elle est': 'elle a', 'nous sommes': 'nous avons', 'vous êtes': 'vous avez', 'vous etes': 'vous avez', 'ils sont': 'ils ont', 'elles sont': 'elles ont' };
  while ((m = reAge.exec(text))) {
    const [all, subj, n] = m;
    add({ start: m.index, end: m.index + all.length, text: all, suggestion: `${AVOIR[subj.toLowerCase()]} ${n} ans`, kind: 'grammar', vi: 'Nói tuổi dùng động từ avoir (« có »), không dùng être: « J\'ai 25 ans ».' });
  }

  // 4. Missing accents on known words.
  const known = new Map<string, string>();
  for (const w of [...COMMON_ACCENTED, ...lexicon]) {
    const k = stripAccents(w.toLowerCase());
    if (k !== w.toLowerCase() && !known.has(k)) known.set(k, w.toLowerCase());
  }
  // Words that also exist without accents.
  const AMBIG = new Set(['a', 'ou', 'la', 'des', 'du', 'mais', 'marie', 'ne', 'sur', 'eleve', 'age', 'mur', 'meme']);
  const reW = /[\p{L}]+/gu;
  while ((m = reW.exec(text))) {
    const w = m[0];
    const lw = w.toLowerCase();
    if (AMBIG.has(lw) || lw.length < 2) continue;
    const acc = known.get(lw);
    if (acc && acc !== lw) {
      const sug = w[0] === w[0].toUpperCase() ? acc[0].toUpperCase() + acc.slice(1) : acc;
      add({ start: m.index, end: m.index + w.length, text: w, suggestion: sug, kind: 'accent', vi: `Thiếu dấu: « ${sug} ». Dấu trong tiếng Pháp là một phần của chính tả, thiếu dấu là sai từ.` });
    }
  }

  // 5. Capital letter at the start of each sentence.
  const reCap = /(^|[.!?]\s+)(\p{Ll})/gu;
  while ((m = reCap.exec(text))) {
    const pos = m.index + m[1].length;
    add({ start: pos, end: pos + 1, text: m[2], suggestion: m[2].toUpperCase(), kind: 'capital', vi: 'Đầu câu viết hoa.' });
  }

  // 6. French spacing: a space before ? ! : ; (once is enough as a reminder).
  const rePunct = /(\p{L})([?!:;])/gu;
  if ((m = rePunct.exec(text))) {
    add({ start: m.index + 1, end: m.index + 2, text: m[2], suggestion: ` ${m[2]}`, kind: 'punctuation', vi: 'Tiếng Pháp có khoảng trắng trước ? ! : ; (khác tiếng Anh và tiếng Việt).' });
  }

  return hits.sort((a, b) => a.start - b.start);
}

export const wordCount = (t: string) => (t.match(/[\p{L}\d]+(?:['’-][\p{L}\d]+)*/gu) ?? []).length;

/** "30 à 40 mots" in an instruction → [30, 40]. */
export function targetWords(instr: string): [number, number] | null {
  const m = instr.match(/(\d+)\s*(?:à|-|–)\s*(\d+)\s*mots/i);
  return m ? [Number(m[1]), Number(m[2])] : null;
}
