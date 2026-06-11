import { chromium } from '@playwright/test';
import { mkdirSync, readdirSync, renameSync } from 'node:fs';

const BASE = process.env.SHOT_BASE || 'http://127.0.0.1:4173';
const OUT = '/tmp/him_rec';
mkdirSync(OUT, { recursive: true });
const stamp = Date.now().toString().slice(-6);
const screenname = 'deldemo' + stamp;
const email = `deldemo${stamp}@example.com`;
const password = `Del-${stamp}-aB!`;
console.log('THROWAWAY', screenname, email);

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
    const body = await resp.text().catch(() => '');
    console.log('DELETE_RESPONSE', resp.status(), body.slice(0, 600));
  }
});
const pause = (ms) => page.waitForTimeout(ms);

try {
  // 1. Create a throwaway account
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await pause(1800);
  await page.getByRole('button', { name: 'Create account' }).first().click();
  await pause(1200);
  await page.getByPlaceholder('e.g. sk8erboi99').fill(screenname);
  await pause(400);
  await page.getByPlaceholder('your@email.com').fill(email);
  await pause(400);
  await page.getByPlaceholder('Create a password').fill(password);
  await pause(400);
  await page.getByTestId('checkbox-age').check();
  await page.getByTestId('checkbox-art9').check();
  await pause(900);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/hi-its-me/, { timeout: 30000 });
  await pause(2800);

  // 2. ⋯ (Settings) menu -> Account
  await page.getByRole('button', { name: 'Settings' }).click();
  await pause(1400);
  await page.getByRole('button', { name: 'Account' }).click();
  await page.waitForURL(/\/account$/, { timeout: 15000 });
  await pause(1600);

  // 3. Scroll to + open Delete account
  await page.getByTestId('account-delete-cta').scrollIntoViewIfNeeded();
  await pause(1400);
  await page.getByTestId('account-delete-cta').click();
  await page.waitForURL(/\/account\/delete/, { timeout: 15000 });
  await pause(1800);

  // 4. Complete the two-step confirmation
  await page.getByTestId('delete-confirm-input').fill(screenname);
  await pause(1200);
  await page.getByTestId('delete-confirm-submit').click();
  await pause(1400);
  await page.getByTestId('delete-final-confirm').click();
  await pause(6000); // deletion + redirect back to sign-in
  const url = page.url();
  if (/\/account\/delete/.test(url)) {
    const text = await page.locator('body').innerText().catch(() => '(no text)');
    console.log('DELETE_FAILED url=', url);
    console.log('PAGE_TEXT:', text.replace(/\s+/g, ' ').slice(0, 700));
  } else {
    console.log('DELETED_OK', screenname, '-> url', url);
  }
} catch (e) {
  console.log('REC_ERROR', e.message);
  await page.screenshot({ path: `${OUT}/error.png` }).catch(() => {});
} finally {
  await ctx.close();
  await browser.close();
}

const vids = readdirSync(OUT).filter((f) => f.endsWith('.webm'));
if (vids.length) {
  renameSync(`${OUT}/${vids[vids.length - 1]}`, `${OUT}/account-deletion.webm`);
  console.log('VIDEO /tmp/him_rec/account-deletion.webm');
}
