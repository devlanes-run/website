import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://metrics.arthur.one/**', (route) => route.fulfill({ body: '' }));
});

test('product content, themes and agent examples', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Sandboxes for your agents. localhost for you.'
  );
  await expect(page.locator('.announcement')).toHaveCount(0);
  await expect(page.locator('.preview-label')).toHaveCount(0);
  await expect(page.locator('.site-header #motion')).toHaveCount(0);
  await expect(page.locator('#theme svg')).toHaveCount(2);
  await expect(page.locator('.github-link svg')).toHaveCount(1);
  await page.getByRole('button', { name: 'Read the logs' }).click();
  await expect(page.locator('#scene-1')).toBeVisible();
  await expect(page.locator('#scene-0')).toBeHidden();
  await page.getByRole('button', { name: 'Clean up', exact: true }).click();
  await expect(page.locator('#scene-2')).toContainText('Main is still running');
  await page.locator('#theme').click();
  const theme = await page.locator('html').getAttribute('data-theme');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme ?? 'dark');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://devlanes.run/'
  );
  for (const href of await page
    .locator('a[href^="#"]')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')))) {
    expect(href).not.toBe('#');
    await expect(page.locator(href ?? '')).toHaveCount(1);
  }
  expect(errors).toEqual([]);
});

test('traffic alignment, pause, parallax and reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  const vehicle = page.locator('.vehicle').nth(1);
  await expect(vehicle).toHaveAttribute('style', /translateY/);
  const initial = await vehicle.getAttribute('style');
  await expect.poll(() => vehicle.getAttribute('style')).not.toBe(initial);
  await page.locator('#motion').click();
  const paused = await vehicle.getAttribute('style');
  await page.waitForTimeout(150);
  expect(await vehicle.getAttribute('style')).toBe(paused);
  await page.locator('#motion').click();
  await page.evaluate(() => window.scrollTo(0, 600));
  await expect
    .poll(() =>
      page
        .locator('[data-road]')
        .evaluate((el) => (el as HTMLElement).style.getPropertyValue('--road-scroll'))
    )
    .toBe('-44px');
  for (const width of [390, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect
      .poll(() =>
        page.locator('.vehicle').evaluateAll((vehicles) => {
          const lane = Number.parseFloat(
            getComputedStyle(document.documentElement).getPropertyValue('--lane-width')
          );
          return vehicles.every((el) => {
            const rect = el.getBoundingClientRect();
            const offset = Math.abs(
              rect.left + rect.width / 2 - document.documentElement.clientWidth / 2
            );
            return Math.abs((offset % lane) - lane / 2) < 1;
          });
        })
      )
      .toBe(true);
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('#motion')).toHaveText('Play motion');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'paused');
});

test('mobile has no page-wide overflow and remains usable without JavaScript', async ({
  browser,
  page
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  const context = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await context.newPage();
  await staticPage.goto('http://127.0.0.1:4321/');
  await expect(staticPage.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(
    staticPage.getByRole('link', { name: 'Read the docs', exact: true })
  ).toHaveAttribute('href', 'https://github.com/devlanes-run/devlanes/tree/main/docs');
  await expect(staticPage.locator('#install-npm')).toContainText('npm install -g devlanes');
  await expect(staticPage.locator('#scene-0')).toBeVisible();
  await expect(staticPage.locator('#motion')).toBeHidden();
  await context.close();
});
