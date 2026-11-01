import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';

// The real bundle comes from a devlanes release, so the tests serve a fake with the same API.
const fake = fileURLToPath(new URL('./fixtures/tui-demo.js', import.meta.url));
const module = '**/tui/devlanes_tui_web.js';
// The landing page's monitor fold. The demo mounts once the fold is within 600px of the
// viewport, so the tests scroll it into view after loading.
const route = '/#monitor';
// The demo opens on the monitor by sending M as soon as it is mounted.
const opening: [string, boolean, boolean, boolean] = ['M', false, false, true];

/** What the fake module recorded, see test/fixtures/tui-demo.js. */
interface Calls {
  inits: number;
  constructed: number;
  mounts: { id: string; columns: number; rows: number }[];
  keys: [string, boolean, boolean, boolean][];
  /** Keys sent with the Meta flag, which the module refuses. */
  metaKeys: string[];
  ticks: number;
  resizes: number;
  frees: number;
}

/** Reads the calls the fake module recorded on `window`. */
const calls = (page: Page) =>
  page.evaluate(() => (window as unknown as { tuiDemo: Calls }).tuiDemo);

/** The grid the page built: the element's size in cells and what is in the DOM. */
const grid = (page: Page) =>
  page.evaluate(() => {
    const screen = document.querySelector('#tui-demo') as HTMLElement;
    const wrapper = document.querySelector('[data-tui]') as HTMLElement;
    const lines = screen.querySelectorAll('pre');
    const box = screen.getBoundingClientRect();
    const frame = wrapper.getBoundingClientRect();
    return {
      cols: Number(screen.dataset.cols),
      rows: Number(screen.dataset.rows),
      lines: lines.length,
      cells: lines[0]?.childElementCount ?? 0,
      fits: box.left >= frame.left - 0.5 && box.right <= frame.right + 0.5,
      overflow: document.documentElement.scrollWidth > window.innerWidth
    };
  });

/** Serves the fake module, optionally making one of its steps fail from the first call. */
async function serveFake(page: Page, fail?: 'init' | 'mount' | 'key' | 'tick') {
  if (fail) {
    await page.addInitScript((fail) => {
      (window as unknown as { tuiDemoFail: string }).tuiDemoFail = fail;
    }, fail);
  }
  await page.route(module, (route) =>
    route.fulfill({ path: fake, contentType: 'text/javascript' })
  );
}

/** Opens the test page with the fake module and waits for the live swap. */
async function openLive(page: Page) {
  await serveFake(page);
  await page.goto(route);
  await expect(page.locator('[data-tui-live]')).toBeVisible();
  await expect(page.locator('[data-tui-static]')).toBeHidden();
  await expect(page.locator('#tui-demo')).toContainText('devlanes live demo');
}

/** Collects page errors and console errors, which the demo must never produce. */
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

test('keeps the static screen when the TUI web build is missing', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route(module, (route) => route.abort());
  const request = page.waitForRequest(module);
  await page.goto(route);
  await request;
  await page.waitForTimeout(300);
  await expect(page.locator('[data-tui-static]')).toBeVisible();
  await expect(page.locator('[data-tui-static] .monitor-table')).toContainText('api');
  await expect(page.locator('[data-tui-live]')).toBeHidden();
  await expect(page.locator('[data-tui-badge]')).toBeHidden();
  expect(errors).toEqual([]);
});

test('mounts a live TUI of 140 by 34 cells on a wide window', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openLive(page);
  const recorded = await calls(page);
  expect(recorded.inits).toBe(1);
  expect(recorded.mounts).toEqual([{ id: 'tui-demo', columns: 140, rows: 34 }]);
  expect(recorded.keys).toEqual([opening]);
  expect(await grid(page)).toEqual({
    cols: 140,
    rows: 34,
    lines: 34,
    cells: 140,
    fits: true,
    overflow: false
  });
  await expect(page.locator('#tui-demo')).toHaveCSS('font-size', '13px');

  // The badge in the title bar says where the keys go.
  const badge = page.locator('[data-tui-badge]');
  await expect(badge).toHaveText('Live terminal, click to interact');
  await page.locator('#tui-demo').focus();
  await expect(badge).toHaveText('Live terminal, keys go to it');
  await page.locator('#tui-demo').blur();
  await expect(badge).toHaveText('Live terminal, click to interact');
});

