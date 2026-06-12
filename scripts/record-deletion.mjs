import { chromium } from '@playwright/test';
import { mkdirSync, readdirSync, renameSync } from 'node:fs';

const BASE = process.env.SHOT_BASE || 'http://127.0.0.1:4173';
const OUT = '/tmp/him_rec';
mkdirSync(OUT, { recursive: true });

const stamp = Date.now().toString().slice(-6);
const SIGNIN = process.env.SIGNIN_SCREENNAME;       // if set, sign in instead of signing up
const SKIP_DELETE = process.env.SKIP_DELETE === '1'; // stop after reaching the app (no delete)
const screenname = SIGNIN || ('deldemo' + stamp);
const email = `${screenname}@example.com`;
const password = process.env.SIGNIN_PASSWORD || `Del-${stamp}-aB!`;
console.log('CREDS', screenname, '|', email, '|', password);

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 430, height: 932 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  colorScheme: 'dark',
  recordVideo: { dir: OUT, size: { width: 430, height: 932 } },
});
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('response', async (resp) => {
  if (resp.url().includes('/delete-account') && resp.request().method() === 'POST') {
    console.log('DELETE_RESPONSE', resp.status(), (await resp.text().catch(() => '')).slice(0, 700));
  }
});
const pause = (ms) => page.waitForTimeout(ms);

try {
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await pause(1800);

  if (SIGNIN) {
    await page.getByPlaceholder('e.g. sk8erboi99').fill(screenname);
    await page.getByPlaceholder('Enter password').fill(password);
    await page.locator('button[type="submit"]').click();
  } else {
    await page.getByRole('button', { name: 'Create account' }).first().click();
    await pause(1000);
    await page.getByPlaceholder('e.g. sk8erboi99').fill(screenname);
    await page.getByPlaceholder('your@email.com').fill(email);
    await page.getByPlaceholder('Create a password').fill(password);
    await page.getByTestId('checkbox-age').check();
    await page.getByTestId('checkbox-art9').check();
    await pause(700);
    await page.locator('button[type="submit"]').click();
  }
  await page.waitForURL(/\/hi-its-me/, { timeout: 30000 });
  await pause(2500);

  if (SKIP_DELETE) {
    console.log('READY_NO_DELETE', screenname);
  } else {
    await page.getByRole('button', { name: 'Settings' }).click();
    await pause(1200);
    await page.getByRole('button', { name: 'Account' }).click();
    await page.waitForURL(/\/account$/, { timeout: 15000 });
    await pause(1400);
    await page.getByTestId('account-delete-cta').scrollIntoViewIfNeeded();
    await pause(1000);
    await page.getByTestId('account-delete-cta').click();
    await page.waitForURL(/\/account\/delete/, { timeout: 15000 });
    await pause(1400);
    await page.getByTestId('delete-confirm-input').fill(screenname);
    await pause(900);
    await page.getByTestId('delete-confirm-submit').click();
    await pause(1200);
    await page.getByTestId('delete-final-confirm').click();
    await pause(6000);
    console.log(/\/account\/delete/.test(page.url()) ? 'DELETE_FAILED' : 'DELETED_OK', '-> url', page.url());
  }
} catch (e) {
  console.log('REC_ERROR', e.message);
} finally {
  await ctx.close();
  await browser.close();
}
const vids = readdirSync(OUT).filter((f) => f.endsWith('.webm'));
if (vids.length && !SKIP_DELETE) {
  renameSync(`${OUT}/${vids[vids.length - 1]}`, `${OUT}/account-deletion.webm`);
}
