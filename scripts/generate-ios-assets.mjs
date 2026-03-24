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
        --navy: #091228;
        --deep-blue: #10357e;
        --electric: #2563eb;
        --sky: #93c5fd;
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
          radial-gradient(circle at 24% 18%, rgba(255, 255, 255, 0.14) 0 18%, transparent 40%),
          radial-gradient(circle at 76% 20%, rgba(147, 197, 253, 0.24) 0 16%, transparent 34%),
          linear-gradient(155deg, var(--navy) 6%, #0f2351 32%, var(--deep-blue) 58%, var(--electric) 100%);
      }

      .orb {
        position: absolute;
        width: 72%;
        aspect-ratio: 1;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(147, 197, 253, 0.3) 0%, rgba(37, 99, 235, 0.14) 42%, transparent 74%);
        filter: blur(18px);
        transform: translateY(5%);
      }

      .panel {
        position: relative;
        width: 72%;
        aspect-ratio: 1;
        border-radius: 30%;
        overflow: hidden;
        background:
          linear-gradient(170deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.04) 30%, rgba(10, 18, 40, 0.08) 100%),
          linear-gradient(160deg, rgba(7, 15, 36, 0.94), rgba(15, 35, 81, 0.95) 42%, rgba(37, 99, 235, 0.94) 100%);
        border: 1px solid rgba(255, 255, 255, 0.18);
        box-shadow:
          0 52px 120px rgba(7, 15, 36, 0.34),
          inset 0 1px 0 rgba(255, 255, 255, 0.26),
          inset 0 -26px 48px rgba(7, 15, 36, 0.2);
      }

      .panel::before {
        content: '';
        position: absolute;
        inset: 0;
        background:
          linear-gradient(145deg, rgba(255, 255, 255, 0.18) 0 14%, transparent 22% 100%),
          radial-gradient(circle at 80% 84%, rgba(147, 197, 253, 0.22), transparent 34%);
      }

      .logo-wrap {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
      }

      .logo-glow,
      .logo-mark,
      .logo-shadow {
        position: absolute;
        width: 42%;
        aspect-ratio: 1;
        clip-path: polygon(50% 4%, 7% 88%, 93% 88%);
      }

      .logo-glow {
        background: rgba(191, 219, 254, 0.45);
        filter: blur(30px);
        transform: translateY(3%);
      }

      .logo-shadow {
        background: rgba(37, 99, 235, 0.5);
        transform: translateY(7%) scale(1.02);
        filter: blur(8px);
      }

      .logo-mark {
        background: linear-gradient(180deg, #ffffff 0%, #eef5ff 100%);
        filter: drop-shadow(0 16px 36px rgba(7, 15, 36, 0.26));
      }
    </style>
  </head>
  <body>
    <div class="orb"></div>
    <div class="panel">
      <div class="logo-wrap">
        <div class="logo-glow"></div>
        <div class="logo-shadow"></div>
        <div class="logo-mark"></div>
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
        --navy: #0b1632;
        --ink: #20325c;
        --muted: #7f93b5;
        --accent: #1d4ed8;
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
          radial-gradient(circle at 12% 14%, rgba(197, 221, 255, 0.92) 0 0.8%, rgba(197, 221, 255, 0.55) 0 10%, transparent 28%),
          radial-gradient(circle at 86% 88%, rgba(191, 219, 254, 0.45) 0 0.4%, rgba(191, 219, 254, 0.18) 0 14%, transparent 30%),
          radial-gradient(circle at 10% 15%, #c5ddff 0%, #eaf2ff 34%, #f6f9ff 62%, #dce9ff 100%);
        font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif;
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
          linear-gradient(160deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.05) 26%, rgba(9, 18, 40, 0.08) 100%),
          linear-gradient(158deg, #0a132b 4%, #14326e 42%, var(--accent) 100%);
        border: 1px solid rgba(255, 255, 255, 0.32);
        box-shadow:
          0 70px 180px rgba(29, 78, 216, 0.18),
          inset 0 1px 0 rgba(255, 255, 255, 0.34);
      }

      .badge::before {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: inherit;
        background:
          linear-gradient(146deg, rgba(255, 255, 255, 0.18) 0 12%, transparent 24% 100%),
          radial-gradient(circle at 78% 82%, rgba(191, 219, 254, 0.18), transparent 32%);
      }

      .logo-wrap {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
      }

      .logo-glow,
      .logo-mark,
      .logo-shadow {
        position: absolute;
        width: 270px;
        aspect-ratio: 1;
        clip-path: polygon(50% 4%, 7% 88%, 93% 88%);
      }

      .logo-glow {
        background: rgba(191, 219, 254, 0.42);
        filter: blur(26px);
        transform: translateY(12px);
      }

      .logo-shadow {
        background: rgba(37, 99, 235, 0.42);
        filter: blur(10px);
        transform: translateY(24px);
      }

      .logo-mark {
        background: linear-gradient(180deg, #ffffff 0%, #edf5ff 100%);
        filter: drop-shadow(0 18px 44px rgba(7, 15, 36, 0.18));
      }

      .wordmark {
        color: var(--navy);
        font-size: 224px;
        font-weight: 700;
        letter-spacing: -0.08em;
        line-height: 0.92;
      }

      .subhead {
        margin-top: -84px;
        color: var(--muted);
        font-size: 66px;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <div class="badge">
        <div class="logo-wrap">
          <div class="logo-glow"></div>
          <div class="logo-shadow"></div>
          <div class="logo-mark"></div>
        </div>
      </div>
      <div class="wordmark">BuddyList</div>
      <div class="subhead">Sign on</div>
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

  console.log('Generated BuddyList iOS icon and splash assets.');
}

await main();