test('mounts a smaller font with fewer columns and rows on a phone-sized window', async ({
  page
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openLive(page);
  const recorded = await calls(page);
  expect(recorded.mounts).toEqual([{ id: 'tui-demo', columns: 61, rows: 26 }]);
  expect(await grid(page)).toEqual({
    cols: 61,
    rows: 26,
    lines: 26,
    cells: 61,
    fits: true,
    overflow: false
  });
  await expect(page.locator('#tui-demo')).toHaveCSS('font-size', '10.5px');
});

test('lays the TUI out again at the new width after a resize, keeping its page', async ({
  page
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openLive(page);
  const errors = watchErrors(page);
  const screen = page.locator('#tui-demo');
  await screen.focus();
  await page.keyboard.press('Shift+D');
  // The element is resized once the width settles, then the demo lays itself out again.
  await page.setViewportSize({ width: 900, height: 900 });
  await expect.poll(async () => (await calls(page)).mounts.length).toBe(2);
  await expect(screen).toContainText('devlanes live demo');
  const recorded = await calls(page);
  expect(recorded.constructed).toBe(1);
  expect(recorded.frees).toBe(0);
  expect(recorded.resizes).toBe(1);
  // 900px minus the page's 40px side padding, in 13px JetBrains Mono cells.
  expect(recorded.mounts[1]).toEqual({ id: 'tui-demo', columns: 104, rows: 34 });
  // The demo keeps its page, so nothing is replayed.
  expect(recorded.keys).toEqual([
    opening,
    ['Shift', false, false, true],
    ['D', false, false, true]
  ]);
  expect(await grid(page)).toMatchObject({ cols: 104, lines: 34, cells: 104, fits: true });

  // A resize that keeps the cell counts leaves the demo alone.
  await page.setViewportSize({ width: 900, height: 700 });
  await page.waitForTimeout(400);
  expect((await calls(page)).mounts).toHaveLength(2);
  expect(errors).toEqual([]);
});

test('sends keys to the TUI and leaves unused keys to the page', async ({ page }) => {
  await openLive(page);
  await page.evaluate(() => {
    const prevented: [string, boolean][] = [];
    (window as unknown as { prevented: typeof prevented }).prevented = prevented;
    document.addEventListener('keydown', (event) => {
      prevented.push([event.key, event.defaultPrevented]);
    });
  });
  const prevented = () =>
    page.evaluate(() => (window as unknown as { prevented: [string, boolean][] }).prevented);

  await page.keyboard.press('j');
  expect((await calls(page)).keys).toEqual([opening]);

  const screen = page.getByRole('application', { name: 'The devlanes terminal, live' });
  await screen.focus();
  await page.keyboard.press('j');
  await page.keyboard.press('Shift+M');
  await page.keyboard.press('Tab');
  expect((await calls(page)).keys).toEqual([
    opening,
    ['j', false, false, false],
    ['Shift', false, false, true],
    ['M', false, false, true],
    ['Tab', false, false, false]
  ]);
  expect(await prevented()).toEqual([
    ['j', false],
    ['j', true],
    ['Shift', false],
    ['M', true],
    ['Tab', false]
  ]);
  await expect(screen).not.toBeFocused();
});

test('leaves browser shortcuts and refused chords to the page', async ({ page }) => {
  await openLive(page);
  const screen = page.locator('#tui-demo');
  await page.evaluate(() => {
    const prevented: [string, boolean][] = [];
    (window as unknown as { prevented: typeof prevented }).prevented = prevented;
    document.addEventListener('keydown', (event) => {
      prevented.push([event.key, event.defaultPrevented]);
    });
  });
  await screen.focus();

  // Command shortcuts reach the module with the Meta flag, which refuses them.
  await page.keyboard.press('Meta+j');
  expect((await calls(page)).keys).toEqual([opening]);
  expect((await calls(page)).metaKeys).toEqual(['Meta', 'j']);

  // A chord the module refuses keeps its browser behaviour.
  await page.keyboard.press('Control+l');
  expect((await calls(page)).keys).toEqual([
    opening,
    ['Control', true, false, false],
    ['l', true, false, false]
  ]);

  // Ctrl+C copies text selected in the demo instead of reaching the module.
  await screen.evaluate((element) => {
    window.getSelection()?.selectAllChildren(element);
  });
  await page.keyboard.press('Control+c');
  expect((await calls(page)).keys.filter(([key]) => key === 'c')).toEqual([]);

  const events = await page.evaluate(
    () => (window as unknown as { prevented: [string, boolean][] }).prevented
  );
  expect(events.every(([, prevented]) => !prevented)).toBe(true);
});

test('ticks every second only while motion runs and the tab is visible', async ({ page }) => {
  await page.clock.install();
  await openLive(page);
  // From here on only runFor moves the page's clock, so counts do not depend on wall time.
  await page.clock.pauseAt(Date.now() + 60_000);
  const ticks = async () => (await calls(page)).ticks;
  let baseline = await ticks();
  await page.clock.runFor(3000);
  expect(await ticks()).toBe(baseline + 3);

  // The footer's pause button and reduced motion both set data-motion="paused".
  await page.evaluate(() => {
    document.documentElement.dataset.motion = 'paused';
  });
  await page.clock.runFor(50);
  baseline = await ticks();
  await page.clock.runFor(3000);
  expect(await ticks()).toBe(baseline);
  await page.evaluate(() => {
    document.documentElement.dataset.motion = 'running';
  });
  await page.clock.runFor(1050);
  expect(await ticks()).toBe(baseline + 1);

  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  baseline = await ticks();
  await page.clock.runFor(3000);
  expect(await ticks()).toBe(baseline);
});

test('touch screens tour the pages until they are tapped', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true
  });
  const page = await context.newPage();
  await page.clock.install();
  await openLive(page);
  await page.clock.pauseAt(Date.now() + 60_000);
  const screen = page.locator('#tui-demo');
  await expect(page.locator('[data-tui-badge]')).toHaveText('Live terminal, tap to interact');
  // The jump above already ran some of the tour; only what runFor sends from here on counts.
  const sent = (await calls(page)).keys.length;
  const since = async () => (await calls(page)).keys.slice(sent);
  await page.clock.runFor(6050);
  expect(await since()).toHaveLength(1);
  await page.clock.runFor(6000);
  const keys = await since();
  expect(keys).toHaveLength(2);
  // The tour runs M, Escape, D in a loop; two consecutive steps are two different pages.
  for (const [key, ctrl, alt, shift] of keys) {
    expect(['M', 'Escape', 'D']).toContain(key);
    expect([ctrl, alt, shift]).toEqual([false, false, key !== 'Escape']);
  }
  expect(keys[0]?.[0]).not.toBe(keys[1]?.[0]);
  // A tap reaches the TUI itself, so the tour stops for good.
  await screen.tap();
  const after = (await calls(page)).keys.length;
  await page.clock.runFor(12_100);
  expect((await calls(page)).keys).toHaveLength(after);
  await context.close();
});

