/**
 * Answer checking for dictation and typed answers.
 * - Case and punctuation never count.
 * - Accent mistakes (é/è/e, ç/c, à/a…) are reported separately from spelling mistakes.
 * - Tolerant mode accepts accent-only mistakes as correct (they are still shown).
 */

export const stripAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe').replace(/æ/g, 'ae');

/** Lowercase, unify apostrophes, drop punctuation at word edges. */
export function normToken(t: string) {
  return t.toLowerCase().replace(/[’`´]/g, "'").replace(/^[«»"“”(\[.,;:!?…—–-]+|[«»"“”)\].,;:!?…—–-]+$/g, '');
}

export function tokenize(text: string): string[] {
  return text.replace(/[’`´]/g, "'").replace(/([«»])/g, ' ').split(/\s+/).map(normToken).filter(Boolean);
}

function lev(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

export type TokenVerdict = 'ok' | 'accent' | 'spelling' | 'wrong';
export function compareToken(given: string, expected: string): TokenVerdict {
  const g = normToken(given), e = normToken(expected);
  if (g === e) return 'ok';
  if (stripAccents(g) === stripAccents(e)) return 'accent';
  if (lev(stripAccents(g), stripAccents(e)) <= Math.max(1, Math.floor(e.length / 4))) return 'spelling';
  return 'wrong';
}

export interface DiffOp { type: 'ok' | 'accent' | 'spelling' | 'wrong' | 'missing' | 'extra'; expected?: string; given?: string }

/** Word-level alignment of what you typed against the reference text. */
export function diffWords(givenText: string, expectedText: string): DiffOp[] {
  const G = tokenize(givenText), E = tokenize(expectedText);
  const cost = { ok: 0, accent: 0.25, spelling: 0.55, wrong: 1.2 } as const;
  const n = E.length, m = G.length;
  const D = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  const P = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 1; i <= n; i++) { D[i][0] = i; P[i][0] = 1; }
  for (let j = 1; j <= m; j++) { D[0][j] = j; P[0][j] = 2; }
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const sub = D[i - 1][j - 1] + cost[compareToken(G[j - 1], E[i - 1])];
      const del = D[i - 1][j] + 1, ins = D[i][j - 1] + 1;
      const best = Math.min(sub, del, ins);
      D[i][j] = best;
      P[i][j] = best === sub ? 0 : best === del ? 1 : 2;
    }
  }
  const ops: DiffOp[] = [];
  let i = n, j = m;
  while (i > 0 || j > 0) {
    const p = i > 0 && j > 0 ? P[i][j] : i > 0 ? 1 : 2;
    if (p === 0) { ops.push({ type: compareToken(G[j - 1], E[i - 1]), expected: E[i - 1], given: G[j - 1] }); i--; j--; }
    else if (p === 1) { ops.push({ type: 'missing', expected: E[i - 1] }); i--; }
    else { ops.push({ type: 'extra', given: G[j - 1] }); j--; }
  }
  return ops.reverse();
}

export function scoreDiff(ops: DiffOp[], tolerant: boolean) {
  const expected = ops.filter((o) => o.type !== 'extra').length;
  const good = ops.filter((o) => o.type === 'ok' || (tolerant && o.type === 'accent')).length;
  const extra = ops.filter((o) => o.type === 'extra').length;
  return {
    score: expected ? Math.max(0, good - extra * 0.5) / expected : 0,
    accents: ops.filter((o) => o.type === 'accent').length,
    spelling: ops.filter((o) => o.type === 'spelling').length,
    wrong: ops.filter((o) => o.type === 'wrong').length,
    missing: ops.filter((o) => o.type === 'missing').length,
    extra,
  };
}

/** Whole-answer check for short typed answers (gap fills, conjugations, articles). */
export type AnswerVerdict = 'exact' | 'accent' | 'wrong';
export function gradeAnswer(given: string, expected: string | string[], tolerant = false): AnswerVerdict {
  const alts = (Array.isArray(expected) ? expected : [expected]).map((e) => tokenize(e).join(' '));
  const g = tokenize(given).join(' ');
  if (alts.includes(g)) return 'exact';
  if (alts.map(stripAccents).includes(stripAccents(g))) return tolerant ? 'exact' : 'accent';
  return 'wrong';
}

/** Gap markers used in the exercise data: "…..", ".....", "____". */
export const GAP = /(?:_{2,}|…+\.*|\.{3,})/g;

/**
 * Derive the expected fill(s) for a prompt with gaps from a full-sentence answer,
 * e.g. ("J'aime …..", "J'aime le cinéma.") → ["le cinéma"].
 * If the answer does not contain the prompt's fixed text, it is taken as the fill itself.
 */
export function fillsFromAnswer(prompt: string, answer: string): string[] {
  const fixed = prompt.split(GAP);
  const gaps = fixed.length - 1;
  if (gaps <= 0) return [answer];
  const a = answer.replace(/[’]/g, "'");
  const parts = fixed.map((f) => f.replace(/[’]/g, "'").trim());
  if (!parts.some((p) => p.length > 1 && a.toLowerCase().includes(p.toLowerCase().slice(0, Math.min(6, p.length))))) {
    // Answer is the fill itself; several gaps may be given as "a / b".
    const split = answer.split(/\s*\/\s*/);
    return split.length === gaps ? split : [answer];
  }
  const fills: string[] = [];
  let pos = 0;
  const low = a.toLowerCase();
  for (let k = 0; k < gaps; k++) {
    const before = parts[k], after = parts[k + 1];
    if (before) { const at = low.indexOf(before.toLowerCase(), pos); if (at >= 0) pos = at + before.length; }
    let end = a.length;
    const afterCore = after.replace(/[.!?…\s]+$/, '');
    if (afterCore) { const at = low.indexOf(afterCore.toLowerCase(), pos); if (at >= 0) end = at; }
    else end = a.replace(/[.!?…\s]+$/, '').length;
    fills.push(a.slice(pos, end).trim());
    pos = end;
  }
  return fills;
}
