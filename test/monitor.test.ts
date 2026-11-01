import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';

// The real bundle comes from a devlanes release, so the tests serve a fake with the same API.
const fake = fileURLToPath(new URL('./fixtures/tui-demo.js', import.meta.url));
const module = '**/tui/devlanes_tui_web.js';
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
}

/** Reads the calls the fake module recorded on `window`. */
const calls = (page: Page) =>
  page.evaluate(() => (window as unknown as { tuiDemo: Calls }).tuiDemo);

/** Serves the fake module, optionally making one of its steps fail from the first call. */
async function serveFake(page: Page, fail?: 'init' | 'mount' | 'key') {
  if (fail) {
    await page.addInitScript((fail) => {
      (window as unknown as { tuiDemoFail: string }).tuiDemoFail = fail;
    }, fail);
  }
  await page.route(module, (route) =>
    route.fulfill({ path: fake, contentType: 'text/javascript' })
  );
}

/** Opens the landing page with the fake module and scrolls the demo into view. */
async function openLive(page: Page) {
  await serveFake(page);
  await page.goto('/');
  await page.locator('#monitor').scrollIntoViewIfNeeded();
  await expect(page.locator('#tui-demo')).toHaveText('devlanes live demo');
}

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

test.beforeEach(async ({ page }) => {
  await page.route('https://metrics.arthur.one/**', (route) => route.fulfill({ body: '' }));
});

test('keeps the static screen when the TUI web build is missing', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route(module, (route) => route.fulfill({ status: 404 }));
  const response = page.waitForResponse(module);
  await page.goto('/');
  await page.locator('#monitor').scrollIntoViewIfNeeded();
  await response;
  await expect(page.locator('[data-monitor-static]')).toBeVisible();
  await expect(page.locator('[data-monitor-live]')).toBeHidden();
  expect(errors).toEqual([]);
});

test('replaces the static screen with a live TUI of 120 by 40 cells', async ({ page }) => {
  // 800px scales the demo down, 1440px shows it at full size.
  for (const width of [1440, 800]) {
    await page.setViewportSize({ width, height: 900 });
    await openLive(page);
    await expect(page.locator('[data-monitor-static]')).toBeHidden();
    await expect(page.locator('[data-monitor-live]')).toBeVisible();
    await expect(page.locator('[data-monitor-live] .terminal-bar')).toHaveText('devlanes');
    const recorded = await calls(page);
    expect(recorded.inits).toBe(1);
    expect(recorded.mounts).toEqual([{ id: 'tui-demo', columns: 120, rows: 40 }]);
    expect(recorded.keys).toEqual([opening]);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const viewport = document.querySelector('.tui-live-viewport') as HTMLElement;
          const box = (document.querySelector('#tui-demo') as HTMLElement).getBoundingClientRect();
          const frame = viewport.getBoundingClientRect();
          return (
            box.left >= frame.left - 0.5 &&
            box.right <= frame.right + 0.5 &&
            box.right <= innerWidth &&
            Math.abs(frame.height - box.height) < 1
          );
        })
      )
      .toBe(true);
  }
});

test('phones keep the static screen until the layout is wide enough', async ({ page }) => {
  const requested: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/tui/')) requested.push(request.url());
  });
  await serveFake(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('#monitor').scrollIntoViewIfNeeded();
  await observed(page, true);
  await page.waitForTimeout(500);
  await expect(page.locator('[data-monitor-static]')).toBeVisible();
  await expect(page.locator('[data-monitor-live]')).toBeHidden();
  expect(requested).toEqual([]);

  // Turning the phone or widening the window loads the demo after all.
  await page.setViewportSize({ width: 1000, height: 844 });
  await expect(page.locator('#tui-demo')).toHaveText('devlanes live demo');
  await expect(page.locator('[data-monitor-static]')).toBeHidden();
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

  const screen = page.getByRole('application', {
    name: 'Interactive demo of the devlanes terminal UI'
  });
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
  await expect(page.getByRole('button', { name: 'j', exact: true })).toBeFocused();
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

test('key buttons send keys and return focus to the demo', async ({ page }) => {
  await openLive(page);
  const keys = page.getByRole('group', { name: 'Keys for the demo' });
  await keys.getByRole('button', { name: 'Enter' }).click();
  await keys.getByRole('button', { name: 'D', exact: true }).click();
  await keys.getByRole('button', { name: 'Esc' }).click();
  expect((await calls(page)).keys).toEqual([
    opening,
    ['Enter', false, false, false],
    ['D', false, false, true],
    ['Escape', false, false, false]
  ]);
  await expect(page.locator('#tui-demo')).toBeFocused();
});

test('ticks every second only while the demo is visible and motion runs', async ({ page }) => {
  await page.clock.install();
  await openLive(page);
  await observed(page, true);
  // From here on only runFor moves the page's clock, so counts do not depend on wall time.
  await page.clock.pauseAt(Date.now() + 60_000);
  const ticks = async () => (await calls(page)).ticks;
  let baseline = await ticks();
  await page.clock.runFor(3000);
  expect(await ticks()).toBe(baseline + 3);

  await page.evaluate(() => window.scrollTo(0, 0));
  await observed(page, false);
  baseline = await ticks();
  await page.clock.runFor(3000);
  expect(await ticks()).toBe(baseline);

  await page.locator('#tui-demo').scrollIntoViewIfNeeded();
  await observed(page, true);
  await page.clock.runFor(1000);
  expect(await ticks()).toBe(baseline + 1);

  // Reduced motion and the footer's pause button both set data-motion="paused".
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'paused');
  baseline = await ticks();
  await page.clock.runFor(3000);
  expect(await ticks()).toBe(baseline);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'running');
  await page.clock.runFor(1000);
  expect(await ticks()).toBe(baseline + 1);

  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  baseline = await ticks();
  await page.clock.runFor(3000);
  expect(await ticks()).toBe(baseline);
});

