/**
 * generate-play-feature-graphic.mjs
 *
 * Renders the Google Play feature graphic (required, exactly 1024×500 px) using
 * the H.I.M. "Midnight" brand palette. Reuses the app icon art when present.
 *
 * Output: screenshots/play-store/feature-graphic.png
 * Usage:  node scripts/generate-play-feature-graphic.mjs
 */

import { readFile, mkdir, stat } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'screenshots', 'play-store');
const OUT_PATH = path.join(OUT_DIR, 'feature-graphic.png');
const ICON_PATH = path.join(ROOT, 'assets', 'brand', 'him-app-icon-hi-1024.png');

const WIDTH = 1024;
const HEIGHT = 500;

// Midnight brand tokens (matches src/app/globals.css + native chrome)
const MIDNIGHT = '#1A1F3A';
const MIDNIGHT_DEEP = '#13100E';
const AMBER = '#E8A23A';
const STONE = '#F5F1E8';

async function fileExists(p) {
  try {
    await access(p, fsConstants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function iconDataUri() {
  if (!(await fileExists(ICON_PATH))) return null;
  const bytes = await readFile(ICON_PATH);
  return `data:image/png;base64,${bytes.toString('base64')}`;
}

function markup(icon) {
  const iconBlock = icon
    ? `<img src="${icon}" alt="" style="
         width: 232px; height: 232px; border-radius: 52px;
         box-shadow: 0 18px 48px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.12);
       " />`
    : `<div style="
         width: 232px; height: 232px; border-radius: 52px;
         background: radial-gradient(circle at 30% 25%, ${AMBER}, ${MIDNIGHT_DEEP} 78%);
         display:flex; align-items:center; justify-content:center;
         font-size: 132px; font-weight: 800; color: ${STONE};
         box-shadow: 0 18px 48px rgba(0,0,0,0.45);
       ">hi<span style="color:${AMBER}">.</span></div>`;

  return `<!doctype html><html><head><meta charset="utf-8"/><style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden;
      font-family: "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    .stage {
      width: ${WIDTH}px; height: ${HEIGHT}px; position: relative;
      background:
        radial-gradient(circle at 82% 18%, rgba(232,162,58,0.22) 0%, rgba(232,162,58,0) 42%),
        radial-gradient(circle at 12% 92%, rgba(232,162,58,0.12) 0%, rgba(232,162,58,0) 40%),
        linear-gradient(135deg, ${MIDNIGHT} 0%, ${MIDNIGHT_DEEP} 100%);
      display: flex; align-items: center; gap: 64px;
      padding: 0 80px;
    }
    .copy { display: flex; flex-direction: column; gap: 14px; }
    .wordmark { font-size: 108px; font-weight: 800; letter-spacing: -0.05em; color: ${STONE}; line-height: 0.9; }
    .wordmark .dot { color: ${AMBER}; }
    .subhead { font-size: 38px; font-weight: 600; color: ${STONE}; opacity: 0.92; letter-spacing: -0.02em; }
    .tagline {
      margin-top: 6px; font-size: 26px; font-weight: 500; color: ${AMBER};
      letter-spacing: 0.01em;
    }
    .rule { width: 92px; height: 4px; border-radius: 2px; background: ${AMBER}; margin: 10px 0 4px; }
  </style></head><body>
    <div class="stage">
      ${iconBlock}
      <div class="copy">
        <div class="wordmark">H<span class="dot">.</span>I<span class="dot">.</span>M<span class="dot">.</span></div>
        <div class="rule"></div>
        <div class="subhead">Hi, It's Me.</div>
        <div class="tagline">A friendship-first social app — screennames, status &amp; rooms.</div>
      </div>
    </div>
  </body></html>`;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const icon = await iconDataUri();
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: WIDTH, height: HEIGHT },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    await page.setContent(markup(icon), { waitUntil: 'load' });
    await page.waitForTimeout(300);
    await page.screenshot({ path: OUT_PATH, type: 'png' });
    await context.close();
  } finally {
    await browser.close();
  }
  const { size } = await stat(OUT_PATH);
  console.log(`Feature graphic written: ${OUT_PATH} (${WIDTH}×${HEIGHT}, ${Math.round(size / 1024)} KB)`);
  console.log(icon ? '  Used brand app icon art.' : '  Brand icon not found — used generated fallback mark.');
}

await main();
