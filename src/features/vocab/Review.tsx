import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { CardRow } from '../../engine/db';
import { db } from '../../engine/db';
import { applyRating, buildQueue, previewIntervals, Rating } from '../../engine/srs';
import { GenderTag, GenderWord, Kicker, Progress, TopBar } from '../../ui/kit';
import { AudioChip, playRefOrTts } from '../shared/AudioChip';
import { accentFor } from '../library/bookUnits';
import { fullForm, judgeTyping, loadLexicon, type LexItem } from './lexicon';

const TYPE_VI: Record<string, string> = { 'fr-vi': 'Pháp → Việt', 'vi-fr': 'Việt → Pháp (gõ)', 'audio-vi': 'Nghe → nghĩa', gender: 'Giống của danh từ' };
const ACCENT_BAR = ['é', 'è', 'ê', 'ë', 'à', 'â', 'ç', 'ù', 'û', 'ô', 'î', 'ï', 'œ', '«', '»'];

export default function Review() {
  const nav = useNavigate();
  const [queue, setQueue] = useState<CardRow[] | null>(null);
  const [lex, setLex] = useState<Map<string, LexItem> | null>(null);
  const [pos, setPos] = useState(0);
  const [done, setDone] = useState(0);
  useEffect(() => {
    (async () => {
      const [q, l] = await Promise.all([buildQueue(), loadLexicon()]);
      setLex(l);
      setQueue(q.queue.filter((c) => c.deck !== 'sentence' && l.has(c.refId)));
    })();
  }, []);
  if (!queue || !lex) return null;
  const card = queue[pos];
  const total = queue.length;

  const onRated = async (again: boolean) => {
    setDone((d) => d + 1);
    if (again) {
      // An "Again" card comes back later in this session.
      const fresh = await db.cards.get(card.id);
      if (fresh) setQueue((q) => [...q!, fresh]);
    }
    setPos((p) => p + 1);
  };

  return (
    <div className="flex min-h-full flex-col">
      <TopBar back="/cards" kicker={card ? TYPE_VI[card.type] : 'Xong'} title={`${Math.min(done + 1, total)} / ${total}`} />
      <Progress value={total ? done / total : 1} color="var(--accent)" />
      {card ? (
        <ReviewCard key={card.id + pos} card={card} item={lex.get(card.refId)!} onRated={onRated} />
      ) : (
        <div className="mx-auto mt-20 max-w-[640px] px-4 text-center">
          <div className="display vi text-[80px] leading-none">Xong.</div>
          <p className="mt-4 text-[15px] text-muted">{done} lượt ôn. Thẻ khó sẽ quay lại sớm hơn.</p>
          <button className="btn btn-ink mt-8 w-full" onClick={() => nav('/')}>Về trang Hôm nay</button>
        </div>
      )}
    </div>
  );
}

