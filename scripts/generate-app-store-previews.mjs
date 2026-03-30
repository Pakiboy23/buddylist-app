import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { chromium } from '@playwright/test';

const WIDTH = Number(process.env.ASC_PREVIEW_WIDTH ?? '886');
const HEIGHT = Number(process.env.ASC_PREVIEW_HEIGHT ?? '1920');
const FPS = Number(process.env.ASC_PREVIEW_FPS ?? '30');
const SEGMENT_SECONDS = Number(process.env.ASC_PREVIEW_SEGMENT_SECONDS ?? '5.6');
const TRANSITION_SECONDS = Number(process.env.ASC_PREVIEW_TRANSITION_SECONDS ?? '0.6');
const VIDEO_BITRATE = Number(process.env.ASC_PREVIEW_VIDEO_BITRATE ?? '11000000');
const AUDIO_BITRATE = Number(process.env.ASC_PREVIEW_AUDIO_BITRATE ?? '256000');
const VIDEO_BITRATE_K = `${Math.round(VIDEO_BITRATE / 1000)}k`;
const VIDEO_MAXRATE_K = `${Math.round((VIDEO_BITRATE * 1.1) / 1000)}k`;
const VIDEO_BUFSIZE_K = `${Math.round((VIDEO_BITRATE * 2) / 1000)}k`;
const AUDIO_BITRATE_K = `${Math.round(AUDIO_BITRATE / 1000)}k`;

const screenshotDir =
  process.env.ASC_SCREENSHOT_DIR ??
  path.join(process.cwd(), 'artifacts', 'app-store-connect', 'iphone-6.9-2026-03-29');
const outputDir =
  process.env.ASC_PREVIEW_OUTPUT_DIR ??
  path.join(process.cwd(), 'artifacts', 'app-store-connect', 'app-previews', 'iphone-portrait-2026-03-29');
const tempVideoDir = path.join(outputDir, '.tmp-webm');
const execFileAsync = promisify(execFile);

