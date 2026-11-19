import { describe, expect, it } from 'vitest';
import { diffWords, fillsFromAnswer, gradeAnswer, scoreDiff } from './diff';

describe('dictation diff', () => {
  it('separates accent mistakes from spelling mistakes', () => {
    const ops = diffWords('Je suis nee au vietnam', 'Je suis née au Vietnam !');
    expect(ops.map((o) => o.type)).toEqual(['ok', 'ok', 'accent', 'ok', 'ok']);
    expect(scoreDiff(ops, false).score).toBeCloseTo(0.8);
    expect(scoreDiff(ops, true).score).toBe(1);
  });
  it('finds missing, extra and misspelt words', () => {
    const ops = diffWords("bonjour je mapelle boris boris", "Bonjour, je m'appelle Boris.");
    const t = ops.map((o) => o.type);
    expect(t).toContain('spelling');
    expect(t).toContain('extra');
    expect(diffWords('je suis', 'je ne suis pas').filter((o) => o.type === 'missing').length).toBe(2);
  });
});

describe('answers', () => {
  it('grades accents separately and accepts tolerant mode', () => {
    expect(gradeAnswer('française', 'française')).toBe('exact');
    expect(gradeAnswer('francaise', 'française')).toBe('accent');
    expect(gradeAnswer('francaise', 'française', true)).toBe('exact');
    expect(gradeAnswer('anglaise', 'française')).toBe('wrong');
    expect(gradeAnswer('L’été', "l'été")).toBe('exact');
  });
  it('derives gap fills from full-sentence answers', () => {
    expect(fillsFromAnswer("J'aime …..", "J'aime le cinéma.")).toEqual(['le cinéma']);
    expect(fillsFromAnswer("J'habite ….. Pérou, ….. Lima.", "J'habite au Pérou, à Lima.")).toEqual(['au', 'à']);
    expect(fillsFromAnswer('Adelina : …..', 'mexicaine')).toEqual(['mexicaine']);
    expect(fillsFromAnswer('Héléna aime ….. Italie et ….. Philippines.', "l' / les")).toEqual(["l'", 'les']);
    expect(fillsFromAnswer('Elle est indien…', 'Elle est indienne.')).toEqual(['ne']);
  });
});