function ReviewCard({ card, item, onRated }: { card: CardRow; item: LexItem; onRated: (again: boolean) => void }) {
  const [revealed, setRevealed] = useState(false);
  const [typed, setTyped] = useState('');
  const [verdict, setVerdict] = useState<ReturnType<typeof judgeTyping> | null>(null);
  const [genderPick, setGenderPick] = useState<'m' | 'f' | null>(null);
  const started = useRef(Date.now());
  const input = useRef<HTMLInputElement>(null);
  const reduce = useReducedMotion();
  const intervals = previewIntervals(card);
  const accent = item.unitNumber !== null ? accentFor(item.unitNumber) : 'var(--ink)';
  const say = fullForm(item).replace('…', '');

  useEffect(() => {
    if (card.type === 'audio-vi') playRefOrTts(item.audio, say).catch(() => undefined);
    if (card.type === 'vi-fr') setTimeout(() => input.current?.focus(), 200);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const rate = async (g: number) => {
    await applyRating(card, g as any, Date.now() - started.current);
    onRated(g === Rating.Again);
  };

  const checkTyping = () => {
    const v = judgeTyping(typed, item);
    setVerdict(v);
    setRevealed(true);
    if (v !== 'exact') db.errorLog.add({ source: 'vocab', prompt: item.vi, given: typed, expected: fullForm(item), createdAt: new Date(), resolved: false });
  };
  const pickGender = async (g: 'm' | 'f') => {
    setGenderPick(g);
    setRevealed(true);
    if (g !== item.gender) await db.errorLog.add({ source: 'gender', prompt: item.lemma, given: g, expected: item.gender ?? '', createdAt: new Date(), resolved: false });
  };

  const suggested = card.type === 'vi-fr' ? (verdict === 'exact' ? Rating.Good : verdict === 'wrong' ? Rating.Again : Rating.Hard)
    : card.type === 'gender' ? (genderPick === item.gender ? Rating.Good : Rating.Again) : null;

  const front = (() => {
    switch (card.type) {
      case 'fr-vi':
        return <>
          <div className="serif text-[52px] leading-[0.95]"><GenderWord lemma={item.lemma} article={item.article} gender={item.gender} /></div>
          <div className="ipa mt-3 text-lg text-muted">{item.ipa}</div>
          <div className="mt-4 flex justify-center"><AudioChip tts={say} /></div>
        </>;
      case 'audio-vi':
        return <>
          <button className="mx-auto flex h-24 w-24 items-center justify-center rounded-full text-3xl text-white" style={{ background: accent }} onClick={() => playRefOrTts(item.audio, say)}>▶</button>
          <p className="mt-4 text-[14px] text-muted">Nghe câu trong sách — từ nào, nghĩa là gì?</p>
        </>;
      case 'vi-fr':
        return <>
          <div className="text-[28px] font-medium leading-tight">{item.vi}</div>
          {item.gender && item.pos === 'noun' && <div className="mt-2 text-[13px] text-muted">gõ cả mạo từ (le, la, l', un, une…)</div>}
          <input ref={input} value={typed} onChange={(e) => setTyped(e.target.value)} disabled={revealed}
            onKeyDown={(e) => e.key === 'Enter' && !revealed && checkTyping()} autoCapitalize="off" autoCorrect="off" spellCheck={false}
            className="serif mt-6 w-full border-b-2 bg-transparent py-2 text-center text-[32px] outline-none" style={{ borderColor: 'var(--ink)' }} />
          {!revealed && (
            <div className="mt-3 flex flex-wrap justify-center gap-1">
              {ACCENT_BAR.map((c) => <button key={c} className="chip h-10 min-w-[40px] px-2 text-[18px]" onClick={() => { setTyped((t) => t + c); input.current?.focus(); }}>{c}</button>)}
            </div>
          )}
        </>;
      case 'gender':
        return <>
          <div className="serif text-[56px] leading-none">{item.lemma}</div>
          <div className="mt-8 grid grid-cols-2 gap-3">
            {(['m', 'f'] as const).map((g) => (
              <button key={g} disabled={revealed} onClick={() => pickGender(g)} className="flex h-20 flex-col items-center justify-center border-2 text-[22px] serif"
                style={{ borderColor: g === 'm' ? 'var(--masc)' : 'var(--fem)', color: g === 'm' ? 'var(--masc)' : 'var(--fem)',
                  background: revealed && item.gender === g ? `color-mix(in srgb, ${g === 'm' ? 'var(--masc)' : 'var(--fem)'} 16%, transparent)` : undefined, opacity: revealed && genderPick === g && g !== item.gender ? 0.5 : 1 }}>
                {g === 'm' ? 'le / un' : 'la / une'}<span className="kicker" style={{ color: 'inherit' }}>{g === 'm' ? 'giống đực' : 'giống cái'}</span>
              </button>
            ))}
          </div>
        </>;
      default:
        return null;
    }
  })();

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col px-4 pb-48">
      <div className="mt-3 flex items-center justify-between"><Kicker>{item.unitNumber !== null ? `Unité ${item.unitNumber}` : 'Thẻ của bạn'}</Kicker><GenderTag gender={item.gender} /></div>
      <motion.div className="mt-10 text-center" initial={reduce ? false : { rotateX: -12, opacity: 0 }} animate={{ rotateX: 0, opacity: 1 }} transition={{ duration: 0.35 }}>
        {front}
      </motion.div>

      <AnimatePresence>
        {revealed && (
          <motion.div initial={reduce ? false : { opacity: 0, y: 16, rotateX: 50 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ type: 'spring', damping: 22, stiffness: 240 }}
            style={{ transformOrigin: 'top center' }} className="mt-8 border-t-2 pt-5" >
            {card.type === 'vi-fr' && verdict && (
              <p className="mb-3 text-[14px]" style={{ color: verdict === 'exact' ? 'var(--ok)' : 'var(--tomato)' }}>
                {verdict === 'exact' ? '✓ Chính xác' : verdict === 'accents' ? '≈ Đúng từ nhưng sai dấu' : verdict === 'article' ? '≈ Đúng từ nhưng sai/thiếu mạo từ' : '✗ Chưa đúng'}
                {verdict !== 'exact' && typed && <span className="text-muted"> — bạn gõ « {typed} »</span>}
              </p>
            )}
            {card.type !== 'fr-vi' && (
              <div className="serif text-[40px] leading-none"><GenderWord lemma={item.lemma} article={item.article} gender={item.gender} /></div>
            )}
            {card.type !== 'fr-vi' && <div className="ipa mt-1 text-muted">{item.ipa}</div>}
            <div className="mt-2 text-[22px] font-medium">{item.vi}</div>
            {item.extra && <div className="mt-1 text-[14px] text-muted">{item.extra}</div>}
            {item.loan && <div className="mt-2 text-[14px]"><span className="kicker">Gợi nhớ</span> ≈ « {item.loan} » trong tiếng Việt</div>}
            {item.note && <div className="mt-2 text-[14px] text-muted">{item.note}</div>}
            {item.example && (
              <div className="mt-4 flex items-start gap-2 border-l-2 pl-3" style={{ borderColor: accent }}>
                <div className="min-w-0 flex-1"><p className="serif text-[19px] leading-snug">{item.example.fr}</p>{item.example.printedPage && <Kicker>sách, p. {item.example.printedPage}</Kicker>}</div>
                {item.example.audio && <AudioChip audio={item.example.audio} />}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="safe-bottom fixed inset-x-0 bottom-0 border-t-2 bg-paper px-4 pt-3" style={{ borderColor: 'var(--ink)' }}>
        <div className="mx-auto max-w-[640px] pb-1">
          {!revealed ? (
            card.type === 'vi-fr' ? <button className="btn btn-ink h-14 w-full" onClick={checkTyping}>Kiểm tra</button>
              : card.type === 'gender' ? <p className="py-4 text-center text-[13px] text-muted">Chọn giống của danh từ</p>
              : <button className="btn btn-ink h-14 w-full" onClick={() => setRevealed(true)}>Lật thẻ</button>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {[[Rating.Again, 'Lại'], [Rating.Hard, 'Khó'], [Rating.Good, 'Được'], [Rating.Easy, 'Dễ']].map(([g, l]) => (
                <button key={g} onClick={() => rate(g as number)} className={`btn h-14 flex-col !gap-0 px-1 ${suggested === g ? 'btn-ink' : 'btn-ghost'}`}>
                  <span>{l}</span><span className="text-[11px] opacity-70">{intervals[g as number]}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
