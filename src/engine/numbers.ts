/** French cardinal numbers 0–100 in words (traditional hyphenation, as in Édito). Mirrors pipeline/fr_numbers.py. */
const UNITS = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize'];
const TENS: Record<number, string> = { 20: 'vingt', 30: 'trente', 40: 'quarante', 50: 'cinquante', 60: 'soixante' };

export function frNumber(n: number): string {
  if (n <= 16) return UNITS[n];
  if (n < 20) return 'dix-' + UNITS[n - 10];
  if (n < 70) {
    const t = Math.floor(n / 10) * 10, u = n % 10;
    return u === 0 ? TENS[t] : TENS[t] + (u === 1 ? ' et un' : '-' + UNITS[u]);
  }
  if (n < 80) return n === 71 ? 'soixante et onze' : 'soixante-' + frNumber(n - 60);
  if (n === 80) return 'quatre-vingts';
  if (n < 100) return 'quatre-vingt-' + frNumber(n - 80);
  if (n === 100) return 'cent';
  return String(n);
}

export function ageOn(birthIso: string, today = new Date()) {
  const b = new Date(birthIso);
  let a = today.getFullYear() - b.getFullYear();
  if (today.getMonth() < b.getMonth() || (today.getMonth() === b.getMonth() && today.getDate() < b.getDate())) a--;
  return a;
}
