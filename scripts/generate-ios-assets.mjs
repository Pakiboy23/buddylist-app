import { execFileSync } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const iconPath = path.join(
  repoRoot,
  'ios',
  'App',
  'App',
  'Assets.xcassets',
  'AppIcon.appiconset',
  'icon-1024.png',
);

const brandIconSourcePath = path.join(
  repoRoot,
  'assets',
  'brand',
  'him-app-icon-hi-1024.png',
);

const splashDir = path.join(
  repoRoot,
  'ios',
  'App',
  'App',
  'Assets.xcassets',
  'Splash.imageset',
);

const splashFiles = [
  'splash-2732x2732.png',
  'splash-2732x2732-1.png',
  'splash-2732x2732-2.png',
];

async function imageDataUri(filePath) {
  const bytes = await readFile(filePath);
  return `data:image/png;base64,${bytes.toString('base64')}`;
}

function iconMarkup(iconDataUri) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      :root {
        --neel: #1A1F3A;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
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

function splashMarkup(iconDataUri) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      :root {
        --neel: #1A1F3A;
        --chiraag: #E8A23A;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        width: 100%;
        height: 100%;
        margin: 0;
        overflow: hidden;
      }

      body {
        display: grid;
        place-items: center;
        background:
          radial-gradient(circle at 58% 58%, rgba(232, 162, 58, 0.16), transparent 34%),
          var(--neel);
      }

      .app-icon {
        width: 620px;
        height: 620px;
        filter:
          drop-shadow(0 70px 150px rgba(0, 0, 0, 0.42))
          drop-shadow(0 0 100px rgba(232, 162, 58, 0.10));
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
        `Unable to launch a browser for iOS asset generation. Install Playwright browsers or use a machine with Google Chrome available.\n${details}`,
      );
    }
  }
}

async function render(browser, html, width, height, outputPath) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  await page.screenshot({ path: outputPath });
  await context.close();
}

async function main() {
  await mkdir(path.dirname(iconPath), { recursive: true });
  await mkdir(splashDir, { recursive: true });

  const iconDataUri = await imageDataUri(brandIconSourcePath);
  const browser = await launchBrowser();

  try {
    await render(browser, iconMarkup(iconDataUri), 1024, 1024, iconPath);

    for (const splashFile of splashFiles) {
      await render(browser, splashMarkup(iconDataUri), 2732, 2732, path.join(splashDir, splashFile));
    }
  } finally {
    await browser.close();
  }

  // Resize 1024px master to all required icon sizes using macOS sips
  const iconDir = path.dirname(iconPath);
  const iconSizes = [20, 29, 40, 58, 60, 76, 80, 87, 120, 152, 167, 180];
  for (const size of iconSizes) {
    const dest = path.join(iconDir, `icon-${size}.png`);
    execFileSync('sips', ['-z', String(size), String(size), iconPath, '--out', dest], { stdio: 'ignore' });
  }

  console.log('Generated H.I.M. hi. iOS icon and splash assets.');
}

await main();