for (const step of ['init', 'mount'] as const) {
  test(`keeps the static screen when the module fails at ${step}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await serveFake(page, step);
    await page.goto(route);
    // A failed mount is retried once before the static screen is kept.
    const reached = step === 'init' ? 1 : 2;
    await expect
      .poll(async () => {
        const recorded = await calls(page);
        return recorded ? (step === 'init' ? recorded.inits : recorded.constructed) : 0;
      })
      .toBe(reached);
    await expect(page.locator('[data-tui-static]')).toBeVisible();
    await expect(page.locator('[data-tui-live]')).toBeHidden();
    expect(errors).toEqual([]);
  });
}

test('remounts once when a call throws and gives up on the second failure', async ({ page }) => {
  await page.clock.install();
  await openLive(page);
  await page.clock.pauseAt(Date.now() + 60_000);
  await page.evaluate(() => {
    (window as unknown as { tuiDemoFail: string }).tuiDemoFail = 'tick';
  });
  await page.clock.runFor(1000);
  // The first failure frees the demo and mounts it again after 150ms.
  await page.clock.runFor(200);
  await expect(page.locator('[data-tui-live]')).toBeVisible();
  expect((await calls(page)).mounts).toHaveLength(2);
  expect((await calls(page)).keys).toEqual([opening, opening]);
  // The second failure puts the static screen back for good.
  await page.clock.runFor(1200);
  await expect(page.locator('[data-tui-static]')).toBeVisible();
  await expect(page.locator('[data-tui-live]')).toBeHidden();
  await page.clock.runFor(2000);
  expect((await calls(page)).mounts).toHaveLength(2);
});

// Runs only when a real bundle was synced into public/tui (a devlanes release with it, or
// DEVLANES_TUI_DIR); the tests above cover the page without one.
const bundle = fileURLToPath(new URL('../public/tui/devlanes_tui_web.js', import.meta.url));

const real: [width: number, height: number, cols: number, rows: number][] = [
  [1440, 900, 140, 34],
  [390, 844, 61, 26],
  [320, 568, 50, 26]
];

for (const [width, height, cols, rows] of real) {
  test(`the real TUI bundle opens on the monitor at ${width}px`, async ({ page }) => {
    test.skip(!existsSync(bundle), 'no TUI web bundle in public/tui');
    const errors = watchErrors(page);
    await page.setViewportSize({ width, height });
    await page.goto(route);
    const screen = page.locator('#tui-demo');
    // Compiling the wasm takes a while on CI runners.
    await expect(screen.locator('pre')).toHaveCount(rows, { timeout: 30_000 });
    expect(await grid(page)).toEqual({
      cols,
      rows,
      lines: rows,
      cells: cols,
      fits: true,
      overflow: false
    });
    await expect(screen).toContainText('units');
    await expect(screen).toContainText('devlanes');
    if (width > 720) {
      await screen.focus();
      await page.keyboard.press('j');
      await expect(screen).toContainText('units');
    }
    // Ratzilla rebuilds its grid on a window resize; a grid of another size is freed first and
    // mounted again at the new size, still on the monitor.
    const next = width > 720 ? 900 : 700;
    await page.setViewportSize({ width: next, height });
    await expect.poll(async () => (await grid(page)).cols).not.toBe(cols);
    await expect(screen.locator('pre')).toHaveCount(rows);
    const after = await grid(page);
    expect(after).toMatchObject({ lines: rows, cells: after.cols, fits: true, overflow: false });
    await expect(screen).toContainText('units');
    expect(errors).toEqual([]);
  });
}
