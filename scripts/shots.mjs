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

const SAMPLE = "bonjour! Je appelle Ha. je suis 25 ans. Je suis vietnamien et je habite a Hanoi. J'aime le cinema.";
const MOCK_FB = { corrected: "Bonjour ! Je m'appelle Ha. J'ai 25 ans. Je suis vietnamienne et j'habite à Hanoï. J'aime le cinéma.", issues: [
  { original: 'Je appelle', correction: "Je m'appelle", kind: 'grammar', explanation_vi: "s'appeler là động từ phản thân (verbe pronominal): cần « me », trước nguyên âm thành « m' »." },
  { original: 'je suis 25 ans', correction: "J'ai 25 ans", kind: 'grammar', explanation_vi: 'Nói tuổi dùng avoir (« có »), không dùng être.' },
  { original: 'vietnamien', correction: 'vietnamienne', kind: 'agreement', explanation_vi: 'Người viết là nữ nên tính từ quốc tịch ở giống cái (accord): -ien → -ienne.' },
  { original: 'a Hanoi', correction: 'à Hanoï', kind: 'accent', explanation_vi: '« à » (giới từ) có dấu huyền; « a » là động từ avoir. Tên riêng: Hanoï.' },
  { original: 'cinema', correction: 'cinéma', kind: 'accent', explanation_vi: 'Thiếu dấu sắc (accent aigu).' } ],
  strengths_vi: ['Đủ các ý: chào, tên, tuổi, quốc tịch, nơi ở, sở thích.', 'Câu ngắn, rõ ràng, đúng trình độ A1.'],
  overall_vi: 'Bài đúng đề và dễ hiểu. Hai điểm cần nhớ: động từ phản thân s\'appeler và hợp giống của tính từ quốc tịch.',
  task_fit_vi: 'Đủ nội dung của phiếu, độ dài hợp lý.', next_step_vi: 'Ôn bảng chia s\'appeler và bài « Il est… / Elle est… ».',
  better_version: "Bonjour ! Je m'appelle Ha, j'ai 25 ans. Je suis vietnamienne et j'habite à Hanoï. J'aime le cinéma et la musique." };
const MOCK_REPLY = { id: 'msg_mock', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [{ type: 'text', text: JSON.stringify(MOCK_FB) }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 1400, output_tokens: 950 } };

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
  // Phase 2
  ['22-practice-hub', '/practice'],
  ['23-group-nghe', '/practice/ex/nghe'],
  ['24-ex-gap-checked', '/practice/all/u01/u01-e10', async (p) => {
    const gaps = p.getByLabel('Điền vào chỗ trống');
    const n = await gaps.count();
    for (let i = 0; i < n; i++) await gaps.nth(i).fill(i === 1 ? 'etes' : i === 2 ? 'sommes' : 'suis');
    await p.getByRole('button', { name: /Kiểm tra/iu }).click(); await p.waitForTimeout(700);
  }],
  ['25-ex-match', '/practice/all/u01/u01-e04'],
  ['26-dictee-checked', '/practice/dictee/t010', async (p) => {
    await p.getByRole('textbox').first().fill('Bonjour, je mapelle Mathilde');
    await p.getByRole('button', { name: /Kiểm tra/iu }).click(); await p.waitForTimeout(700);
  }],
  ['27-gaps', '/practice/gaps/t017'],
  ['28-reader-word', '/practice/read/u01/u01-d1', async (p) => {
    await p.locator('article [role=button]').nth(3).click(); await p.waitForTimeout(900);
  }],
  ['29-verbs-wrong', '/practice/verbs', async (p) => {
    await p.getByLabel('Dạng chia').fill('suis'); await p.getByRole('button', { name: /Kiểm tra/iu }).click(); await p.waitForTimeout(500);
  }],
  ['30-articles', '/practice/articles', async (p) => { await p.locator('main button').first().click(); await p.waitForTimeout(500); }],
  ['31-error-log', '/practice/errors'],
  // Phase 3 (AI replies are mocked here: no real API call, no key needed)
  ['33-today-week', '/', async (p) => { await p.getByText(/Cette semaine/iu).first().scrollIntoViewIfNeeded(); await p.mouse.wheel(0, 200); await p.waitForTimeout(500); }],
  ['33-write-home', '/write'],
  ['34-write-selfcheck', '/write/u01/u01-k2', async (p) => {
    await p.getByLabel('Bài viết').fill(SAMPLE);
    await p.getByRole('button', { name: /Tự kiểm tra/iu }).click(); await p.waitForTimeout(800);
    await p.getByText(/Tự kiểm tra/iu).last().scrollIntoViewIfNeeded();
  }],
  ['35-write-feedback', '/write/u01/u01-k2', async (p) => {
    await p.evaluate(() => window.__db.settings.put({ key: 'apiKey', value: 'sk-ant-mock' }));
    await p.route('https://api.anthropic.com/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_REPLY) }));
    await p.reload(); await settle(p);
    await p.getByLabel('Bài viết').fill(SAMPLE);
    await p.getByRole('button', { name: /Chữa bằng AI/iu }).click();
    await p.getByText(/Bản đã chữa/iu).first().waitFor({ timeout: 15000 });
    await p.getByText(/Bản đã chữa/iu).first().scrollIntoViewIfNeeded(); await p.waitForTimeout(600);
    await p.unroute('https://api.anthropic.com/**');
  }],
  ['36-write-issues', '/write/u01/u01-k2', async (p) => {
    await p.getByText(/Từng lỗi/iu).first().scrollIntoViewIfNeeded(); await p.waitForTimeout(600);
  }],
  ['37-settings-ai', '/settings', async (p) => {
    await p.getByText(/Chữa bài bằng AI/iu).first().scrollIntoViewIfNeeded(); await p.waitForTimeout(500);
    await p.evaluate(() => window.__db.settings.delete('apiKey'));
  }],
  ['32-grammar-drills', '/unit/u01/grammar/u01-g1', async (p) => {
    await p.getByText('Exercices', { exact: false }).last().scrollIntoViewIfNeeded(); await p.waitForTimeout(500);
  }],
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
