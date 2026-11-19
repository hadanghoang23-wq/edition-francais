import { type ReactNode, useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import type { Gender } from '../engine/types';
import { Icon } from './icons';

/** Slow, composed easing used for every transition (no springs). */
export const EASE = [0.22, 0.61, 0.36, 1] as const;
export const DUR = 0.42;

/**
 * Running header, like the head of a magazine page: tracked label on the left,
 * meta on the right, a gold hairline underneath.
 */
export function TopBar({ title, back, right, kicker }: { title?: ReactNode; back?: string | true; right?: ReactNode; kicker?: ReactNode }) {
  const nav = useNavigate();
  return (
    <header className="safe-top sticky top-0 z-30 px-6" style={{ background: 'var(--paper)' }}>
      <div className="flex min-h-[44px] items-center gap-2">
        {back && (
          <button aria-label="Quay lại" className="-ml-3 flex h-11 w-11 items-center justify-center text-ink"
            onClick={() => (back === true ? nav(-1) : nav(back))}><Icon name="back" size={20} /></button>
        )}
        <div className="min-w-0 flex-1">
          <div className="t-label truncate">{kicker}{kicker && title ? <span className="mx-2 text-faint">·</span> : null}{title && <span className="text-ink2">{title}</span>}</div>
        </div>
        {right}
      </div>
      <div className="gold-rule" />
    </header>
  );
}

export function Page({ children, className = '' }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.main initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DUR, ease: EASE }} className={`mx-auto w-full max-w-[600px] px-6 pb-36 ${className}`}>
      {children}
    </motion.main>
  );
}

export function Kicker({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`t-label ${className}`}>{children}</div>;
}

export function Rule({ className = '' }: { className?: string }) {
  return <div className={`rule ${className}`} />;
}

/** Section heading with an editorial number: "01  Shadowing". */
export function Section({ n, title, meta, children, className = '' }: { n?: string; title: ReactNode; meta?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <section className={`mt-12 ${className}`}>
      <div className="flex items-baseline gap-3">
        {n && <span className="t-num text-[15px] text-accent">{n}</span>}
        <h2 className="t-label flex-1 !text-ink">{title}</h2>
        {meta && <span className="t-label">{meta}</span>}
      </div>
      <div className="rule mt-3" />
      {children}
    </section>
  );
}

/** A row in a numbered list: numeral · title/sub · meta. */
export function Row({ n, title, sub, meta, to, onClick, children }: { n?: ReactNode; title: ReactNode; sub?: ReactNode; meta?: ReactNode; to?: string; onClick?: () => void; children?: ReactNode }) {
  const body = (
    <>
      {n !== undefined && <span className="t-num w-7 shrink-0 pt-[2px] text-[17px] text-accent">{n}</span>}
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-normal leading-snug text-ink">{title}</div>
        {sub && <div className="mt-0.5 truncate">{sub}</div>}
      </div>
      {meta !== undefined && <span className="t-num shrink-0 pt-[2px] text-[17px] text-ink2">{meta}</span>}
      {children}
    </>
  );
  const cls = 'flex min-h-[56px] w-full items-start gap-4 border-b border-[var(--rule)] py-4 text-left';
  if (to) return <Link to={to} className={cls}>{body}</Link>;
  if (onClick) return <button onClick={onClick} className={cls}>{body}</button>;
  return <div className={cls}>{body}</div>;
}

const ARTICLE_SPACE = (a?: string | null) => (a && !a.endsWith("'") ? `${a} ` : a ?? '');
/** A noun with its article, in the serif, coloured by gender everywhere in the app. */
export function GenderWord({ lemma, article, gender, className = '' }: { lemma: string; article?: string | null; gender?: Gender; className?: string }) {
  const cls = gender === 'm' ? 'g-m' : gender === 'f' ? 'g-f' : gender === 'mf' ? 'g-mf' : '';
  return (
    <span className={`serif ${cls} ${className}`}>
      {article && <span className="t-gloss opacity-80">{ARTICLE_SPACE(article)}</span>}
      {lemma}
    </span>
  );
}

export function GenderTag({ gender }: { gender?: Gender }) {
  if (!gender) return null;
  const label = gender === 'm' ? 'masculin · giống đực' : gender === 'f' ? 'féminin · giống cái' : 'm. / f.';
  const color = gender === 'm' ? 'var(--masc)' : gender === 'f' ? 'var(--fem)' : 'var(--mf)';
  return <span className="t-label" style={{ color }}>{label}</span>;
}

