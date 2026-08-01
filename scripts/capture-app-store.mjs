/**
 * capture-app-store.mjs — self-contained App Store screenshot capture.
 *
 * Run on the Mac (normal network) from the repo root:
 *
 *   npm run build            # if dist/ is stale; produces the web bundle
 *   SN=pakiboy24 PW=Tester1234 node scripts/capture-app-store.mjs
 *
 * Captures the authenticated WEB screens at the 6.9" App Store size
 * (1320×2868) using a real mobile viewport, logging in with the seed account.
 * Output: screenshots/app-store/iphone-6.9/*.png
 *
 * The native-Swift hero screens (presence-first BuddyList, and Circles/Knock if
 * you want the native shell rather than the web view) are NOT here — grab those
 * from the Simulator with:  xcrun simctl io booted screenshot <name>.png
 *
 * Env:
 *   SN / PW            seed screenname + password (required for auth screens)
 *   PORT               vite preview port (default 4173)
 *   DEVICE             6.9 | 6.5 | 5.5 (default 6.9)
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT ?? '4173';
const BASE = `http://localhost:${PORT}`;
const SN = process.env.SN ?? '';
const PW = process.env.PW ?? '';

// CSS points × scale → exact App Store pixels. 6.9": 440×956@3x = 1320×2868.
const DEVICES = {
  '6.9': { id: 'iphone-6.9', width: 440, height: 956, dsf: 3 },
  '6.5': { id: 'iphone-6.5', width: 428, height: 926, dsf: 3 },
  '5.5': { id: 'iphone-5.5', width: 414, height: 736, dsf: 3 },
};
const device = DEVICES[process.env.DEVICE ?? '6.9'] ?? DEVICES['6.9'];
const OUT = path.join(ROOT, 'screenshots', 'app-store', device.id);

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function serverUp(url, timeoutMs = 20000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const ok = await new Promise((res) => {
      const req = http.get(url, (r) => { r.resume(); res(true); });
      req.on('error', () => res(false));
      req.setTimeout(1000, () => { req.destroy(); res(false); });
    });
    if (ok) return true;
    await wait(400);
  }
  return false;
}

async function main() {
  if (!SN || !PW) { console.error('Set SN and PW (seed screenname/password).'); process.exit(1); }
  await fs.mkdir(OUT, { recursive: true });

  // Start vite preview if not already running (serves the built dist/).
  let server = null;
  if (!(await serverUp(BASE, 1000))) {
    console.log(`Starting vite preview on ${PORT}…`);
    server = spawn('npx', ['vite', 'preview', '--port', PORT, '--host', 'localhost'], { cwd: ROOT, stdio: 'ignore' });
    if (!(await serverUp(BASE))) { console.error('Preview did not start — run `npm run build` first.'); process.exit(1); }
  }

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: device.width, height: device.height },
    deviceScaleFactor: device.dsf,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  });
  const page = await ctx.newPage();
  const shot = async (name) => {
    const p = path.join(OUT, `${name}.png`);
    await page.screenshot({ path: p, type: 'png' });
    console.log(`  ✓ ${name}.png`);
  };
  const visible = (loc, ms = 3000) => loc.first().isVisible({ timeout: ms }).catch(() => false);

  try {
    // Sign in
    console.log(`Device ${device.id} (${device.width * device.dsf}×${device.height * device.dsf}) — signing in as ${SN}…`);
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await wait(2500);
    await shot('01_sign-in');
    await page.locator('input.ui-screenname').first().fill(SN);
    await page.locator('input[autocomplete="current-password"]').first().fill(PW);
    await page.locator('button[type="submit"]').first().click();
    const ok = await page.waitForURL('**/hi-its-me**', { timeout: 30000 }).then(() => true).catch(() => false);
    if (!ok) { console.error('Login did not reach /hi-its-me — check the seed credentials.'); }
    await wait(4000);

    // 04 Buddy list (shows Buddy Circles for an account that has them)
    await shot('04_buddy-list');

    // 05 DM (shows the Knock button) — open the first conversation
    const dm = page.locator('[data-testid^="dm-row-"]');
    if (await visible(dm)) { await dm.first().click(); await wait(2500); await shot('05_direct-message'); }
    else console.log('  – no DM row (need a buddy conversation)');

    // 07 Profile + mutual context — open from the DM header (stable testid)
    const openProfile = page.locator('[data-testid="dm-header-open-profile"]');
    if (await visible(openProfile)) { await openProfile.first().click(); await wait(2200); await shot('07_profile-mutual'); }
    else console.log('  – profile-open control not visible');

    // 06 Chat rooms
    await page.goto(`${BASE}/hi-its-me`, { waitUntil: 'domcontentloaded', timeout: 20000 }); await wait(2500);
    const chatTab = page.locator('.ui-tabbar-button', { hasText: /chat|room/i });
    if (await visible(chatTab)) { await chatTab.first().click(); await wait(2500); await shot('06_chat-rooms'); }
    else console.log('  – rooms/chat tab not visible');

    // 08 Away-message composer (best-effort)
    await page.goto(`${BASE}/hi-its-me`, { waitUntil: 'domcontentloaded', timeout: 20000 }); await wait(2000);
    const away = page.getByRole('button', { name: /away message|set.*status|set.*away|edit.*status/i })
      .or(page.locator('button', { hasText: /away message/i }));
    if (await visible(away, 2500)) { await away.first().click().catch(() => {}); await wait(1500); await shot('08_away-message'); }
    else console.log('  – away-composer trigger not found (capture from Simulator)');
  } finally {
    await browser.close();
    if (server) server.kill('SIGKILL');
  }
  console.log(`\nDone → ${OUT}`);
  process.exit(0);
}
await main();
