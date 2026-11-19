/**
 * Issue numbers and cover colours only. Titles and pages come from the imported packs,
 * so the app shell itself carries no textbook content.
 */
export const BOOK_UNITS = [
  { number: 0, accent: '#B8326A' }, { number: 1, accent: '#1E7A48' }, { number: 2, accent: '#7A2E6E' },
  { number: 3, accent: '#5E7A1E' }, { number: 4, accent: '#C8302A' }, { number: 5, accent: '#1F6B5C' },
  { number: 6, accent: '#D9562B' }, { number: 7, accent: '#3E7A2B' }, { number: 8, accent: '#7B2D5A' },
  { number: 9, accent: '#6B7D1F' }, { number: 10, accent: '#C73232' }, { number: 11, accent: '#1C6E62' },
  { number: 12, accent: '#D4572A' },
];
export const accentFor = (n: number) => BOOK_UNITS.find((u) => u.number === n)?.accent ?? '#E8452C';
