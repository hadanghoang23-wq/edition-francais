/**
 * Issue numbers and each issue's accent: a muted, deep series that sits with the
 * Maison palette (used only for the cover numeral, hairlines and small details).
 * Titles and pages come from the imported packs, so the app shell carries no textbook content.
 */
export const BOOK_UNITS = [
  { number: 0, accent: '#7A2E3E' }, { number: 1, accent: '#3E5A47' }, { number: 2, accent: '#5B3A5E' },
  { number: 3, accent: '#7A6235' }, { number: 4, accent: '#6B1F2E' }, { number: 5, accent: '#2F5257' },
  { number: 6, accent: '#8A4A32' }, { number: 7, accent: '#4F5A36' }, { number: 8, accent: '#4A3A5E' },
  { number: 9, accent: '#6A5A2E' }, { number: 10, accent: '#7A3030' }, { number: 11, accent: '#2E4E48' },
  { number: 12, accent: '#86532E' },
];

/** In night mode the issue accents are lifted and desaturated toward ivory so they read on ink. */
export const accentFor = (n: number) => {
  const hex = BOOK_UNITS.find((u) => u.number === n)?.accent ?? '#6B1F2E';
  return `color-mix(in srgb, ${hex} var(--issue-mix, 100%), #EFE7D9)`;
};
