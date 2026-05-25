import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const mipmapRoot = path.join(
  repoRoot,
  'android',
  'app',
  'src',
  'main',
  'res',
);

// Flat legacy icon sizes (dp = px at mdpi baseline)
const FLAT_SIZES = [
  { density: 'mipmap-mdpi',    size: 48  },
  { density: 'mipmap-hdpi',    size: 72  },
  { density: 'mipmap-xhdpi',   size: 96  },
  { density: 'mipmap-xxhdpi',  size: 144 },
  { density: 'mipmap-xxxhdpi', size: 192 },
];

// Adaptive foreground canvas: 108dp at each density (art safe zone = inner 72dp / 66.7%)
const FOREGROUND_SIZES = [
  { density: 'mipmap-mdpi',    size: 108 },
  { density: 'mipmap-hdpi',    size: 162 },
  { density: 'mipmap-xhdpi',   size: 216 },
  { density: 'mipmap-xxhdpi',  size: 324 },
  { density: 'mipmap-xxxhdpi', size: 432 },
];

function flatIconMarkup() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      :root {
        --bg-dark: #13100E;
        --bg-card: #1D1916;
        --chiraag: #E8A23A;
      }

      * { box-sizing: border-box; }

      html, body {
        width: 100%;
        height: 100%;
        margin: 0;
        overflow: hidden;
      }

      body {
        display: grid;
        place-items: center;
        background:
          radial-gradient(circle at 28% 22%, rgba(232, 162, 58, 0.18) 0%, transparent 48%),
          radial-gradient(circle at center, var(--bg-card) 0%, var(--bg-dark) 100%);
      }

      .panel {
        position: relative;
        width: 72%;
        aspect-ratio: 1;
        border-radius: 30%;
        overflow: hidden;
        background:
          linear-gradient(170deg, rgba(255, 255, 255, 0.07) 0%, rgba(255, 255, 255, 0.02) 30%, transparent 100%),
          var(--bg-card);
        border: 1px solid rgba(255, 255, 255, 0.12);
        box-shadow:
          0 52px 120px rgba(0, 0, 0, 0.5),
          0 0 80px rgba(232, 162, 58, 0.12),
          inset 0 1px 0 rgba(255, 255, 255, 0.14);
      }

      .logo-wrap {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
      }

      .glyph-glow {
        position: absolute;
        width: 42%;
        aspect-ratio: 1;
        border-radius: 50%;
        background: var(--chiraag);
        filter: blur(28px);
        opacity: 0.5;
      }

      .glyph-svg {
        position: relative;
        width: 42%;
        aspect-ratio: 1;
      }
    </style>
  </head>
  <body>
    <div class="panel">
      <div class="logo-wrap">
        <div class="glyph-glow"></div>
        <svg class="glyph-svg" viewBox="0 0 100 115" fill="none" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="50" cy="46" rx="30" ry="38" fill="#E8A23A"/>
          <rect x="42" y="82" width="16" height="10" rx="3" fill="#E8A23A"/>
          <rect x="34" y="90" width="32" height="8" rx="4" fill="#C8821A"/>
          <ellipse cx="44" cy="36" rx="10" ry="14" fill="rgba(255,240,200,0.35)"/>
        </svg>
      </div>
    </div>
  </body>
</html>`;
}

// Transparent background; glyph centered within the 66.7% safe zone (17% padding each side).
function foregroundMarkup() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      * { box-sizing: border-box; }

      html, body {
        width: 100%;
        height: 100%;
        margin: 0;
        overflow: hidden;
        background: transparent;
      }

      body {
        display: grid;
        place-items: center;
      }

      /* Safe zone padding: 16.7% each side keeps art within the 72dp safe area */
      .safe-zone {
        width: 66.7%;
        aspect-ratio: 1;
        display: grid;
        place-items: center;
        position: relative;
      }

      .glyph-glow {
        position: absolute;
        width: 60%;
        aspect-ratio: 1;
        border-radius: 50%;
        background: #E8A23A;
        filter: blur(20px);
        opacity: 0.45;
      }

      .glyph-svg {
        position: relative;
        width: 60%;
        aspect-ratio: 1;
      }
    </style>
  </head>
  <body>
    <div class="safe-zone">
      <div class="glyph-glow"></div>
      <svg class="glyph-svg" viewBox="0 0 100 115" fill="none" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="50" cy="46" rx="30" ry="38" fill="#E8A23A"/>
        <rect x="42" y="82" width="16" height="10" rx="3" fill="#E8A23A"/>
        <rect x="34" y="90" width="32" height="8" rx="4" fill="#C8821A"/>
        <ellipse cx="44" cy="36" rx="10" ry="14" fill="rgba(255,240,200,0.35)"/>
      </svg>
    </div>
  </body>
</html>`;
}

async function launchBrowser() {
  try {
    return await chromium.launch({ headless: true });
  } catch (primaryError) {
    try {
      return await chromium.launch({ headless: true, channel: 'chrome' });
    } catch {
      const details =
        primaryError instanceof Error ? primaryError.message : 'Unknown Playwright launch error';
      throw new Error(
        `Unable to launch a browser for Android asset generation. Install Playwright browsers or use a machine with Google Chrome available.\n${details}`,
      );
    }
  }
}

async function render(browser, html, size, outputPath, transparent = false) {
  const context = await browser.newContext({
    viewport: { width: size, height: size },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  await page.screenshot({ path: outputPath, omitBackground: transparent });
  await context.close();
}

async function main() {
  const browser = await launchBrowser();
  const flat = flatIconMarkup();
  const fg = foregroundMarkup();

  try {
    for (const { density, size } of FLAT_SIZES) {
      const dir = path.join(mipmapRoot, density);
      await render(browser, flat, size, path.join(dir, 'ic_launcher.png'));
      await render(browser, flat, size, path.join(dir, 'ic_launcher_round.png'));
      console.log(`  ${density}: ic_launcher + ic_launcher_round (${size}×${size})`);
    }

    for (const { density, size } of FOREGROUND_SIZES) {
      const dir = path.join(mipmapRoot, density);
      await render(browser, fg, size, path.join(dir, 'ic_launcher_foreground.png'), true);
      console.log(`  ${density}: ic_launcher_foreground (${size}×${size}, transparent)`);
    }
  } finally {
    await browser.close();
  }

  console.log('\nGenerated H.I.M. Android mipmap assets.');
  console.log('Background color updated separately in ic_launcher_background.xml.');
}

await main();
