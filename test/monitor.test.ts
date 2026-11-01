import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';

// The real bundle comes from a devlanes release, so the tests serve a fake with the same API.
const fake = fileURLToPath(new URL('./fixtures/tui-demo.js', import.meta.url));
const module = '**/tui/devlanes_tui_web.js';

/** What the fake module recorded, see test/fixtures/tui-demo.js. */
interface Calls {
  inits: number;
  mounts: { id: string; columns: number; rows: number }[];
  keys: [string, boolean, boolean, boolean][];
  ticks: number;
}

/** Reads the calls the fake module recorded on `window`. */
const calls = (page: Page) =>
  page.evaluate(() => (window as unknown as { tuiDemo: Calls }).tuiDemo);

/** Opens the landing page with the fake module and scrolls the demo into view. */
async function openLive(page: Page) {
  await page.route(module, (route) =>
    route.fulfill({ path: fake, contentType: 'text/javascript' })
  );
  await page.goto('/');
  await page.locator('#monitor').scrollIntoViewIfNeeded();
  await expect(page.locator('#tui-demo')).toHaveText('devlanes live demo');
}

test.beforeEach(async ({ page }) => {
  await page.route('https://metrics.arthur.one/**', (route) => route.fulfill({ body: '' }));
});

test('keeps the static monitor when the TUI web build is missing', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route(module, (route) => route.fulfill({ status: 404 }));
  await page.goto('/');
  const request = page.waitForResponse(module);
  await page.locator('#monitor').scrollIntoViewIfNeeded();
  await request;
  await expect(page.locator('[data-monitor-static]')).toBeVisible();
  await expect(page.locator('[data-monitor-live]')).toBeHidden();
  expect(errors).toEqual([]);
});

test('replaces the static monitor with a live TUI of 120 by 40 cells', async ({ page }) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await openLive(page);
    await expect(page.locator('[data-monitor-static]')).toBeHidden();
    await expect(page.locator('[data-monitor-live]')).toBeVisible();
    expect((await calls(page)).inits).toBe(1);
    expect((await calls(page)).mounts).toEqual([{ id: 'tui-demo', columns: 120, rows: 40 }]);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
  }
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
  expect((await calls(page)).keys).toEqual([]);

  const screen = page.getByRole('application', {
    name: 'Interactive demo of the devlanes terminal UI'
  });
  await screen.focus();
  await page.keyboard.press('j');
  await page.keyboard.press('Shift+M');
  await page.keyboard.press('Tab');
  expect((await calls(page)).keys).toEqual([
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
  await expect(page.getByRole('button', { name: 'j', exact: true })).toBeFocused();
});

test('key buttons send keys and return focus to the demo', async ({ page }) => {
  await openLive(page);
  const keys = page.getByRole('group', { name: 'Keys for the demo' });
  await keys.getByRole('button', { name: 'Enter' }).click();
  await keys.getByRole('button', { name: 'M', exact: true }).click();
  await keys.getByRole('button', { name: 'Esc' }).click();
  expect((await calls(page)).keys).toEqual([
    ['Enter', false, false, false],
    ['M', false, false, true],
    ['Escape', false, false, false]
  ]);
  await expect(page.locator('#tui-demo')).toBeFocused();
});

/**
 * Waits until the section's visibility reaches the page script. Intersection observers are
 * notified in the order they were created, so the page's observer has run once this one does.
 */
const observed = (page: Page, visible: boolean) =>
  page.evaluate(
    (visible) =>
      new Promise<void>((resolve) => {
        const observer = new IntersectionObserver((entries) => {
          if (entries.at(-1)?.isIntersecting !== visible) return;
          observer.disconnect();
          resolve();
        });
        observer.observe(document.querySelector('#monitor') as Element);
      }),
    visible
  );

test('ticks every second only while the demo is visible', async ({ page }) => {
  await page.clock.install();
  await openLive(page);
  await observed(page, true);
  await page.clock.runFor(3000);
  expect((await calls(page)).ticks).toBe(3);

  await page.evaluate(() => window.scrollTo(0, 0));
  await observed(page, false);
  await page.clock.runFor(3000);
  expect((await calls(page)).ticks).toBe(3);

  await page.locator('#tui-demo').scrollIntoViewIfNeeded();
  await observed(page, true);
  await page.clock.runFor(1000);
  expect((await calls(page)).ticks).toBe(4);

  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.runFor(3000);
  expect((await calls(page)).ticks).toBe(4);
});

// Runs only when the build synced a real bundle (a devlanes release with it, or
// DEVLANES_TUI_DIR); the tests above cover the page without one.
const bundle = fileURLToPath(new URL('../dist/tui/devlanes_tui_web.js', import.meta.url));

test('the real TUI bundle draws 120 by 40 cells and opens the monitor', async ({ page }) => {
  test.skip(!existsSync(bundle), 'no TUI web bundle in dist/tui');
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.locator('#monitor').scrollIntoViewIfNeeded();
  const screen = page.locator('#tui-demo');
  await expect(screen.locator('pre')).toHaveCount(40);
  expect(await screen.locator('pre').first().locator('span').count()).toBe(120);
  await expect(screen).toContainText('acme');
  await screen.focus();
  await page.keyboard.press('Shift+M');
  await expect(screen).toContainText('units');
  expect(errors).toEqual([]);
});

test('puts the static monitor back when the TUI fails', async ({ page }) => {
  await page.clock.install();
  await openLive(page);
  await observed(page, true);
  await page.evaluate(() => {
    (window as unknown as { tuiDemo: { failTick: boolean } }).tuiDemo.failTick = true;
  });
  await page.clock.runFor(1000);
  await expect(page.locator('[data-monitor-static]')).toBeVisible();
  await expect(page.locator('[data-monitor-live]')).toBeHidden();
  await page.locator('#tui-demo').press('j');
  expect((await calls(page)).keys).toEqual([]);
});
