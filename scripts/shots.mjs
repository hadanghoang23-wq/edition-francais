// Screenshot every main screen at iPhone size (390x844 @2x), light and dark.
// Usage: node scripts/shots.mjs <outDir> [baseUrl]
// Uses the system Microsoft Edge through Playwright; dev server must be running (dev-only pack loader).
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const out = path.resolve(process.argv[2] || '../design/shots');
const base = process.argv[3] || 'http://localhost:5173/';
const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null; // e.g. ONLY="^0[1-5]"
const profile = 'D:/Tools/pw-profile';
const emptyProfile = 'D:/Tools/pw-profile-empty';

const opts = { channel: 'msedge', headless: true, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
  args: ['--autoplay-policy=no-user-gesture-required'] };

async function settle(page, ms = 900) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForTimeout(ms);
}

async function go(page, hash, ms) {
  await page.goto(base + '#' + hash);
  await settle(page, ms);
}

async function ensureData(page) {
  await go(page, '/library');
  const has = await page.evaluate(async () => (await window.__db.units.count()) >= 2);
  if (!has) {
    await go(page, '/import');
    for (const name of ['edito-a1-u00.zip', 'edito-a1-u01.zip']) {
      await page.getByRole('button', { name }).click();
      await page.getByText(name.includes('u00') ? 'Bienvenue' : 'Et vous').first().waitFor({ timeout: 60000 });
    }
  }
  // Representative progress so screens show real states (reset each run).
  await page.evaluate(async () => {
    const db = window.__db;
    await db.ladder.put({ docId: 'u01:u01-d1', unlocked: 4, counts: { 1: 2, 2: 1, 3: 1, 4: 1 }, updatedAt: new Date() });
    await db.ladder.put({ docId: 'u00:u00-d1', unlocked: 2, counts: { 1: 2, 2: 1 }, updatedAt: new Date() });
    const d = new Date(); const key = (x) => x.toISOString().slice(0, 10);
    for (let i = 0; i < 6; i++) { const day = new Date(d.getTime() - i * 864e5);
      await db.stats.put({ date: `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`, shadowMs: 14 * 60000, sentences: 18, reviews: 30, correct: 26, newCards: 0 }); }
    void key;
  });
}

const SCREENS = [
  ['01-today', '/'],
  ['02-library', '/library'],
  ['03-unit-cover', '/unit/u01'],
  ['04-unit-cover-scrolled', '/unit/u01', async (p) => { await p.mouse.wheel(0, 900); await p.waitForTimeout(500); }],
  ['05-grammar-card', '/unit/u01/grammar/u01-g1'],
  ['06-studio-home', '/studio'],
  ['07-studio-step1-blind', '/studio/u00/u00-d2'],
  ['08-studio-step5-text', '/studio/u01/u01-d1', async (p) => {
    await p.evaluate(() => { const s = document.querySelector('.sweep'); s?.style.setProperty('--p', '58%'); });
  }],
  ['09-sentence-sheet', '/studio/u01/u01-d1', async (p) => {
    await p.getByRole('button', { name: /Luyện câu/iu }).click();
    await p.waitForTimeout(2500);
  }],
  ['10-lab-home', '/lab'],
  ['11-lesson', '/lab/lesson/core:e-ferme-ouvert'],
  ['12-pair-drill', '/lab/pairs/core:e-ferme-ouvert?mode=listen'],
  ['13-speller', '/lab/spell'],
  ['14-vocab-home', '/cards'],
  ['15-review-front', '/cards/review'],
  ['16-review-back', '/cards/review', async (p) => { await p.getByRole('button', { name: /Lật thẻ/iu }).click(); await p.waitForTimeout(800); }],
  ['17-settings', '/settings'],
  ['18-import', '/import'],
];

async function run() {
  fs.mkdirSync(out, { recursive: true });
  const ctx = await chromium.launchPersistentContext(profile, opts);
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await ensureData(page);
  for (const scheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    fs.mkdirSync(path.join(out, scheme), { recursive: true });
    for (const [name, hash, act] of SCREENS) {
      if (only && !only.test(name)) continue;
      try {
        await go(page, hash);
        if (act) await act(page);
        await page.screenshot({ path: path.join(out, scheme, `${name}.png`) });
        console.log(scheme, name);
      } catch (e) { console.log('FAILED', scheme, name, e.message.split('\n')[0]); }
    }
  }
  await ctx.close();

  // Empty states: a fresh profile with no content.
  fs.rmSync(emptyProfile, { recursive: true, force: true });
  const empty = await chromium.launchPersistentContext(emptyProfile, opts);
  const ep = empty.pages()[0] ?? (await empty.newPage());
  for (const scheme of ['light', 'dark']) {
    await ep.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    for (const [name, hash] of [['19-empty-today', '/'], ['20-empty-studio', '/studio'], ['21-empty-cards', '/cards']]) {
      if (only && !only.test(name)) continue;
      await go(ep, hash);
      await ep.screenshot({ path: path.join(out, scheme, `${name}.png`) });
      console.log(scheme, name);
    }
  }
  await empty.close();
}

run().catch((e) => { console.error(e); process.exit(1); });
