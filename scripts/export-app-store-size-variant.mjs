import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const WIDTH = Number(process.env.ASC_WIDTH ?? '1284');
const HEIGHT = Number(process.env.ASC_HEIGHT ?? '2778');
const sourceDir =
  process.env.ASC_SOURCE_DIR ??
  path.join(process.cwd(), 'artifacts', 'app-store-connect', 'iphone-6.9-2026-03-29');
const outputDir =
  process.env.ASC_OUTPUT_DIR ??
  path.join(process.cwd(), 'artifacts', 'app-store-connect', 'iphone-6.5-2026-03-29');

function buildHtml(imageUrl) {
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
        background: #000;
      }

      img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    </style>
  </head>
  <body>
    <img src="${imageUrl}" alt="" />
  </body>
</html>`;
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  const pngFiles = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.png'))
    .map((entry) => entry.name)
    .sort();

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: {
      width: WIDTH,
      height: HEIGHT,
    },
    deviceScaleFactor: 1,
  });

  try {
    for (const fileName of pngFiles) {
      const sourcePath = path.join(sourceDir, fileName);
      const imageBytes = await fs.readFile(sourcePath);
      const imageUrl = `data:image/png;base64,${imageBytes.toString('base64')}`;
      await page.setContent(buildHtml(imageUrl), { waitUntil: 'load' });
      await page.waitForFunction(() =>
        Array.from(document.images).every((image) => image.complete && image.naturalWidth > 0),
      );
      await page.screenshot({
        path: path.join(outputDir, fileName),
      });
      console.log(`Exported ${fileName}`);
    }
  } finally {
    await browser.close();
  }
}

await main();
