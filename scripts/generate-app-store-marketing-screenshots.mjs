import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const WIDTH = Number(process.env.ASC_WIDTH ?? '1290');
const HEIGHT = Number(process.env.ASC_HEIGHT ?? '2796');

const rawDir =
  process.env.ASC_RAW_DIR ??
  path.join(process.cwd(), 'artifacts', 'app-store-connect', 'iphone-6.9-2026-03-29');
const outputDir =
  process.env.ASC_OUTPUT_DIR ??
  path.join(process.cwd(), 'artifacts', 'app-store-connect', 'iphone-6.9-2026-03-29', 'marketing-captioned');

const slides = [
  {
    output: '01_create-account-marketing.png',
    source: '01_create-account.png',
    eyebrow: 'Account Protection',
    title: 'Set Up Recovery Once.',
    highlight: 'Stay in control.',
    body: 'Create a private recovery code at sign-up and keep password resets in your hands.',
    accentStart: '#60a5fa',
    accentEnd: '#22d3ee',
    panelGlow: 'rgba(96, 165, 250, 0.28)',
    align: 'center top',
    badgeA: 'No Admin Detours',
    badgeB: 'Secure by Default',
    imageScale: 1.03,
    imageOffsetY: 18,
  },
  {
    output: '02_buddy-list-home-marketing.png',
    source: '02_buddy-list-home.png',
    eyebrow: 'Premium Home',
    title: 'Your Buddy List,',
    highlight: 'rebuilt for calm.',
    body: 'See people, notes, presence, and unread activity in one polished home.',
    accentStart: '#38bdf8',
    accentEnd: '#818cf8',
    panelGlow: 'rgba(56, 189, 248, 0.24)',
    align: 'center top',
    badgeA: 'Presence at a Glance',
    badgeB: 'Saved Notes Built In',
    imageScale: 1.04,
    imageOffsetY: 10,
  },
  {
    output: '03_direct-message-marketing.png',
    source: '03_direct-message.png',
    eyebrow: 'Private Messaging',
    title: 'Private chats that',
    highlight: 'feel instant.',
    body: 'Themes, presence, and quick actions make every conversation feel considered.',
    accentStart: '#fb7185',
    accentEnd: '#f59e0b',
    panelGlow: 'rgba(251, 113, 133, 0.24)',
    align: 'center top',
    badgeA: 'Themes That Feel Personal',
    badgeB: 'Designed for Focus',
    imageScale: 1.07,
    imageOffsetY: 6,
  },
  {
    output: '04_saved-messages-marketing.png',
    source: '04_saved-messages.png',
    eyebrow: 'Saved Messages',
    title: 'Keep the details',
    highlight: 'that matter.',
    body: 'Save standout messages and private notes without cluttering the chat flow.',
    accentStart: '#2dd4bf',
    accentEnd: '#60a5fa',
    panelGlow: 'rgba(45, 212, 191, 0.22)',
    align: 'center top',
    badgeA: 'Notes + Keepsakes',
    badgeB: 'Launch-Day Ready',
    imageScale: 1.08,
    imageOffsetY: 6,
  },
  {
    output: '05_privacy-controls-marketing.png',
    source: '05_privacy-controls.png',
    eyebrow: 'Privacy Controls',
    title: 'Thoughtful privacy,',
    highlight: 'right on the surface.',
    body: 'Hide previews, enable screen shielding, and control what BuddyList reveals.',
    accentStart: '#818cf8',
    accentEnd: '#22d3ee',
    panelGlow: 'rgba(129, 140, 248, 0.24)',
    align: 'center top',
    badgeA: 'Hide Previews',
    badgeB: 'Screen Shield Ready',
    imageScale: 1.06,
    imageOffsetY: 6,
  },
  {
    output: '06_app-lock-marketing.png',
    source: '06_app-lock.png',
    eyebrow: 'App Lock',
    title: 'A device-only PIN',
    highlight: 'for extra peace.',
    body: 'Add a hidden app lock and choose exactly how quickly BuddyList asks again.',
    accentStart: '#60a5fa',
    accentEnd: '#34d399',
    panelGlow: 'rgba(52, 211, 153, 0.18)',
    align: 'center top',
    badgeA: 'Hidden PIN Lock',
    badgeB: 'Tune Auto-Lock',
    imageScale: 1.08,
    imageOffsetY: 4,
  },
  {
    output: '07_add-buddy-marketing.png',
    source: '07_add-buddy.png',
    eyebrow: 'Discovery',
    title: 'Find new buddies',
    highlight: 'without friction.',
    body: 'Search by screen name, see who you are adding, and grow the circle fast.',
    accentStart: '#f59e0b',
    accentEnd: '#60a5fa',
    panelGlow: 'rgba(245, 158, 11, 0.2)',
    align: 'center top',
    badgeA: 'Search by Screen Name',
    badgeB: 'Add with Confidence',
    imageScale: 1.08,
    imageOffsetY: 8,
  },
];

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildHtml(slide, imageUrl) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=${WIDTH}, initial-scale=1" />
    <title>${escapeHtml(slide.title)} ${escapeHtml(slide.highlight)}</title>
    <style>
      :root {
        color-scheme: dark;
        --bg-1: #091121;
        --bg-2: #111d36;
        --text: #f8fbff;
        --muted: rgba(226, 232, 240, 0.84);
        --soft: rgba(148, 163, 184, 0.56);
        --line: rgba(255, 255, 255, 0.12);
        --panel: rgba(11, 23, 43, 0.74);
        --panel-strong: rgba(11, 23, 43, 0.92);
        --accent-a: ${slide.accentStart};
        --accent-b: ${slide.accentEnd};
        --panel-glow: ${slide.panelGlow};
        --image-scale: ${slide.imageScale ?? 1};
        --image-offset-y: ${slide.imageOffsetY ?? 0}px;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        width: ${WIDTH}px;
        height: ${HEIGHT}px;
        overflow: hidden;
        background:
          radial-gradient(circle at 12% 10%, rgba(96, 165, 250, 0.24), transparent 24%),
          radial-gradient(circle at 85% 14%, rgba(34, 211, 238, 0.16), transparent 22%),
          linear-gradient(180deg, var(--bg-2) 0%, var(--bg-1) 48%, #050b17 100%);
        color: var(--text);
        font-family:
          "SF Pro Display",
          "SF Pro Text",
          "Avenir Next",
          "Segoe UI",
          sans-serif;
      }

      body::before,
      body::after {
        content: "";
        position: absolute;
        border-radius: 999px;
        filter: blur(72px);
        opacity: 0.95;
        pointer-events: none;
      }

      body::before {
        width: 360px;
        height: 360px;
        left: -96px;
        top: 250px;
        background: color-mix(in srgb, var(--accent-a) 50%, transparent);
      }

      body::after {
        width: 420px;
        height: 420px;
        right: -110px;
        bottom: 420px;
        background: color-mix(in srgb, var(--accent-b) 42%, transparent);
      }

      .frame {
        position: relative;
        width: 100%;
        height: 100%;
        overflow: hidden;
      }

      .grid {
        position: absolute;
        inset: 0;
        background-image:
          linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px);
        background-size: 64px 64px;
        mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.66), transparent 82%);
      }

      .hero {
        position: absolute;
        inset: 0 0 auto 0;
        padding: 132px 104px 0;
        z-index: 3;
      }

      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 12px;
        margin: 0;
        padding: 16px 26px;
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 999px;
        background: rgba(8, 15, 29, 0.48);
        box-shadow: 0 24px 70px rgba(3, 7, 18, 0.28);
        color: rgba(240, 249, 255, 0.82);
        font-size: 28px;
        font-weight: 650;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }

      .eyebrow::before {
        content: "";
        width: 14px;
        height: 14px;
        border-radius: 999px;
        background: linear-gradient(135deg, var(--accent-a), var(--accent-b));
        box-shadow: 0 0 24px color-mix(in srgb, var(--accent-a) 40%, transparent);
      }

      h1 {
        margin: 34px 0 0;
        max-width: 980px;
        font-size: 116px;
        line-height: 0.96;
        letter-spacing: -0.055em;
        font-weight: 760;
      }

      .highlight {
        display: block;
        margin-top: 12px;
        color: transparent;
        background: linear-gradient(135deg, var(--accent-a), var(--accent-b));
        -webkit-background-clip: text;
        background-clip: text;
      }

      .body {
        margin: 34px 0 0;
        max-width: 860px;
        color: var(--muted);
        font-size: 39px;
        line-height: 1.32;
        letter-spacing: -0.025em;
        font-weight: 500;
      }

      .badge-row {
        display: flex;
        gap: 18px;
        margin-top: 34px;
      }

      .badge {
        display: inline-flex;
        align-items: center;
        min-height: 60px;
        padding: 0 24px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 999px;
        background: rgba(8, 15, 29, 0.42);
        color: rgba(240, 249, 255, 0.76);
        font-size: 28px;
        font-weight: 600;
        letter-spacing: -0.02em;
      }

      .device-wrap {
        position: absolute;
        left: 62px;
        right: 62px;
        bottom: 68px;
        top: 902px;
        z-index: 2;
      }

      .device-shadow {
        position: absolute;
        inset: 48px 32px -12px;
        border-radius: 88px;
        background:
          radial-gradient(circle at 50% 12%, rgba(255, 255, 255, 0.08), transparent 26%),
          linear-gradient(180deg, rgba(17, 24, 39, 0.2), rgba(2, 6, 23, 0.78));
        box-shadow:
          0 90px 120px rgba(2, 6, 23, 0.52),
          0 0 0 1px rgba(255, 255, 255, 0.05);
        filter: blur(10px);
      }

      .device {
        position: absolute;
        inset: 0;
        padding: 26px;
        border-radius: 92px;
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.05)),
          linear-gradient(180deg, rgba(5, 11, 23, 0.96), rgba(5, 11, 23, 0.92));
        box-shadow:
          0 36px 120px var(--panel-glow),
          0 50px 110px rgba(2, 6, 23, 0.42),
          inset 0 1px 0 rgba(255, 255, 255, 0.18);
      }

      .device::before {
        content: "";
        position: absolute;
        left: 50%;
        top: 16px;
        transform: translateX(-50%);
        width: 240px;
        height: 18px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.08);
      }

      .screen {
        position: relative;
        width: 100%;
        height: 100%;
        overflow: hidden;
        border-radius: 68px;
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.02)),
          var(--panel-strong);
        box-shadow:
          inset 0 0 0 1px rgba(255, 255, 255, 0.08),
          inset 0 40px 60px rgba(255, 255, 255, 0.02);
      }

      .screen::before {
        content: "";
        position: absolute;
        inset: 0;
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.08), transparent 18%),
          linear-gradient(135deg, rgba(255, 255, 255, 0.02), transparent 50%);
        pointer-events: none;
        z-index: 1;
      }

      .screen img {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: contain;
        object-position: ${slide.align};
        background: radial-gradient(circle at 50% 0%, rgba(255, 255, 255, 0.03), transparent 38%);
        transform: translateY(var(--image-offset-y)) scale(var(--image-scale));
        transform-origin: center top;
      }

      .screen-glow {
        position: absolute;
        inset: auto 10% -24px;
        height: 140px;
        border-radius: 999px;
        background: radial-gradient(circle, color-mix(in srgb, var(--accent-a) 28%, transparent), transparent 70%);
        filter: blur(24px);
        opacity: 0.9;
        pointer-events: none;
      }

      .brand {
        position: absolute;
        right: 108px;
        top: 130px;
        display: flex;
        align-items: center;
        gap: 16px;
        z-index: 3;
        color: rgba(255, 255, 255, 0.72);
        font-size: 28px;
        font-weight: 700;
        letter-spacing: -0.02em;
      }

      .brand-mark {
        width: 52px;
        height: 52px;
        border-radius: 18px;
        background:
          radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.2), transparent 44%),
          linear-gradient(135deg, var(--accent-a), var(--accent-b));
        box-shadow:
          0 12px 32px color-mix(in srgb, var(--accent-a) 26%, transparent),
          inset 0 1px 0 rgba(255, 255, 255, 0.28);
      }
    </style>
  </head>
  <body>
    <div class="frame">
      <div class="grid"></div>
      <div class="brand">
        <span class="brand-mark"></span>
        <span>BuddyList</span>
      </div>
      <section class="hero">
        <p class="eyebrow">${escapeHtml(slide.eyebrow)}</p>
        <h1>
          ${escapeHtml(slide.title)}
          <span class="highlight">${escapeHtml(slide.highlight)}</span>
        </h1>
        <p class="body">${escapeHtml(slide.body)}</p>
        <div class="badge-row">
          <span class="badge">${escapeHtml(slide.badgeA ?? 'iPhone Ready')}</span>
          <span class="badge">${escapeHtml(slide.badgeB ?? 'Private by Design')}</span>
        </div>
      </section>
      <section class="device-wrap">
        <div class="device-shadow"></div>
        <div class="device">
          <div class="screen">
            <img src="${imageUrl}" alt="" />
            <div class="screen-glow"></div>
          </div>
        </div>
      </section>
    </div>
  </body>
</html>`;
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: {
      width: WIDTH,
      height: HEIGHT,
    },
    deviceScaleFactor: 1,
  });

  try {
    for (const slide of slides) {
      const sourcePath = path.join(rawDir, slide.source);
      const imageBytes = await fs.readFile(sourcePath);
      const imageUrl = `data:image/png;base64,${imageBytes.toString('base64')}`;
      const html = buildHtml(slide, imageUrl);
      await page.setContent(html, { waitUntil: 'load' });
      await page.waitForFunction(() =>
        Array.from(document.images).every((image) => image.complete && image.naturalWidth > 0),
      );
      await page.screenshot({
        path: path.join(outputDir, slide.output),
      });
      console.log(`Generated ${slide.output}`);
    }
  } finally {
    await browser.close();
  }
}

await main();
