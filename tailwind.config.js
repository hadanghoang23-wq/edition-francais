/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        paper: 'var(--paper)',
        paper2: 'var(--paper-2)',
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        rule: 'var(--rule)',
        tomato: 'var(--tomato)',
        cobalt: 'var(--cobalt)',
        masc: 'var(--masc)',
        fem: 'var(--fem)',
        accent: 'var(--accent)',
        ok: 'var(--ok)',
      },
      fontFamily: {
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
        sans: ['"Inter Tight"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      letterSpacing: { kicker: '0.14em' },
    },
  },
  plugins: [],
};
