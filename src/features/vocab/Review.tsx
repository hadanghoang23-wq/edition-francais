import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { CardRow } from '../../engine/db';
import { db } from '../../engine/db';
import { applyRating, buildQueue, previewIntervals, Rating } from '../../engine/srs';
import { DUR, EASE, GenderTag, GenderWord, Kicker, Loading, Progress, TopBar, two } from '../../ui/kit';
import { Icon } from '../../ui/icons';
import { AudioChip, playRefOrTts } from '../shared/AudioChip';
import { accentFor } from '../library/bookUnits';
import { fullForm, judgeTyping, loadLexicon, type LexItem } from './lexicon';

const TYPE_VI: Record<string, string> = { 'fr-vi': 'Pháp → Việt', 'vi-fr': 'Việt → Pháp', 'audio-vi': 'Nghe → nghĩa', gender: 'Giống của danh từ' };
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
  if (!queue || !lex) return <Loading label="Đang chuẩn bị thẻ" />;
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
      <TopBar back="/cards" kicker={card ? TYPE_VI[card.type] : 'Terminé'} right={<span className="t-num text-[17px] text-ink2">{Math.min(done + 1, total)} / {total}</span>} />
      <Progress value={total ? done / total : 1} />
      {card ? (
        <ReviewCard key={card.id + pos} card={card} item={lex.get(card.refId)!} onRated={onRated} />
      ) : (
        <div className="mx-auto mt-24 w-full max-w-[600px] px-6 text-center">
          <Kicker>Terminé</Kicker>
          <div className="t-hero mt-4 italic">C'est fait.</div>
          <div className="gold-rule mx-auto mt-6 w-12" />
          <p className="t-body mt-6 text-ink2">{done} lượt ôn. Thẻ khó sẽ quay lại sớm hơn.</p>
          <button className="btn btn-primary mt-10 w-full" onClick={() => nav('/')}>Về trang Hôm nay</button>
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
          <div className="text-[52px] leading-[1.02]"><GenderWord lemma={item.lemma} article={item.article} gender={item.gender} /></div>
          <div className="ipa mt-4 !text-[15px]">{item.ipa}</div>
          <div className="mt-4 flex justify-center"><AudioChip tts={say} /></div>
        </>;
      case 'audio-vi':
        return <>
          <button className="mx-auto flex h-24 w-24 items-center justify-center rounded-full text-accent" style={{ border: '1px solid var(--accent)' }} aria-label="Nghe" onClick={() => playRefOrTts(item.audio, say)}><Icon name="play" size={26} /></button>
          <p className="t-small mt-6 text-ink2">Nghe câu trong sách — từ nào, nghĩa là gì?</p>
        </>;
      case 'vi-fr':
        return <>
          <div className="text-[26px] font-light leading-snug">{item.vi}</div>
          {item.gender && item.pos === 'noun' && <div className="t-meta mt-2">gõ cả mạo từ: le, la, l', un, une…</div>}
          <input ref={input} value={typed} onChange={(e) => setTyped(e.target.value)} disabled={revealed} aria-label="Gõ từ tiếng Pháp"
            onKeyDown={(e) => e.key === 'Enter' && !revealed && checkTyping()} autoCapitalize="off" autoCorrect="off" spellCheck={false}
            className="serif mt-8 w-full border-b border-[var(--rule-strong)] bg-transparent py-3 text-center text-[34px] outline-none focus:border-[var(--ink)]" />
          {!revealed && (
            <div className="mt-4 flex flex-wrap justify-center">
              {ACCENT_BAR.map((c) => <button key={c} className="serif flex h-11 w-11 items-center justify-center text-[22px] text-ink2 active:text-accent" onClick={() => { setTyped((t) => t + c); input.current?.focus(); }}>{c}</button>)}
            </div>
          )}
        </>;
      case 'gender':
        return <>
          <div className="serif text-[56px] leading-none">{item.lemma}</div>
          <div className="mt-12 grid grid-cols-2 border-y border-[var(--rule)]">
            {(['m', 'f'] as const).map((g) => {
              const col = g === 'm' ? 'var(--masc)' : 'var(--fem)';
              return (
                <button key={g} disabled={revealed} onClick={() => pickGender(g)} className={`flex min-h-[104px] flex-col items-center justify-center transition-colors duration-500 ${g === 'f' ? 'border-l border-[var(--rule)]' : ''}`}
                  style={{ color: col, background: revealed && item.gender === g ? `color-mix(in srgb, ${col} 12%, transparent)` : undefined, opacity: revealed && genderPick === g && g !== item.gender ? 0.45 : 1 }}>
                  <span className="t-gloss text-[28px]">{g === 'm' ? 'le · un' : 'la · une'}</span>
                  <span className="t-label mt-1" style={{ color: col }}>{g === 'm' ? 'masculin' : 'féminin'}</span>
                </button>
              );
            })}
          </div>
        </>;
      default:
        return null;
    }
  })();

  return (
    <div className="mx-auto flex w-full max-w-[600px] flex-1 flex-col px-6 pb-48">
      <div className="mt-4 flex items-center justify-between"><Kicker>{item.unitNumber !== null ? `Unité ${two(item.unitNumber)}` : 'Thẻ của bạn'}</Kicker><GenderTag gender={item.gender} /></div>
      <motion.div className="mt-14 text-center" initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: DUR, ease: EASE }}>
        {front}
      </motion.div>

      <AnimatePresence>
        {revealed && (
          <motion.div initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }} className="mt-12">
            <div className="gold-rule mb-6" />
            {card.type === 'vi-fr' && verdict && (
              <p className="t-small mb-4" style={{ color: verdict === 'exact' ? 'var(--ok)' : 'var(--accent)' }}>
                {verdict === 'exact' ? 'Chính xác.' : verdict === 'accents' ? 'Đúng từ nhưng sai dấu.' : verdict === 'article' ? 'Đúng từ nhưng sai hoặc thiếu mạo từ.' : 'Chưa đúng.'}
                {verdict !== 'exact' && typed && <span className="text-muted"> Bạn gõ « <span className="serif text-[17px]">{typed}</span> ».</span>}
              </p>
            )}
            {card.type !== 'fr-vi' && (
              <div className="text-[40px] leading-none"><GenderWord lemma={item.lemma} article={item.article} gender={item.gender} /></div>
            )}
            {card.type !== 'fr-vi' && <div className="ipa mt-2">{item.ipa}</div>}
            <div className="mt-3 text-[22px] font-light">{item.vi}</div>
            {item.extra && <div className="t-small mt-1 text-ink2">{item.extra}</div>}
            {item.loan && <div className="t-small mt-3"><span className="t-label mr-2">Gợi nhớ</span>≈ « {item.loan} » trong tiếng Việt</div>}
            {item.note && <div className="t-small mt-2 text-ink2">{item.note}</div>}
            {item.example && (
              <div className="mt-6 flex items-start gap-2 border-t border-[var(--rule)] pt-4">
                <span className="mt-[13px] h-px w-4 shrink-0" style={{ background: accent }} />
                <div className="min-w-0 flex-1"><p className="t-fr">{item.example.fr}</p>{item.example.printedPage && <Kicker className="mt-1">sách, p. {item.example.printedPage}</Kicker>}</div>
                {item.example.audio && <AudioChip audio={item.example.audio} />}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="safe-bottom fixed inset-x-0 bottom-0 border-t border-[var(--rule)] px-6 pt-3" style={{ background: 'var(--paper)' }}>
        <div className="mx-auto max-w-[600px] pb-1">
          {!revealed ? (
            card.type === 'vi-fr' ? <button className="btn btn-primary w-full" onClick={checkTyping}>Kiểm tra</button>
              : card.type === 'gender' ? <p className="t-label py-4 text-center">Chọn giống của danh từ</p>
              : <button className="btn btn-primary w-full" onClick={() => setRevealed(true)}>Lật thẻ</button>
          ) : (
            <div className="grid grid-cols-4">
              {[[Rating.Again, 'Lại'], [Rating.Hard, 'Khó'], [Rating.Good, 'Được'], [Rating.Easy, 'Dễ']].map(([g, l], i) => (
                <button key={g} onClick={() => rate(g as number)}
                  className={`flex min-h-[60px] flex-col items-center justify-center transition-colors duration-300 ${i ? 'border-l border-[var(--rule)]' : ''}`}
                  style={suggested === g ? { background: 'var(--ink)', color: 'var(--paper)' } : undefined}>
                  <span className="text-[14px]">{l}</span><span className="t-num text-[14px] opacity-70">{intervals[g as number]}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
