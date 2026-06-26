/**
 * generate-play-screenshots.mjs
 *
 * Captures Google Play store screenshots for H.I.M. at Android phone + tablet
 * sizes. Unauthenticated screens (sign-in, sign-up, forgot-password) are
 * rendered from the live vite-preview server. Authenticated screens (buddy
 * list, DM, rooms) use real app data when credentials are provided, otherwise
 * fall back to the same pixel-faithful HTML mockups the App Store script uses
 * (imported from take-app-store-screenshots.mjs — single source of truth).
 *
 * Play phone screenshots must be 16:9 or 9:16, 320–3840px per side, with the
 * longer side at most 2× the shorter. 1080×1920 (9:16, 1.78:1) satisfies this;
 * the iOS 1290×2796 set (2.17:1) does NOT and would be rejected.
 *
 * Output: screenshots/play-store/{device}/XX_screen-name.png
 *
 * Usage:
 *   node scripts/generate-play-screenshots.mjs
 *
 * Environment variables:
 *   PLAYWRIGHT_USER_A_SCREENNAME   — screenname for authenticated screens
 *   PLAYWRIGHT_USER_A_PASSWORD     — password for authenticated screens
 *   SCREENSHOT_PORT                — port for vite preview (default 4183)
 *   SCREENSHOT_ONLY                — comma-separated screen slugs to capture
 *   PLAY_DEVICES                   — comma-separated device ids (default all)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';
import {
  buddyListMockup,
  dmConversationMockup,
  roomsBrowseMockup,
} from './take-app-store-screenshots.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_ROOT = path.join(ROOT, 'screenshots', 'play-store');
const PORT = process.env.SCREENSHOT_PORT ?? '4183';
const BASE_URL = `http://localhost:${PORT}`;
const ONLY = process.env.SCREENSHOT_ONLY ? process.env.SCREENSHOT_ONLY.split(',').map((s) => s.trim()) : null;
const AUTH_SCREENNAME = process.env.PLAYWRIGHT_USER_A_SCREENNAME ?? '';
const AUTH_PASSWORD = process.env.PLAYWRIGHT_USER_A_PASSWORD ?? '';
const HAS_CREDENTIALS = Boolean(AUTH_SCREENNAME && AUTH_PASSWORD);

// ─── Android device profiles (all satisfy Play's ≤2:1 aspect ratio) ───────────
const ALL_DEVICES = [
  { id: 'phone', label: 'Phone', width: 1080, height: 1920 },
  { id: 'tablet-7', label: '7" tablet', width: 1200, height: 1920 },
  { id: 'tablet-10', label: '10" tablet', width: 1600, height: 2560 },
];
const DEVICE_FILTER = process.env.PLAY_DEVICES
  ? process.env.PLAY_DEVICES.split(',').map((s) => s.trim())
  : null;
const DEVICES = DEVICE_FILTER ? ALL_DEVICES.filter((d) => DEVICE_FILTER.includes(d.id)) : ALL_DEVICES;

// ─── Server management ────────────────────────────────────────────────────────
async function waitForServer(url, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const { default: http } = await import('node:http');
      await new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
          res.resume();
          resolve();
        });
        req.on('error', reject);
        req.setTimeout(1000, () => {
          req.destroy();
          reject(new Error('timeout'));
        });
      });
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  return false;
}

async function startPreviewServer() {
  console.log(`  Starting vite preview on port ${PORT}…`);
  const server = spawn('npx', ['vite', 'preview', '--port', PORT, '--host', 'localhost'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', (d) => process.stdout.write(`  [vite] ${d}`));
  server.stderr.on('data', (d) => process.stderr.write(`  [vite] ${d}`));
  const ready = await waitForServer(BASE_URL);
  if (!ready) {
    server.kill();
    throw new Error(`Vite preview did not start on ${BASE_URL} within 15 s`);
  }
  console.log(`  Server ready at ${BASE_URL}`);
  return server;
}

// ─── Screenshot capture ───────────────────────────────────────────────────────
async function captureScreens(page, device, outDir) {
  const { width: w, height: h } = device;
  const results = [];

  async function shotHtml(slug, html) {
    if (ONLY && !ONLY.includes(slug)) return;
    const filePath = path.join(outDir, `${slug}.png`);
    console.log(`    → ${slug} (mockup)`);
    await page.setContent(html, { waitUntil: 'load' });
    await page.waitForTimeout(400);
    await page.screenshot({ path: filePath, type: 'png' });
    const stat = await fs.stat(filePath);
    results.push({ slug, filePath, size: stat.size, isMockup: true });
  }

  async function shotLive(slug, prepare) {
    if (ONLY && !ONLY.includes(slug)) return;
    const filePath = path.join(outDir, `${slug}.png`);
    console.log(`    → ${slug} (live)`);
    await prepare();
    await page.waitForTimeout(800);
    await page.screenshot({ path: filePath, type: 'png' });
    const stat = await fs.stat(filePath);
    results.push({ slug, filePath, size: stat.size });
  }

  // 01 Sign-in
  await shotLive('01_sign-in', async () => {
    await page.goto(BASE_URL + '/', { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(500);
  });

  // 02 Sign-up
  await shotLive('02_sign-up', async () => {
    await page.goto(BASE_URL + '/', { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(600);
    await page.locator('button', { hasText: 'Create account' }).first().click();
    await page.waitForTimeout(400);
  });

  // 03 Forgot password
  await shotLive('03_forgot-password', async () => {
    await page.goto(BASE_URL + '/', { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(600);
    await page.locator('button', { hasText: 'Forgot password?' }).first().click();
    await page.waitForTimeout(400);
  });

  // 04 Buddy list, 05 DM, 06 Rooms — live when credentialed, else mockups
  if (HAS_CREDENTIALS) {
    await shotLive('04_buddy-list', async () => {
      await page.goto(BASE_URL + '/', { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(500);
      await page.locator('input.ui-screenname').fill(AUTH_SCREENNAME);
      await page.locator('input[autocomplete="current-password"]').fill(AUTH_PASSWORD);
      await page.locator('button[type="submit"]').click();
      await page.waitForURL('**/hi-its-me**', { timeout: 20000 });
      await page.waitForTimeout(2500);
    });
    await shotLive('05_direct-message', async () => {
      const firstDm = page.locator('[data-testid^="dm-row-"]').first();
      if (await firstDm.isVisible({ timeout: 3000 }).catch(() => false)) {
        await firstDm.click();
        await page.waitForTimeout(2000);
      }
    });
    await shotLive('06_chat-rooms', async () => {
      const chatTab = page.locator('.ui-tabbar-button', { hasText: /chat/i }).first();
      if (await chatTab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await chatTab.click();
        await page.waitForTimeout(1500);
      } else {
        await page.goto(BASE_URL + '/hi-its-me?tab=chat', { waitUntil: 'networkidle', timeout: 20000 });
        await page.waitForTimeout(2000);
      }
    });
  } else {
    await shotHtml('04_buddy-list', buddyListMockup(w, h));
    await shotHtml('05_direct-message', dmConversationMockup(w, h));
    await shotHtml('06_chat-rooms', roomsBrowseMockup(w, h));
  }

  return results;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║  H.I.M. — Google Play Screenshot Generator           ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  for (const device of DEVICES) {
    await fs.mkdir(path.join(OUT_ROOT, device.id), { recursive: true });
  }

  let server;
  const serverAlreadyRunning = await waitForServer(BASE_URL, 1000);
  if (!serverAlreadyRunning) {
    server = await startPreviewServer();
  } else {
    console.log(`  Detected existing server at ${BASE_URL}`);
  }

  const browser = await chromium.launch({ headless: true });
  const allResults = {};

  try {
    for (const device of DEVICES) {
      console.log(`\n  Device: ${device.label} (${device.width}×${device.height})`);
      const context = await browser.newContext({
        viewport: { width: device.width, height: device.height },
        deviceScaleFactor: 1,
      });
      const page = await context.newPage();
      const outDir = path.join(OUT_ROOT, device.id);
      allResults[device.id] = await captureScreens(page, device, outDir);
      await context.close();
    }
  } finally {
    await browser.close();
    if (server) {
      server.kill();
      console.log('\n  Preview server stopped.');
    }
  }

  console.log('\n  Summary');
  let totalFiles = 0;
  for (const device of DEVICES) {
    const results = allResults[device.id] ?? [];
    if (!results.length) continue;
    console.log(`  ${device.label}`);
    for (const r of results) {
      const kb = Math.round(r.size / 1024);
      const tag = r.isMockup ? '[mockup]' : '[live]  ';
      console.log(`    ${tag} ${r.slug}.png  (${kb} KB)`);
      totalFiles++;
    }
  }
  console.log(`\n  Total: ${totalFiles} screenshots`);
  console.log(`  Output: ${OUT_ROOT}\n`);
  if (!HAS_CREDENTIALS) {
    console.log('  Authenticated screens used mockups (no credentials).');
    console.log('  For live screens set PLAYWRIGHT_USER_A_SCREENNAME + PLAYWRIGHT_USER_A_PASSWORD.\n');
  }
}

await main();
