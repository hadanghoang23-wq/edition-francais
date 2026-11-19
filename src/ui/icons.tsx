/** One thin-stroke icon set (24px grid, 1.1px stroke) used everywhere. No emoji, no Unicode glyphs. */
const P: Record<string, JSX.Element> = {
  today: <><circle cx="12" cy="12" r="4.5" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" /></>,
  studio: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6" /></>,
  phonetique: <path d="M2.5 12h2.5l2-5 3 10 3-14 3 12 2-3h3.5" />,
  cards: <><rect x="4" y="6.5" width="12.5" height="14.5" /><path d="M7.5 3h12.5v14.5" /></>,
  book: <><path d="M3.5 5c3-1.2 6-1.2 8.5.8 2.5-2 5.5-2 8.5-.8v14c-3-1.2-6-1.2-8.5.8-2.5-2-5.5-2-8.5-.8z" /><path d="M12 5.8v14" /></>,
  back: <path d="M15 5l-7 7 7 7" />,
  forward: <path d="M9 5l7 7-7 7" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  play: <path d="M8 5.5l11 6.5-11 6.5z" fill="currentColor" stroke="none" />,
  pause: <path d="M8.5 5.5v13M15.5 5.5v13" strokeWidth="1.6" />,
  stop: <rect x="7" y="7" width="10" height="10" fill="currentColor" stroke="none" />,
  prev: <><path d="M17 6l-7 6 7 6" /><path d="M7 6v12" /></>,
  next: <><path d="M7 6l7 6-7 6" /><path d="M17 6v12" /></>,
  record: <circle cx="12" cy="12" r="5" fill="currentColor" stroke="none" />,
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" /></>,
  loop: <><path d="M4 12a7 7 0 0 1 12-4.9L18.5 9.5" /><path d="M18.5 4.5v5h-5" /><path d="M20 12a7 7 0 0 1-12 4.9L5.5 14.5" /><path d="M5.5 19.5v-5h5" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  arrow: <path d="M4 12h15M14 6.5l5.5 5.5-5.5 5.5" />,
  speaker: <><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /></>,
  ab: <><path d="M3.5 17l3.5-10 3.5 10M4.8 13.5h4.4" /><path d="M14 7h3.5a2.5 2.5 0 0 1 0 5H14zM14 12h4a2.5 2.5 0 0 1 0 5h-4z" /></>,
  wave: <path d="M3 12h2M7 8v8M10 5v14M13 9v6M16 7v10M19 10v4M21 12h0" />,
  lock: <><rect x="5.5" y="10.5" width="13" height="10" /><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3" /></>,
  download: <path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" />,
  upload: <path d="M12 16V5M7 9.5l5-5 5 5M5 20h14" />,
  edit: <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />,
  ear: <path d="M8 9a4.5 4.5 0 1 1 9 0c0 3-3 4-3 7a3 3 0 0 1-6 0M11 9.5a1.5 1.5 0 1 1 3 0" />,
  sparkle: <path d="M12 3v5M12 16v5M3 12h5M16 12h5" />,
};

export type IconName = keyof typeof P;

export function Icon({ name, size = 22, className = '', stroke = 1.1, title }: { name: IconName; size?: number; className?: string; stroke?: number; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}>
      {title && <title>{title}</title>}
      {P[name]}
    </svg>
  );
}
