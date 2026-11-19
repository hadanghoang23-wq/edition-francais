import { useEffect, useRef, useState } from 'react';
import { ACCENTS, ALPHABET, TRICKY } from '../../content/frLab';
import { sleep } from '../../engine/audio';
import { db } from '../../engine/db';
import { speak } from '../../engine/speech';
import { Kicker, Page, TopBar, TtsBadge } from '../../ui/kit';
import { playRefOrTts, useHasAudio } from '../shared/AudioChip';

const ALPHA_TRACK = 't004'; // Unité 0, « L'alphabet » (book audio) when imported

function randomSeq() {
  const len = 3 + Math.floor(Math.random() * 3);
  return Array.from({ length: len }, () => {
    const pool = Math.random() < 0.7 ? TRICKY : ALPHABET;
    return pool[Math.floor(Math.random() * pool.length)];
  });
}

export default function Speller() {
  const [mode, setMode] = useState<'letters' | 'accents'>('letters');
  return (
    <>
      <TopBar back="/lab" kicker="Phonétique Lab" title="Đánh vần · épeler" />
      <Page>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button className="chip" aria-pressed={mode === 'letters'} onClick={() => setMode('letters')}>Chữ cái</button>
          <button className="chip" aria-pressed={mode === 'accents'} onClick={() => setMode('accents')}>Tên dấu</button>
        </div>
        {mode === 'letters' ? <Letters /> : <Accents />}
      </Page>
    </>
  );
}

function Letters() {
  const [seq, setSeq] = useState<string[]>(randomSeq);
  const [typed, setTyped] = useState('');
  const [checked, setChecked] = useState(false);
  const [stats, setStats] = useState({ ok: 0, total: 0 });
  const hasBook = useHasAudio({ trackId: ALPHA_TRACK, segIdx: 0 });
  const input = useRef<HTMLInputElement>(null);

  const play = async () => {
    for (const l of seq) {
      await playRefOrTts(hasBook ? { trackId: ALPHA_TRACK, segIdx: ALPHABET.indexOf(l) } : null, l);
      await sleep(320);
    }
  };
  useEffect(() => { input.current?.focus(); }, [seq]);

  const clean = typed.toUpperCase().replace(/[^A-Z]/g, '').split('');
  const check = async () => {
    setChecked(true);
    const ok = clean.join('') === seq.join('');
    setStats((s) => ({ ok: s.ok + (ok ? 1 : 0), total: s.total + 1 }));
    for (let i = 0; i < seq.length; i++) {
      if (clean[i] !== seq[i]) await db.errorLog.add({ source: 'spell', prompt: seq[i], given: clean[i] ?? '', expected: seq[i], createdAt: new Date(), resolved: false });
    }
  };
  const next = () => { setSeq(randomSeq()); setTyped(''); setChecked(false); };

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between"><Kicker>Nghe dãy chữ cái, gõ lại</Kicker>{!hasBook && <TtsBadge />}</div>
      <button onClick={play} className="mx-auto mt-6 flex h-24 w-24 items-center justify-center rounded-full text-3xl text-white active:scale-95" style={{ background: 'var(--accent)' }} aria-label="Nghe">▶</button>
      <p className="mt-2 text-center text-[12px] text-muted">{seq.length} chữ cái{hasBook ? ' · giọng trong sách' : ''}</p>
      <input ref={input} value={typed} onChange={(e) => { setTyped(e.target.value); setChecked(false); }}
        onKeyDown={(e) => e.key === 'Enter' && (checked ? next() : check())}
        autoCapitalize="characters" autoCorrect="off" spellCheck={false} inputMode="text" placeholder="G J E…"
        className="serif mt-6 w-full border-b-2 bg-transparent py-2 text-center text-[44px] tracking-[0.3em] outline-none" style={{ borderColor: 'var(--ink)' }} />
      {checked && (
        <div className="mt-4 flex justify-center gap-2">
          {seq.map((l, i) => (
            <div key={i} className="flex flex-col items-center">
              <span className="display text-4xl" style={{ color: clean[i] === l ? 'var(--ok)' : 'var(--tomato)' }}>{l}</span>
              {clean[i] !== l && <span className="text-[12px] text-muted line-through">{clean[i] ?? '·'}</span>}
            </div>
          ))}
        </div>
      )}
      <div className="mt-6 grid grid-cols-2 gap-2">
        <button className="btn btn-ghost" onClick={play}>▶ Nghe lại</button>
        {checked ? <button className="btn btn-ink" onClick={next}>Dãy mới →</button> : <button className="btn btn-ink" onClick={check} disabled={!typed}>Kiểm tra</button>}
      </div>
      <p className="mt-4 text-center text-[13px] text-muted">{stats.ok}/{stats.total} dãy đúng hoàn toàn</p>
      <p className="mt-6 text-[13px] leading-relaxed text-muted">Nhớ: G = /ʒe/ (gé), J = /ʒi/ (ji), E = /ø/ (ơ tròn môi), I = /i/. Ngược với tiếng Anh.</p>
    </div>
  );
}

function Accents() {
  const [target, setTarget] = useState(() => ACCENTS[Math.floor(Math.random() * 5)]);
  const [given, setGiven] = useState<string | null>(null);
  const say = () => speak(target.name);
  useEffect(() => { say(); }, [target]); // eslint-disable-line react-hooks/exhaustive-deps
  const choose = async (c: string) => {
    if (given) return;
    setGiven(c);
    if (c !== target.char) await db.errorLog.add({ source: 'spell', prompt: target.name, given: c, expected: target.char, createdAt: new Date(), resolved: false });
  };
  return (
    <div className="mt-8">
      <div className="flex items-center justify-between"><Kicker>Nghe tên dấu, chọn chữ</Kicker><TtsBadge /></div>
      <button onClick={say} className="mx-auto mt-6 flex h-24 w-24 items-center justify-center rounded-full text-3xl text-white" style={{ background: 'var(--accent)' }} aria-label="Nghe">▶</button>
      {given && <p className="serif mt-4 text-center text-[24px]">« {target.name} »</p>}
      <div className="mt-6 grid grid-cols-4 gap-2">
        {ACCENTS.map((a) => (
          <button key={a.char} onClick={() => choose(a.char)} className="flex h-16 items-center justify-center border-2 text-[30px] serif"
            style={{ borderColor: given ? (a.char === target.char ? 'var(--ok)' : a.char === given ? 'var(--tomato)' : 'var(--rule)') : 'var(--ink)' }}>{a.char}</button>
        ))}
      </div>
      {given && (
        <>
          {target.vi && <p className="mt-4 text-[14px]">{target.char} — {target.vi}</p>}
          <button className="btn btn-ink mt-6 w-full" onClick={() => { setGiven(null); setTarget(ACCENTS[Math.floor(Math.random() * ACCENTS.length)]); }}>Tiếp →</button>
        </>
      )}
    </div>
  );
}
