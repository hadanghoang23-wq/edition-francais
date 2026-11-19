import { useEffect, useRef, useState } from 'react';
import { ACCENTS, ALPHABET, TRICKY } from '../../content/frLab';
import { sleep } from '../../engine/audio';
import { db } from '../../engine/db';
import { unlockTts } from '../../engine/speech';
import { Kicker, Options, Page, TopBar, TtsBadge } from '../../ui/kit';
import { Icon } from '../../ui/icons';
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
      <TopBar back="/lab" kicker="Phonétique" title="Épeler" />
      <Page>
        <h1 className="t-display mt-10">Épeler</h1>
        <p className="t-gloss mt-1 text-[20px] text-ink2">lettre par lettre</p>
        <div className="mt-6"><Options value={mode} onChange={setMode} options={[['letters', 'Chữ cái'], ['accents', 'Tên dấu']]} /></div>
        <div className="rule" />
        {mode === 'letters' ? <Letters /> : <Accents />}
      </Page>
    </>
  );
}

function PlayRing({ onClick, label = 'Nghe' }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} aria-label={label} className="mx-auto flex h-24 w-24 items-center justify-center rounded-full text-accent transition-colors duration-300 active:bg-[var(--accent-soft)]"
      style={{ border: '1px solid var(--accent)' }}><Icon name="play" size={26} /></button>
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
    <div className="mt-10">
      <div className="flex items-baseline justify-between"><Kicker>Nghe dãy chữ cái, gõ lại</Kicker>{!hasBook && <TtsBadge />}</div>
      <div className="mt-10"><PlayRing onClick={play} /></div>
      <p className="t-meta mt-4 text-center">{seq.length} chữ cái{hasBook ? ' · giọng trong sách' : ''}</p>
      <input ref={input} value={typed} onChange={(e) => { setTyped(e.target.value); setChecked(false); }}
        onKeyDown={(e) => e.key === 'Enter' && (checked ? next() : check())}
        autoCapitalize="characters" autoCorrect="off" spellCheck={false} inputMode="text" placeholder="G  J  E"
        aria-label="Gõ các chữ cái bạn nghe được"
        className="serif mt-10 w-full border-b border-[var(--rule-strong)] bg-transparent py-3 text-center text-[44px] tracking-[0.35em] outline-none placeholder:text-faint focus:border-[var(--ink)]" />
      {checked && (
        <div className="mt-6 flex justify-center gap-4">
          {seq.map((l, i) => (
            <div key={i} className="flex flex-col items-center">
              <span className="serif text-[40px] leading-none" style={{ color: clean[i] === l ? 'var(--ok)' : 'var(--accent)' }}>{l}</span>
              {clean[i] !== l && <span className="t-meta mt-1 line-through">{clean[i] ?? '·'}</span>}
            </div>
          ))}
        </div>
      )}
      <div className="mt-10 grid grid-cols-2 gap-3">
        <button className="btn btn-line" onClick={play}><Icon name="speaker" size={15} />Nghe lại</button>
        {checked ? <button className="btn btn-primary" onClick={next}>Dãy mới</button> : <button className="btn btn-primary" onClick={check} disabled={!typed}>Kiểm tra</button>}
      </div>
      <p className="t-num mt-6 text-center text-[17px] text-muted">{stats.ok} / {stats.total} dãy đúng hoàn toàn</p>
      <div className="gold-rule mt-10" />
      <p className="t-small measure mt-4 text-ink2">Nhớ: G = <span className="ipa">/ʒe/</span> (gé), J = <span className="ipa">/ʒi/</span> (ji), E = <span className="ipa">/ø/</span> (ơ tròn môi), I = <span className="ipa">/i/</span>. Ngược với tiếng Anh.</p>
    </div>
  );
}

function Accents() {
  const [target, setTarget] = useState(() => ACCENTS[Math.floor(Math.random() * 5)]);
  const [given, setGiven] = useState<string | null>(null);
  const say = () => { unlockTts(); return playRefOrTts(null, target.name); };
  useEffect(() => { say(); }, [target]); // eslint-disable-line react-hooks/exhaustive-deps
  const choose = async (c: string) => {
    if (given) return;
    setGiven(c);
    if (c !== target.char) await db.errorLog.add({ source: 'spell', prompt: target.name, given: c, expected: target.char, createdAt: new Date(), resolved: false });
  };
  return (
    <div className="mt-10">
      <div className="flex items-baseline justify-between"><Kicker>Nghe tên dấu, chọn chữ</Kicker><TtsBadge /></div>
      <div className="mt-10"><PlayRing onClick={say} /></div>
      {given && <p className="t-gloss mt-6 text-center text-[24px]">« {target.name} »</p>}
      <div className="mt-10 grid grid-cols-4 border-t border-[var(--rule)]">
        {ACCENTS.map((a, i) => (
          <button key={a.char} onClick={() => choose(a.char)}
            className={`serif flex h-20 items-center justify-center border-b border-[var(--rule)] text-[34px] transition-colors duration-500 ${i % 4 ? 'border-l' : ''}`}
            style={{ color: given ? (a.char === target.char ? 'var(--ok)' : a.char === given ? 'var(--accent)' : 'var(--faint)') : 'var(--ink)',
              background: given && a.char === target.char ? 'color-mix(in srgb, var(--ok) 9%, transparent)' : undefined }}>{a.char}</button>
        ))}
      </div>
      {given && (
        <>
          {target.vi && <p className="t-small mt-6 text-ink2"><span className="serif text-[20px] text-ink">{target.char}</span> — {target.vi}</p>}
          <button className="btn btn-primary mt-8 w-full" onClick={() => { setGiven(null); setTarget(ACCENTS[Math.floor(Math.random() * ACCENTS.length)]); }}>Tiếp</button>
        </>
      )}
    </div>
  );
}
