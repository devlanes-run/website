// Renders the Chrome Web Store images of the browser extension from scripts/store-images/slides.html
// into public/assets/chrome-web-store/. Each section of the page is one file, named by its id.
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const source = fileURLToPath(new URL('./store-images/slides.html', import.meta.url));
const outDir = fileURLToPath(new URL('../public/assets/chrome-web-store/', import.meta.url));

// The store checks these sizes exactly.
const images = [
  { id: 'lanes', file: 'screenshot-1-lanes.png', width: 1280, height: 800 },
  { id: 'boxes', file: 'screenshot-2-boxes.png', width: 1280, height: 800 },
  { id: 'logins', file: 'screenshot-3-logins.png', width: 1280, height: 800 },
  { id: 'settings', file: 'screenshot-4-settings.png', width: 1280, height: 800 },
  { id: 'tile', file: 'promo-small-440x280.png', width: 440, height: 280 },
  { id: 'marquee', file: 'promo-marquee-1400x560.png', width: 1400, height: 560 },
  { id: 'icon', file: 'icon-128.png', width: 128, height: 128, transparent: true }
];

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1400, height: 800 },
    deviceScaleFactor: 1
  });
  await page.goto(pathToFileURL(source).href);
  await page.evaluate(() => document.fonts.ready);
  for (const image of images) {
    const section = page.locator(`#${image.id}`);
    const box = await section.boundingBox();
    if (box?.width !== image.width || box?.height !== image.height) {
      throw new Error(
        `#${image.id} is ${box?.width}x${box?.height}, expected ${image.width}x${image.height}`
      );
    }
    const png = await section.screenshot({ omitBackground: image.transparent ?? false });
    // Byte 25 is the IHDR colour type: 2 is RGB, 6 is RGBA. The store refuses alpha outside the
    // icon, and Chromium decides which one it writes.
    const colourType = png[25];
    if (colourType !== (image.transparent ? 6 : 2)) {
      throw new Error(`#${image.id} has PNG colour type ${colourType}`);
    }
    await writeFile(join(outDir, image.file), png);
    console.log(join(outDir, image.file));
  }
} finally {
  await browser.close();
}
