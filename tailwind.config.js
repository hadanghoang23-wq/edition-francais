/** @type {import('tailwindcss').Config} */
// Spacing follows an 8pt rhythm: use 2 (8px), 4 (16px), 6 (24px), 8 (32px), 10, 12, 16.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        paper: 'var(--paper)',
        paper2: 'var(--paper-2)',
        ink: 'var(--ink)',
        ink2: 'var(--ink-2)',
        muted: 'var(--muted)',
        faint: 'var(--faint)',
        accent: 'var(--accent)',
        gold: 'var(--gold)',
        masc: 'var(--masc)',
        fem: 'var(--fem)',
        ok: 'var(--ok)',
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['"Be Vietnam Pro"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"Noto Sans Mono"', 'ui-monospace', 'monospace'],
      },
      transitionTimingFunction: { maison: 'cubic-bezier(0.22, 0.61, 0.36, 1)' },
    },
  },
  plugins: [],
};
