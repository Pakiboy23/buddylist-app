// App Store screenshot generator. Drives the built web app at exact iPhone 6.9"
// resolution (1290x2796) and captures the key screens for submission.
//
// Usage (server must already be serving dist/, e.g. `vite preview`):
//   SHOT_BASE=http://127.0.0.1:4173 \
//   SHOT_SCREENNAME=appreviewer2026 SHOT_PASSWORD=... \
//   node scripts/store-screenshots.mjs
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.SHOT_BASE || 'http://127.0.0.1:4173';
const SCREENNAME = process.env.SHOT_SCREENNAME;
const PASSWORD = process.env.SHOT_PASSWORD;
const OUT = process.env.SHOT_OUT || '/tmp/him_shots';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 430, height: 932 }, // x deviceScaleFactor 3 = 1290x2796 (6.9")
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  colorScheme: 'dark',
});
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));

async function shot(name, settle = 2500) {
  await page.waitForTimeout(settle);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('  shot', name, '->', page.url());
}
async function step(label, fn) {
  try {
    await fn();
  } catch (e) {
    console.log('  STEP_FAIL', label, e.message);
    await page.screenshot({ path: `${OUT}/${label}-FAIL.png` }).catch(() => {});
  }
}

// 1. Login (hero) — logged out
await step('01-login', async () => {
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await shot('01-login', 2500);
});

// Sign in as the review account
await step('login-action', async () => {
  await page.getByPlaceholder('e.g. sk8erboi99').fill(SCREENNAME);
  await page.getByPlaceholder('Enter password').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/hi-its-me/, { timeout: 30000 });
});

// 2. Profile / presence
await step('02-profile', async () => {
  await shot('02-profile', 3500);
});

// 3. Group Chats tab (joined rooms)
await step('03-groupchats', async () => {
  await page.locator('.ui-tabbar-label', { hasText: 'Group Chats' }).click();
  await shot('03-groupchats', 3000);
});

// 4. Open New York City room -> live chat (7 messages)
await step('04-room-chat', async () => {
  await page.getByText('New York City', { exact: true }).first().click();
  await shot('04-room-chat', 4000);
});

// 5. Rooms discovery (all 7 seeded rooms)
await step('05-rooms', async () => {
  await page.goto(`${BASE}/hi-its-me/rooms`, { waitUntil: 'load' });
  await shot('05-rooms', 3000);
});

// 6. IM tab — buddy list / conversations (presence)
await step('06-im', async () => {
  await page.goto(`${BASE}/hi-its-me`, { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  await page.locator('.ui-tabbar-label', { hasText: 'IM' }).click();
  await shot('06-im', 3000);
});

// 7. A 1:1 DM conversation (the core of the app)
await step('07-dm', async () => {
  await page.goto(`${BASE}/hi-its-me`, { waitUntil: 'load' });
  await page.waitForTimeout(2000);
  await page.locator('.ui-tabbar-label', { hasText: 'IM' }).click();
  await page.waitForTimeout(2500);
  await page.getByText('Jinxed_Zombie', { exact: true }).first().click(); // opens buddy profile sheet
  await page.waitForTimeout(1500);
  await page.getByText('Send IM', { exact: true }).first().click(); // opens the DM thread
  await shot('07-dm', 3500);
});

// 8. Away message composer (signature AIM feature)
await step('08-away', async () => {
  await page.goto(`${BASE}/hi-its-me`, { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: 'Away message' }).click();
  await shot('08-away', 2500);
});

await browser.close();
console.log('DONE');
