import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { compareIntonation, dtwAlign, extractContour, normalise } from './pitch';
import { judgeTyping, type LexItem } from '../features/vocab/lexicon';
import { db } from './db';
import { importPack } from './pack';
import { applyRating, buildQueue, Rating } from './srs';
import { voiceKey } from './voice';

function tone(hz: number[], sr = 16000, segSec = 0.25) {
  const out = new Float32Array(Math.round(hz.length * segSec * sr));
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const f = hz[Math.min(hz.length - 1, Math.floor(i / (segSec * sr)))];
    phase += (2 * Math.PI * f) / sr;
    out[i] = 0.5 * Math.sin(phase) + 0.2 * Math.sin(2 * phase);
  }
  return out;
}

describe('pitch', () => {
  it('measures a one-octave rise as about +12 semitones relative to the median', () => {
    const c = extractContour(tone([150, 150, 300, 300]), 16000);
    const voiced = [...c.st].filter((v) => !Number.isNaN(v));
    const span = Math.max(...voiced) - Math.min(...voiced);
    expect(span).toBeGreaterThan(10.5);
    expect(span).toBeLessThan(13.5);
  });

  it('DTW aligns a slower copy of the same contour closely', () => {
    const a = normalise(extractContour(tone([140, 180, 140, 220]), 16000));
    const b = normalise(extractContour(tone([140, 140, 180, 180, 140, 140, 220, 220], 16000, 0.25), 16000));
    const r = compareIntonation(a, dtwAlign(a, b));
    expect(r.meanDiff).toBeLessThan(1.5);
  });

  it('flags syllable-by-syllable wobble (Vietnamese-tone pattern) against a flat native line', () => {
    const native = normalise(extractContour(tone([150, 150, 150, 150, 150, 150]), 16000));
    const wobbly = normalise(extractContour(tone([150, 200, 120, 210, 115, 205], 16000, 0.12), 16000));
    const r = compareIntonation(native, dtwAlign(native, wobbly));
    expect(r.wobbleMine).toBeGreaterThan(r.wobbleNative);
  });
});

describe('voice pack keys', () => {
  it('hashes text exactly like pipeline/build_voice_pack.py', async () => {
    expect(await voiceKey('bain')).toBe('f158806ce66c26bb');
    expect(await voiceKey("l'été")).toBe('c3a67ad75f017839');
    expect(await voiceKey('l’été')).toBe('c3a67ad75f017839'); // curly apostrophe normalised
    expect(await voiceKey('  La  France ')).toBe('e93cc3d224173a01');
    expect(await voiceKey('G')).toBe('54fd1711209fb1c0');
  });
});

describe('typing judgment', () => {
  const item: LexItem = { id: 'x', unitId: 'u', unitNumber: 0, lemma: 'été', article: "l'", gender: 'm', pos: 'noun', ipa: '/e.te/', vi: 'mùa hè' };
  it('accepts the exact form with article', () => expect(judgeTyping("l'été", item)).toBe('exact'));
  it('separates accent errors from spelling errors', () => expect(judgeTyping("l'ete", item)).toBe('accents'));
  it('notices a missing article', () => expect(judgeTyping('été', item)).toBe('article'));
  it('rejects a wrong word', () => expect(judgeTyping('hiver', item)).toBe('wrong'));
});

async function sha(data: Uint8Array) {
  const b = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

describe('pack import + SRS', () => {
  it('imports a pack, verifies hashes, creates cards, and schedules a review', async () => {
    const unit = {
      id: 'u99', number: 99, title: 'Test', printedPages: [1, 1], accent: '#000', sections: [], docs: [], boxes: [],
      vocab: [{ id: 'u99-v1', lemma: 'chat', article: 'le', gender: 'm', pos: 'noun', ipa: '/ʃa/', vi: 'con mèo', example: null }],
      grammar: [], phonetics: [], exercises: [], tasks: [], flags: [],
    };
    const tracks = [{ id: 't999', number: 999, file: 'audio/t999.mp3', durationMs: 1000, unitId: 'u99', printedPage: 1, heading: 'h', kind: 'items',
      alignment: { method: 'asr', matchRatio: 1 }, segments: [{ idx: 0, start: 0, end: 1, text: 'Bonjour', speaker: null, label: null, line: 0, vi: 'Xin chào', confidence: 1 }] }];
    const files: Record<string, Uint8Array> = {
      'unit.json': strToU8(JSON.stringify(unit)),
      'tracks.json': strToU8(JSON.stringify(tracks)),
      'audio/t999.mp3': new Uint8Array([1, 2, 3]),
    };
    const manifest = { packId: 'test-u99', format: 1, kind: 'unit', lang: 'fr', uiLang: 'vi', book: { title: 'T', edition: '', publisher: '' },
      unitId: 'u99', unitNumber: 99, title: 'Test', version: '1', createdAt: '', pageOffset: 4,
      files: Object.fromEntries(await Promise.all(Object.entries(files).map(async ([k, v]) => [k, { bytes: v.length, sha256: await sha(v) }]))) };
    const zip = zipSync({ ...files, 'manifest.json': strToU8(JSON.stringify(manifest)) });
    const res = await importPack(new Blob([zip]));
    expect(res.segments).toBe(1);
    expect(await db.tracks.get('t999')).toBeTruthy();
    expect(await db.cards.count()).toBe(3); // fr-vi, vi-fr, gender

    const q = await buildQueue();
    expect(q.fresh.length).toBe(3);
    await applyRating(q.fresh[0], Rating.Good);
    const after = await db.cards.get(q.fresh[0].id);
    expect(after!.introduced).toBe(true);
    expect(after!.due.getTime()).toBeGreaterThan(Date.now());

    // A corrupted file is refused.
    const bad = zipSync({ ...files, 'audio/t999.mp3': new Uint8Array([9]), 'manifest.json': strToU8(JSON.stringify(manifest)) });
    await expect(importPack(new Blob([bad]))).rejects.toThrow();
  });
});
