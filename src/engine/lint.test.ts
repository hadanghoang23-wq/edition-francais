import { describe, expect, it } from 'vitest';
import { lintFrench, targetWords, wordCount } from './lint';

const kinds = (t: string, lex: string[] = []) => lintFrench(t, lex).map((h) => `${h.kind}:${h.suggestion}`);

describe('lintFrench', () => {
  it('flags missing elision but not h aspiré', () => {
    expect(kinds('Je aime le cinéma.')).toContain("elision:J'aime");
    expect(kinds('Le ami de Paul.')).toContain("elision:L'ami");
    expect(kinds('Je habite à Hanoï.')).toContain("elision:J'habite");
    expect(kinds('Le hockey, je adore.').filter((k) => k.startsWith('elision'))).toEqual(["elision:j'adore"]);
  });
  it('flags contractions', () => {
    expect(kinds('Je parle de le film.')).toContain('contraction:du');
    expect(kinds('Je vais à le cinéma.')).toContain('contraction:au');
    expect(kinds('Il a le livre.').some((k) => k.startsWith('contraction'))).toBe(false);
  });
  it('knows s\'appeler is pronominal and à after verbs of place', () => {
    expect(kinds('Je appelle Ha.')).toContain("grammar:Je m'appelle");
    expect(kinds("j'appelle Ha.")).toContain("grammar:je m'appelle");
    expect(kinds('Tu appelles Paul ?')).toContain("grammar:Tu t'appelles");
    expect(kinds("J'habite a Hanoï.")).toContain('accent:à');
    expect(kinds('Il a Paul comme ami.').some((k) => k === 'accent:à')).toBe(false);
  });
  it('flags être for age', () => {
    expect(kinds('Je suis 25 ans.')).toContain("grammar:j'ai 25 ans");
  });
  it('flags missing accents only on known, unambiguous words', () => {
    expect(kinds('Je suis francais et tres content.')).toEqual(expect.arrayContaining(['accent:français', 'accent:très']));
    expect(kinds('Il a un livre ou un disque.').some((k) => k.startsWith('accent'))).toBe(false);
    expect(kinds('Elle est coreenne.', ['coréenne'])).toContain('accent:coréenne');
  });
  it('checks capitals and French spacing', () => {
    expect(kinds('bonjour. je m\'appelle Ha.')).toEqual(expect.arrayContaining(['capital:B', 'capital:J']));
    expect(kinds('Et vous?')).toContain('punctuation: ?');
    expect(kinds('Et vous ?').some((k) => k.startsWith('punctuation'))).toBe(false);
  });
  it('accepts a correct short text', () => {
    expect(lintFrench("Bonjour ! Je m'appelle Ha. J'ai 25 ans. Je suis vietnamienne et j'habite à Hanoï. J'aime le cinéma et la musique.", ['vietnamienne'])).toEqual([]);
  });
});

describe('helpers', () => {
  it('counts words and reads targets', () => {
    expect(wordCount("Je m'appelle Ha, j'ai 25 ans.")).toBe(6);
    expect(targetWords('Complétez la fiche. (30 à 40 mots)')).toEqual([30, 40]);
    expect(targetWords('Écrivez la fiche.')).toBeNull();
  });
});
