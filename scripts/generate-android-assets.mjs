import { readFile } from 'node:fs/promises';
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

const brandIconSourcePath = path.join(
  repoRoot,
  'assets',
  'brand',
  'him-app-icon-hi-1024.png',
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

async function imageDataUri(filePath) {
  const bytes = await readFile(filePath);
  return `data:image/png;base64,${bytes.toString('base64')}`;
}

function flatIconMarkup(iconDataUri) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      :root {
        --neel: #1A1F3A;
      }

      * { box-sizing: border-box; }

      html, body {
        width: 100%;
        height: 100%;
        margin: 0;
        overflow: hidden;
      }

      body {
        background: var(--neel);
      }

      img {
        display: block;
        width: 100%;
        height: 100%;
      }
    </style>
  </head>
  <body>
    <img src="${iconDataUri}" alt="" />
  </body>
</html>`;
}

// Transparent foreground for Android adaptive icons. The source tile is scaled down
// so the `hi.` letterform and amber period remain inside the adaptive safe zone.
function foregroundMarkup(iconDataUri) {
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

      .app-icon {
        width: 82%;
        aspect-ratio: 1;
        filter: drop-shadow(0 8px 18px rgba(0, 0, 0, 0.32));
      }
    </style>
  </head>
  <body>
    <img class="app-icon" src="${iconDataUri}" alt="" />
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
  const iconDataUri = await imageDataUri(brandIconSourcePath);
  const browser = await launchBrowser();
  const flat = flatIconMarkup(iconDataUri);
  const fg = foregroundMarkup(iconDataUri);

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

  console.log('\nGenerated H.I.M. hi. Android mipmap assets.');
  console.log('Background color updated separately in ic_launcher_background.xml.');
}

await main();
