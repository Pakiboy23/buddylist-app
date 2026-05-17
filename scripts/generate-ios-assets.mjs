import { mkdir } from 'node:fs/promises';
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
  'AppIcon-512@2x.png',
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

function iconMarkup() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      :root {
        --bg-dark: #13100E;
        --bg-card: #1D1916;
        --chiraag: #E8A23A;
        --text-light: #F7F0E8;
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
          <!-- Lamp flame/teardrop body -->
          <ellipse cx="50" cy="46" rx="30" ry="38" fill="#E8A23A"/>
          <!-- Lamp base neck -->
          <rect x="42" y="82" width="16" height="10" rx="3" fill="#E8A23A"/>
          <!-- Lamp base foot -->
          <rect x="34" y="90" width="32" height="8" rx="4" fill="#C8821A"/>
          <!-- Inner highlight on flame -->
          <ellipse cx="44" cy="36" rx="10" ry="14" fill="rgba(255,240,200,0.35)"/>
        </svg>
      </div>
    </div>
  </body>
</html>`;
}

function splashMarkup() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      :root {
        --bg-dark: #13100E;
        --bg-card: #1D1916;
        --chiraag: #E8A23A;
        --text-light: #F7F0E8;
        --muted: #9C8E82;
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
          radial-gradient(circle at 28% 22%, rgba(232, 162, 58, 0.18) 0%, transparent 48%),
          radial-gradient(circle at center, var(--bg-card) 0%, var(--bg-dark) 100%);
        font-family: -apple-system, 'Helvetica Neue', sans-serif;
      }

      .shell {
        position: relative;
        display: grid;
        justify-items: center;
        gap: 112px;
      }

      .badge {
        position: relative;
        width: 620px;
        height: 620px;
        border-radius: 196px;
        background:
          linear-gradient(170deg, rgba(255, 255, 255, 0.07) 0%, rgba(255, 255, 255, 0.02) 30%, transparent 100%),
          var(--bg-card);
        border: 1px solid rgba(255, 255, 255, 0.12);
        box-shadow:
          0 70px 180px rgba(0, 0, 0, 0.5),
          0 0 120px rgba(232, 162, 58, 0.14),
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
        width: 270px;
        aspect-ratio: 1;
        border-radius: 50%;
        background: var(--chiraag);
        filter: blur(28px);
        opacity: 0.5;
      }

      .glyph-svg {
        position: relative;
        width: 270px;
        aspect-ratio: 1;
      }

      .wordmark {
        color: var(--text-light);
        font-size: 224px;
        font-weight: 700;
        letter-spacing: -0.06em;
        line-height: 0.92;
      }

      .subhead {
        margin-top: -84px;
        color: var(--muted);
        font-size: 66px;
        font-weight: 600;
        letter-spacing: 0.18em;
        text-transform: uppercase;
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <div class="badge">
        <div class="logo-wrap">
          <div class="glyph-glow"></div>
          <svg class="glyph-svg" viewBox="0 0 100 115" fill="none" xmlns="http://www.w3.org/2000/svg">
            <!-- Lamp flame/teardrop body -->
            <ellipse cx="50" cy="46" rx="30" ry="38" fill="#E8A23A"/>
            <!-- Lamp base neck -->
            <rect x="42" y="82" width="16" height="10" rx="3" fill="#E8A23A"/>
            <!-- Lamp base foot -->
            <rect x="34" y="90" width="32" height="8" rx="4" fill="#C8821A"/>
            <!-- Inner highlight on flame -->
            <ellipse cx="44" cy="36" rx="10" ry="14" fill="rgba(255,240,200,0.35)"/>
          </svg>
        </div>
      </div>
      <div class="wordmark">H.I.M.</div>
      <div class="subhead">Sign on.</div>
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

  const browser = await launchBrowser();

  try {
    await render(browser, iconMarkup(), 1024, 1024, iconPath);

    for (const splashFile of splashFiles) {
      await render(browser, splashMarkup(), 2732, 2732, path.join(splashDir, splashFile));
    }
  } finally {
    await browser.close();
  }

  console.log('Generated H.I.M. iOS icon and splash assets.');
}

await main();
