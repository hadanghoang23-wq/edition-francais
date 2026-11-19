import { type ReactNode, useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import type { Gender } from '../engine/types';

export function TopBar({ title, back, right, kicker }: { title?: ReactNode; back?: string | true; right?: ReactNode; kicker?: ReactNode }) {
  const nav = useNavigate();
  return (
    <header className="safe-top sticky top-0 z-30 border-b hairline px-4 pb-2 backdrop-blur"
      style={{ background: 'color-mix(in srgb, var(--paper) 90%, transparent)' }}>
      <div className="flex min-h-[44px] items-center gap-2">
        {back && (
          <button aria-label="Quay lại" className="-ml-2 flex h-11 w-11 items-center justify-center text-2xl"
            onClick={() => (back === true ? nav(-1) : nav(back))}>←</button>
        )}
        <div className="min-w-0 flex-1">
          {kicker && <div className="kicker truncate">{kicker}</div>}
          {title && <div className="truncate text-[15px] font-semibold">{title}</div>}
        </div>
        {right}
      </div>
    </header>
  );
}

export function Page({ children, className = '' }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.main initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.2, 0.7, 0.2, 1] }} className={`mx-auto w-full max-w-[640px] px-4 pb-32 ${className}`}>
      {children}
    </motion.main>
  );
}

export function Kicker({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`kicker ${className}`}>{children}</div>;
}

export function Rule({ className = '' }: { className?: string }) {
  return <hr className={`border-t hairline ${className}`} />;
}

const ARTICLE_SPACE = (a?: string | null) => (a && !a.endsWith("'") ? `${a} ` : a ?? '');
/** A noun with its article, coloured by gender everywhere in the app. */
export function GenderWord({ lemma, article, gender, className = '' }: { lemma: string; article?: string | null; gender?: Gender; className?: string }) {
  const cls = gender === 'm' ? 'g-m' : gender === 'f' ? 'g-f' : gender === 'mf' ? 'g-mf' : '';
  return (
    <span className={`${cls} ${className}`}>
      {article && <span className="opacity-70">{ARTICLE_SPACE(article)}</span>}
      {lemma}
    </span>
  );
}

export function GenderTag({ gender }: { gender?: Gender }) {
  if (!gender) return null;
  const label = gender === 'm' ? 'nam' : gender === 'f' ? 'nữ' : 'nam/nữ';
  const cls = gender === 'm' ? 'g-m' : gender === 'f' ? 'g-f' : 'g-mf';
  return <span className={`kicker ${cls} border border-current px-1.5 py-0.5 text-[10px]`}>{gender === 'mf' ? 'm/f' : gender} · {label}</span>;
}

export function TtsBadge() {
  return <span className="kicker border border-current px-1 text-[9px]" title="Giọng máy (TTS), không phải audio của sách">TTS</span>;
}

export function Sheet({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: ReactNode; title?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/40" onClick={onClose} />
          <motion.div role="dialog" aria-modal className="safe-bottom relative max-h-[92vh] w-full max-w-[640px] overflow-y-auto border-t-2 bg-paper px-4 pt-3"
            style={{ borderColor: 'var(--ink)' }}
            initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 60 }} transition={{ type: 'spring', damping: 30, stiffness: 320 }}>
            <div className="mx-auto mb-2 h-1 w-10 bg-[var(--rule)]" />
            <div className="mb-2 flex items-center">
              <div className="flex-1 text-[15px] font-semibold">{title}</div>
              <button className="h-11 w-11 text-xl" aria-label="Đóng" onClick={onClose}>✕</button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Empty({ title, body, to, cta }: { title: string; body: string; to?: string; cta?: string }) {
  return (
    <div className="mt-10 border-t-2 pt-6" style={{ borderColor: 'var(--ink)' }}>
      <div className="display vi text-4xl">{title}</div>
      <p className="mt-3 max-w-[38ch] text-[15px] leading-relaxed text-muted">{body}</p>
      {to && <Link to={to} className="btn btn-ink mt-6">{cta}</Link>}
    </div>
  );
}

export function Progress({ value, color = 'var(--ink)' }: { value: number; color?: string }) {
  return (
    <div className="h-[3px] w-full bg-[var(--rule)]">
      <div className="h-full transition-[width] duration-500" style={{ width: `${Math.round(value * 100)}%`, background: color }} />
    </div>
  );
}

export function Toast({ msg }: { msg: string | null }) {
  return (
    <AnimatePresence>
      {msg && (
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
          className="fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 bg-ink px-4 py-2 text-[14px] text-paper">{msg}</motion.div>
      )}
    </AnimatePresence>
  );
}