for (const step of ['init', 'mount', 'key'] as const) {
  test(`keeps the static screen when the module fails at ${step}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await serveFake(page, step);
    await page.goto('/');
    await page.locator('#monitor').scrollIntoViewIfNeeded();
    // Each counter is set before the step throws, and the page reacts in the same task.
    const reached = {
      init: (recorded: Calls) => recorded.inits,
      mount: (recorded: Calls) => recorded.constructed,
      key: (recorded: Calls) => recorded.keys.length
    }[step];
    await expect
      .poll(async () => {
        const recorded = await calls(page);
        return recorded ? reached(recorded) : 0;
      })
      .toBe(1);
    await expect(page.locator('[data-monitor-static]')).toBeVisible();
    await expect(page.locator('[data-monitor-live]')).toBeHidden();
    expect(errors).toEqual([]);
  });
}

test('puts the static screen back when a tick fails', async ({ page }) => {
  await page.clock.install();
  await openLive(page);
  await observed(page, true);
  await page.evaluate(() => {
    (window as unknown as { tuiDemoFail: string }).tuiDemoFail = 'tick';
  });
  await page.clock.runFor(1000);
  await expect(page.locator('[data-monitor-static]')).toBeVisible();
  await expect(page.locator('[data-monitor-live]')).toBeHidden();
  await page.locator('#tui-demo').press('j');
  expect((await calls(page)).keys).toEqual([opening]);
});

// Runs only when the build synced a real bundle (a devlanes release with it, or
// DEVLANES_TUI_DIR); the tests above cover the page without one.
const bundle = fileURLToPath(new URL('../dist/tui/devlanes_tui_web.js', import.meta.url));

test('the real TUI bundle opens on the monitor at 120 by 40 cells', async ({ page }) => {
  test.skip(!existsSync(bundle), 'no TUI web bundle in dist/tui');
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.locator('#monitor').scrollIntoViewIfNeeded();
  const screen = page.locator('#tui-demo');
  // Compiling the wasm takes a while on CI runners.
  await expect(screen.locator('pre')).toHaveCount(40, { timeout: 30_000 });
  expect(await screen.locator('pre').first().locator('span').count()).toBe(120);
  await expect(screen).toContainText('acme');
  await expect(screen).toContainText('units');
  await screen.focus();
  await page.keyboard.press('j');
  await expect(screen).toContainText('units');
  // Ratzilla rebuilds its grid on a window resize; the screen must come back at once, also when
  // the narrower layout scales the demo down.
  for (const width of [1200, 800]) {
    await page.setViewportSize({ width, height: 800 });
    await expect(screen.locator('pre')).toHaveCount(40);
    await expect(screen).toContainText('units');
    await expect
      .poll(() =>
        screen.evaluate((element) => {
          const rows = element.querySelectorAll('pre');
          const last = rows[rows.length - 1]?.getBoundingClientRect();
          const box = element.getBoundingClientRect();
          // The container is 2px taller than 40 rows so rounding never drops one.
          return last ? Math.abs(box.bottom - last.bottom) <= 3 : false;
        })
      )
      .toBe(true);
  }
  expect(errors).toEqual([]);
});