const previews = [
  {
    output: '01_premium-home-and-chat.mp4',
    themeStart: '#081425',
    themeEnd: '#102041',
    scenes: [
      {
        image: '02_buddy-list-home.png',
        badge: 'Premium Home',
        headline: 'Your Buddy List,\nrebuilt for calm.',
        detail: 'See people, notes, presence, and unread activity in one polished home.',
        accentStart: '#4cc9f0',
        accentEnd: '#818cf8',
        touch: { x: 0.49, y: 0.35 },
        motion: {
          startScale: 1.025,
          endScale: 1.065,
          startPanX: 0,
          endPanX: -10,
          startPanY: 24,
          endPanY: -36,
        },
      },
      {
        image: '03_direct-message.png',
        badge: 'Private Messaging',
        headline: 'Private chats that\nfeel instant.',
        detail: 'Themes, presence, and quick actions keep every conversation focused.',
        accentStart: '#fb7185',
        accentEnd: '#f59e0b',
        touch: { x: 0.82, y: 0.19 },
        motion: {
          startScale: 1.03,
          endScale: 1.07,
          startPanX: 0,
          endPanX: 12,
          startPanY: 18,
          endPanY: -18,
        },
      },
      {
        image: '04_saved-messages.png',
        badge: 'Saved Messages',
        headline: 'Keep the details\nthat matter.',
        detail: 'Save standout messages and private notes without cluttering the chat flow.',
        accentStart: '#2dd4bf',
        accentEnd: '#60a5fa',
        touch: { x: 0.79, y: 0.17 },
        motion: {
          startScale: 1.035,
          endScale: 1.075,
          startPanX: 0,
          endPanX: 0,
          startPanY: 24,
          endPanY: -20,
        },
      },
    ],
  },
  {
    output: '02_privacy-and-protection.mp4',
    themeStart: '#090f1d',
    themeEnd: '#15233b',
    scenes: [
      {
        image: '05_privacy-controls.png',
        badge: 'Privacy Controls',
        headline: 'Thoughtful privacy,\nright on the surface.',
        detail: 'Hide previews, enable screen shielding, and control what BuddyList reveals.',
        accentStart: '#818cf8',
        accentEnd: '#22d3ee',
        touch: { x: 0.82, y: 0.23 },
        motion: {
          startScale: 1.03,
          endScale: 1.07,
          startPanX: 0,
          endPanX: 8,
          startPanY: 20,
          endPanY: -18,
        },
      },
      {
        image: '06_app-lock.png',
        badge: 'App Lock',
        headline: 'A hidden device-only PIN\nfor extra peace.',
        detail: 'Add a local lock and choose exactly how quickly BuddyList asks again.',
        accentStart: '#60a5fa',
        accentEnd: '#34d399',
        touch: { x: 0.5, y: 0.78 },
        motion: {
          startScale: 1.04,
          endScale: 1.08,
          startPanX: 0,
          endPanX: 0,
          startPanY: 30,
          endPanY: -24,
        },
      },
      {
        image: '01_create-account.png',
        badge: 'Account Protection',
        headline: 'Set up recovery once\nand stay in control.',
        detail: 'New accounts can create a private recovery code during sign-up.',
        accentStart: '#38bdf8',
        accentEnd: '#22d3ee',
        touch: { x: 0.49, y: 0.74 },
        motion: {
          startScale: 1.02,
          endScale: 1.06,
          startPanX: 0,
          endPanX: -6,
          startPanY: 24,
          endPanY: -24,
        },
      },
    ],
  },
  {
    output: '03_find-and-add-buddies.mp4',
    themeStart: '#0a1323',
    themeEnd: '#142749',
    scenes: [
      {
        image: '07_add-buddy.png',
        badge: 'Discovery',
        headline: 'Find buddies by\nscreen name.',
        detail: 'Search, verify who you are adding, and grow your circle without friction.',
        accentStart: '#f59e0b',
        accentEnd: '#60a5fa',
        touch: { x: 0.52, y: 0.22 },
        motion: {
          startScale: 1.03,
          endScale: 1.08,
          startPanX: 0,
          endPanX: 0,
          startPanY: 22,
          endPanY: -22,
        },
      },
      {
        image: '02_buddy-list-home.png',
        badge: 'Buddy List',
        headline: 'See people, notes,\nand presence at once.',
        detail: 'The home screen keeps favorites and recent activity close without clutter.',
        accentStart: '#38bdf8',
        accentEnd: '#818cf8',
        touch: { x: 0.35, y: 0.27 },
        motion: {
          startScale: 1.025,
          endScale: 1.06,
          startPanX: 0,
          endPanX: 12,
          startPanY: 16,
          endPanY: -26,
        },
      },
      {
        image: '03_direct-message.png',
        badge: 'Start Talking',
        headline: 'Step straight into\nthe conversation.',
        detail: 'Open a thread and keep every message fast, polished, and private.',
        accentStart: '#fb7185',
        accentEnd: '#f59e0b',
        touch: { x: 0.81, y: 0.18 },
        motion: {
          startScale: 1.03,
          endScale: 1.07,
          startPanX: 0,
          endPanX: -10,
          startPanY: 20,
          endPanY: -18,
        },
      },
    ],
  },
];

function buildHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=${WIDTH}, initial-scale=1" />
    <style>
      html,
      body {
        margin: 0;
        width: ${WIDTH}px;
        height: ${HEIGHT}px;
        overflow: hidden;
        background: #020617;
      }

      canvas {
        display: block;
        width: ${WIDTH}px;
        height: ${HEIGHT}px;
      }
    </style>
  </head>
  <body>
    <canvas id="preview" width="${WIDTH}" height="${HEIGHT}"></canvas>
    <script>
      const WIDTH = ${WIDTH};
      const HEIGHT = ${HEIGHT};
      const FPS = ${FPS};
      const SEGMENT_SECONDS = ${SEGMENT_SECONDS};
      const TRANSITION_SECONDS = ${TRANSITION_SECONDS};
      function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
      }

      function lerp(start, end, amount) {
        return start + (end - start) * amount;
      }

      function easeOutCubic(value) {
        return 1 - Math.pow(1 - value, 3);
      }

      function easeInOutCubic(value) {
        if (value < 0.5) {
          return 4 * value * value * value;
        }
        return 1 - Math.pow(-2 * value + 2, 3) / 2;
      }

      function hexToRgb(hex) {
        const value = hex.replace('#', '');
        const normalized = value.length === 3
          ? value
              .split('')
              .map((part) => part + part)
              .join('')
          : value;

        return {
          r: Number.parseInt(normalized.slice(0, 2), 16),
          g: Number.parseInt(normalized.slice(2, 4), 16),
          b: Number.parseInt(normalized.slice(4, 6), 16),
        };
      }

      function rgba(hex, alpha) {
        const { r, g, b } = hexToRgb(hex);
        return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
      }

      function roundRectPath(ctx, x, y, width, height, radius) {
        const safeRadius = Math.min(radius, width / 2, height / 2);
        ctx.beginPath();
        ctx.moveTo(x + safeRadius, y);
        ctx.arcTo(x + width, y, x + width, y + height, safeRadius);
        ctx.arcTo(x + width, y + height, x, y + height, safeRadius);
        ctx.arcTo(x, y + height, x, y, safeRadius);
        ctx.arcTo(x, y, x + width, y, safeRadius);
        ctx.closePath();
      }

      function drawRoundedRect(ctx, x, y, width, height, radius, fillStyle, strokeStyle) {
        roundRectPath(ctx, x, y, width, height, radius);
        if (fillStyle) {
          ctx.fillStyle = fillStyle;
          ctx.fill();
        }
        if (strokeStyle) {
          ctx.strokeStyle = strokeStyle;
          ctx.stroke();
        }
      }

      function wrapText(ctx, text, maxWidth) {
        const words = text.split(/\\s+/).filter(Boolean);
        const lines = [];
        let currentLine = '';

        for (const word of words) {
          const candidate = currentLine ? currentLine + ' ' + word : word;
          if (ctx.measureText(candidate).width <= maxWidth || !currentLine) {
            currentLine = candidate;
            continue;
          }
          lines.push(currentLine);
          currentLine = word;
        }

        if (currentLine) {
          lines.push(currentLine);
        }

        return lines;
      }

      function drawMultiLine(ctx, text, x, y, maxWidth, lineHeight) {
        const sections = text.split('\\n');
        let cursorY = y;

        for (const section of sections) {
          const lines = wrapText(ctx, section, maxWidth);
          for (const line of lines) {
            ctx.fillText(line, x, cursorY);
            cursorY += lineHeight;
          }
        }

        return cursorY;
      }

      async function loadImage(src) {
        return await new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = (error) => reject(error);
          image.src = src;
        });
      }

      function getSceneMetrics(scene, localProgress) {
        const eased = easeInOutCubic(clamp(localProgress, 0, 1));
        const coverScale = Math.max(WIDTH / scene.image.width, HEIGHT / scene.image.height);
        const motion = scene.motion ?? {};
        const scale = coverScale * lerp(motion.startScale ?? 1, motion.endScale ?? 1.04, eased);
        const width = scene.image.width * scale;
        const height = scene.image.height * scale;
        const x = (WIDTH - width) / 2 + lerp(motion.startPanX ?? 0, motion.endPanX ?? 0, eased);
        const y = (HEIGHT - height) / 2 + lerp(motion.startPanY ?? 0, motion.endPanY ?? 0, eased);
        return { x, y, width, height };
      }

      function drawBackground(ctx, preview, alpha) {
        ctx.save();
        ctx.globalAlpha = alpha;

        const base = ctx.createLinearGradient(0, 0, 0, HEIGHT);
        base.addColorStop(0, preview.themeStart);
        base.addColorStop(1, preview.themeEnd);
        ctx.fillStyle = base;
        ctx.fillRect(0, 0, WIDTH, HEIGHT);

        const haloA = ctx.createRadialGradient(160, 280, 30, 160, 280, 620);
        haloA.addColorStop(0, rgba(preview.scenes[0].accentStart, 0.28));
        haloA.addColorStop(1, rgba(preview.scenes[0].accentStart, 0));
        ctx.fillStyle = haloA;
        ctx.fillRect(0, 0, WIDTH, HEIGHT);

        const haloB = ctx.createRadialGradient(WIDTH - 160, HEIGHT - 420, 60, WIDTH - 160, HEIGHT - 420, 720);
        haloB.addColorStop(0, rgba(preview.scenes.at(-1).accentEnd, 0.26));
        haloB.addColorStop(1, rgba(preview.scenes.at(-1).accentEnd, 0));
        ctx.fillStyle = haloB;
        ctx.fillRect(0, 0, WIDTH, HEIGHT);

        ctx.restore();
      }

      function drawScene(ctx, preview, scene, localTime, alpha) {
        const progress = clamp(localTime / SEGMENT_SECONDS, 0, 1);
        const metrics = getSceneMetrics(scene, progress);

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.drawImage(scene.image, metrics.x, metrics.y, metrics.width, metrics.height);

        const topFade = ctx.createLinearGradient(0, 0, 0, 620);
        topFade.addColorStop(0, 'rgba(3, 7, 18, 0.92)');
        topFade.addColorStop(1, 'rgba(3, 7, 18, 0)');
        ctx.fillStyle = topFade;
        ctx.fillRect(0, 0, WIDTH, 620);

        const bottomFade = ctx.createLinearGradient(0, HEIGHT - 420, 0, HEIGHT);
        bottomFade.addColorStop(0, 'rgba(3, 7, 18, 0)');
        bottomFade.addColorStop(1, 'rgba(3, 7, 18, 0.82)');
        ctx.fillStyle = bottomFade;
        ctx.fillRect(0, HEIGHT - 420, WIDTH, 420);

        const panelX = 58;
        const panelY = 76;
        const panelWidth = WIDTH - 116;
        const panelHeight = 326;

        ctx.shadowColor = rgba(scene.accentStart, 0.28);
        ctx.shadowBlur = 48;
        drawRoundedRect(
          ctx,
          panelX,
          panelY,
          panelWidth,
          panelHeight,
          34,
          'rgba(6, 15, 28, 0.72)',
          'rgba(255, 255, 255, 0.12)',
        );
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#f8fafc';
        ctx.font = '600 24px "SF Pro Display", "SF Pro Text", "Avenir Next", sans-serif';
        const badgeWidth = Math.max(180, 54 + ctx.measureText(scene.badge).width);
        drawRoundedRect(
          ctx,
          panelX + 28,
          panelY + 28,
          badgeWidth,
          54,
          999,
          rgba(scene.accentStart, 0.18),
          rgba(scene.accentEnd, 0.36),
        );

        ctx.fillText(scene.badge, panelX + 55, panelY + 62);

        ctx.font = '700 56px "SF Pro Display", "SF Pro Text", "Avenir Next", sans-serif';
        ctx.fillStyle = '#ffffff';
        let cursorY = drawMultiLine(ctx, scene.headline, panelX + 28, panelY + 128, panelWidth - 56, 62);

        ctx.font = '400 28px "SF Pro Text", "Avenir Next", sans-serif';
        ctx.fillStyle = 'rgba(226, 232, 240, 0.92)';
        cursorY += 14;
        drawMultiLine(ctx, scene.detail, panelX + 28, cursorY, panelWidth - 56, 36);

        const accentBar = ctx.createLinearGradient(panelX + 28, panelY + panelHeight - 18, panelX + panelWidth - 28, panelY + panelHeight - 18);
        accentBar.addColorStop(0, rgba(scene.accentStart, 0.8));
        accentBar.addColorStop(1, rgba(scene.accentEnd, 0.8));
        drawRoundedRect(ctx, panelX + 28, panelY + panelHeight - 22, panelWidth - 56, 8, 999, accentBar);

        const touchProgress = clamp((localTime - 1.35) / 1.75, 0, 1);
        if (touchProgress > 0 && scene.touch) {
          const touchAlpha = Math.sin(touchProgress * Math.PI);
          const touchX = metrics.x + metrics.width * scene.touch.x;
          const touchY = metrics.y + metrics.height * scene.touch.y;

          for (let index = 0; index < 3; index += 1) {
            const rippleProgress = clamp(touchProgress - index * 0.14, 0, 1);
            if (rippleProgress <= 0) {
              continue;
            }

            const radius = 24 + rippleProgress * 58;
            ctx.beginPath();
            ctx.arc(touchX, touchY, radius, 0, Math.PI * 2);
            ctx.strokeStyle = rgba(scene.accentEnd, 0.34 * (1 - rippleProgress) * touchAlpha);
            ctx.lineWidth = 6;
            ctx.stroke();
          }

          const touchGlow = ctx.createRadialGradient(touchX, touchY, 0, touchX, touchY, 72);
          touchGlow.addColorStop(0, rgba(scene.accentStart, 0.92 * touchAlpha));
          touchGlow.addColorStop(0.35, rgba(scene.accentEnd, 0.65 * touchAlpha));
          touchGlow.addColorStop(1, rgba(scene.accentEnd, 0));
          ctx.fillStyle = touchGlow;
          ctx.beginPath();
          ctx.arc(touchX, touchY, 72, 0, Math.PI * 2);
          ctx.fill();

          ctx.beginPath();
          ctx.arc(touchX, touchY, 18, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.fill();
        }

        ctx.restore();
      }

      function sceneAlpha(sceneIndex, time, sceneCount) {
        const offset = sceneIndex * (SEGMENT_SECONDS - TRANSITION_SECONDS);
        const localTime = time - offset;
        if (localTime < 0 || localTime > SEGMENT_SECONDS) {
          return 0;
        }

        let alpha = 1;

        if (sceneIndex > 0) {
          alpha *= easeOutCubic(clamp(localTime / TRANSITION_SECONDS, 0, 1));
        }

        if (sceneIndex < sceneCount - 1) {
          const fadeOutStart = SEGMENT_SECONDS - TRANSITION_SECONDS;
          if (localTime > fadeOutStart) {
            alpha *= 1 - easeOutCubic(clamp((localTime - fadeOutStart) / TRANSITION_SECONDS, 0, 1));
          }
        }

        return alpha;
      }

      async function playPreview(preview) {
        const canvas = document.getElementById('preview');
        const ctx = canvas.getContext('2d');
        const preparedScenes = await Promise.all(
          preview.scenes.map(async (scene) => ({
            ...scene,
            image: await loadImage(scene.imageDataUrl),
          })),
        );
        const preparedPreview = {
          ...preview,
          scenes: preparedScenes,
        };

        const totalDurationSeconds =
          preview.scenes.length * SEGMENT_SECONDS - (preview.scenes.length - 1) * TRANSITION_SECONDS;
        const totalDurationMs = totalDurationSeconds * 1000;

        return await new Promise((resolve, reject) => {
          const startedAt = performance.now();

          function drawFrame(timestamp) {
            const elapsed = timestamp - startedAt;
            const clampedElapsed = Math.min(elapsed, totalDurationMs);
            const seconds = clampedElapsed / 1000;

            ctx.clearRect(0, 0, WIDTH, HEIGHT);
            drawBackground(ctx, preparedPreview, 1);

            for (let sceneIndex = 0; sceneIndex < preparedPreview.scenes.length; sceneIndex += 1) {
              const offset = sceneIndex * (SEGMENT_SECONDS - TRANSITION_SECONDS);
              const localTime = seconds - offset;
              const alpha = sceneAlpha(sceneIndex, seconds, preparedPreview.scenes.length);
              if (alpha <= 0 || localTime < 0 || localTime > SEGMENT_SECONDS) {
                continue;
              }
              drawScene(ctx, preparedPreview, preparedPreview.scenes[sceneIndex], localTime, alpha);
            }

            if (elapsed < totalDurationMs) {
              requestAnimationFrame(drawFrame);
            } else {
              resolve({
                durationSeconds: totalDurationSeconds,
              });
            }
          }

          drawFrame(startedAt);
          requestAnimationFrame(drawFrame);
        });
      }

      window.playAppPreview = playPreview;
    </script>
  </body>
</html>`;
}

async function fileToDataUrl(filePath) {
  const bytes = await fs.readFile(filePath);
  return `data:image/png;base64,${bytes.toString('base64')}`;
}

async function transcodePreview(webmPath, outputPath) {
  await execFileAsync('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    '-i',
    webmPath,
    '-f',
    'lavfi',
    '-i',
    'anullsrc=r=48000:cl=stereo',
    '-shortest',
    '-vf',
    `fps=${FPS},scale=${WIDTH}:${HEIGHT}:flags=lanczos,format=yuv420p`,
    '-c:v',
    'libx264',
    '-preset',
    'fast',
    '-profile:v',
    'high',
    '-level',
    '4.0',
    '-pix_fmt',
    'yuv420p',
    '-b:v',
    VIDEO_BITRATE_K,
    '-maxrate',
    VIDEO_MAXRATE_K,
    '-bufsize',
    VIDEO_BUFSIZE_K,
    '-c:a',
    'aac',
    '-b:a',
    AUDIO_BITRATE_K,
    '-ar',
    '48000',
    '-movflags',
    '+faststart',
    outputPath,
  ]);
}

async function inspectVideo(filePath) {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v',
    'error',
    '-show_streams',
    '-show_format',
    '-print_format',
    'json',
    filePath,
  ]);

  return JSON.parse(stdout);
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  await fs.rm(tempVideoDir, { recursive: true, force: true });
  await fs.mkdir(tempVideoDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });

  try {
    for (const preview of previews) {
      const outputPath = path.join(outputDir, preview.output);
      const scenes = await Promise.all(
        preview.scenes.map(async (scene) => ({
          ...scene,
          imageDataUrl: await fileToDataUrl(path.join(screenshotDir, scene.image)),
        })),
      );

      const context = await browser.newContext({
        viewport: {
          width: WIDTH,
          height: HEIGHT,
        },
        deviceScaleFactor: 1,
        recordVideo: {
          dir: tempVideoDir,
          size: {
            width: WIDTH,
            height: HEIGHT,
          },
        },
      });
      const page = await context.newPage();

      try {
        await page.setContent(buildHtml(), { waitUntil: 'load' });
        const result = await page.evaluate(async (config) => await window.playAppPreview(config), {
          ...preview,
          scenes,
        });
        await page.waitForTimeout(350);
        const rawVideo = page.video();
        await page.close();
        await context.close();
        const webmPath = await rawVideo.path();
        await transcodePreview(webmPath, outputPath);
        const inspection = await inspectVideo(outputPath);
        const videoStream = inspection.streams.find((stream) => stream.codec_type === 'video');
        const audioStream = inspection.streams.find((stream) => stream.codec_type === 'audio');
        console.log(
          `Exported ${preview.output} (${result.durationSeconds.toFixed(2)}s source -> ${Number(inspection.format.duration).toFixed(2)}s final, ${videoStream.width}x${videoStream.height}, ${videoStream.codec_name}/${audioStream?.codec_name ?? 'none'})`,
        );
        await fs.rm(webmPath, { force: true });
      } finally {
        await context.close().catch(() => {});
      }
    }
  } finally {
    await browser.close();
    await fs.rm(tempVideoDir, { recursive: true, force: true });
  }
}

await main();