export function TtsBadge() {
  return <span className="t-label !text-[8.5px] !tracking-[0.18em]" title="Giọng máy (TTS), không phải audio của sách">tts</span>;
}

export function Sheet({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: ReactNode; title?: ReactNode }) {
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: DUR, ease: EASE }}>
          <div className="absolute inset-0" style={{ background: 'var(--scrim)' }} onClick={onClose} />
          <motion.div role="dialog" aria-modal className="safe-bottom relative max-h-[92vh] w-full max-w-[600px] overflow-y-auto px-6 pt-4"
            style={{ background: 'var(--paper)', boxShadow: 'var(--shadow)' }}
            initial={reduce ? false : { y: 32, opacity: 0.6 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 32, opacity: 0 }} transition={{ duration: DUR, ease: EASE }}>
            <div className="flex min-h-[44px] items-center">
              <div className="t-label flex-1">{title}</div>
              <button className="-mr-3 flex h-11 w-11 items-center justify-center" aria-label="Đóng" onClick={onClose}><Icon name="close" size={20} /></button>
            </div>
            <div className="gold-rule mb-6" />
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Composed empty state: label, italic serif line, gold rule, explanation, one action. */
export function Empty({ title, body, to, cta, kicker = 'Trang trống' }: { title: string; body: string; to?: string; cta?: string; kicker?: string }) {
  return (
    <div className="mt-16">
      <Kicker>{kicker}</Kicker>
      <div className="t-display mt-4 italic">{title}</div>
      <div className="gold-rule mt-6 w-12" />
      <p className="t-body measure mt-6 text-ink2">{body}</p>
      {to && <Link to={to} className="btn btn-primary mt-8">{cta}</Link>}
    </div>
  );
}

/** Loading: a running header-sized label and a breathing hairline. Never a blank screen. */
export function Loading({ label = 'Đang mở' }: { label?: string }) {
  return (
    <div className="mx-auto max-w-[600px] px-6 pt-24">
      <div className="t-label breathe">{label}…</div>
      <div className="mt-4 h-px w-16 bg-[var(--gold)] breathe" />
    </div>
  );
}

/** Error note: hairline in the accent, label, plain sentence. */
export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div className="mt-6 border-t border-[var(--accent)] pt-3" role="alert">
      <div className="t-label !text-accent">Có lỗi</div>
      <p className="t-body mt-1 text-ink">{children}</p>
    </div>
  );
}

export function Progress({ value, color = 'var(--accent)' }: { value: number; color?: string }) {
  return (
    <div className="h-px w-full bg-[var(--rule)]">
      <div className="h-px transition-[width] duration-500 ease-maison" style={{ width: `${Math.round(value * 100)}%`, background: color }} />
    </div>
  );
}

export function Toast({ msg }: { msg: string | null }) {
  return (
    <AnimatePresence>
      {msg && (
        <motion.div initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 12, opacity: 0 }} transition={{ duration: DUR, ease: EASE }}
          className="fixed bottom-28 left-1/2 z-[60] w-[calc(100%-48px)] max-w-[420px] -translate-x-1/2 px-5 py-3 text-[13px]"
          style={{ background: 'var(--ink)', color: 'var(--paper)', boxShadow: 'var(--shadow)', borderRadius: 2 }}>{msg}</motion.div>
      )}
    </AnimatePresence>
  );
}

/** Words as options; the chosen one is underlined. */
export function Options<T extends string | number>({ value, options, onChange, serif = false }: { value: T; options: [T, string][]; onChange: (v: T) => void; serif?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3">
      {options.map(([v, l]) => (
        <button key={String(v)} className={`opt ${serif ? 'serif text-[19px]' : 'text-[14px]'}`} aria-pressed={value === v} onClick={() => onChange(v)}>
          <span className="opt-u pb-0.5">{l}</span>
        </button>
      ))}
    </div>
  );
}

/** Renders "/…/" spans in the IPA font, so titles like « é /e/ hay è /ɛ/ » never fall back to a system font. */
export function WithIpa({ text }: { text: string }) {
  const parts = text.split(/(\/[^/\s][^/]*\/)/g);
  return <>{parts.map((p, i) => (/^\/.+\/$/.test(p) ? <span key={i} className="ipa">{p}</span> : <span key={i}>{p}</span>))}</>;
}

/** Roman numerals for the ladder and tables of contents. */
export const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];
export const FR_NUM = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze'];
export const two = (n: number) => String(n).padStart(2, '0');
