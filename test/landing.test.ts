import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://metrics.arthur.one/**', (route) => route.fulfill({ body: '' }));
});

test('product content, themes and anchors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Run every worktree at once, each on its own localhost.'
  );
  await expect(page.locator('.hero')).toContainText('Stop fighting over port 3000.');
  await expect(page.locator('.hero strong')).toHaveCount(0);
  await expect(page.locator('.sign-facts')).toContainText('open source');
  await expect(page.getByRole('note')).toContainText('not ready for production use');
  await expect(page.locator('.site-header #motion')).toHaveCount(0);
  await expect(page.locator('#theme svg')).toHaveCount(2);
  await expect(page.locator('.github-link svg')).toHaveCount(1);
  // The sign holds the road scene and the install control; a second control ends the page.
  await expect(page.locator('.sign [data-road-scene]')).toHaveCount(1);
  await expect(page.locator('.hero #install')).toHaveCount(1);
  await expect(page.locator('.closing #install-again')).toHaveCount(1);
  await expect(page.locator('.closing #install-again-npm')).toContainText('npm install -g');
  // Every fold links to its own page.
  for (const [id, href] of [
    ['lanes', '/lanes/'],
    ['remote', '/remote/'],
    ['agents', '/agents/']
  ] as const) {
    await expect(page.locator(`#${id} a.more`)).toHaveAttribute('href', href);
  }
  await expect(page.locator('.lane-table')).toContainText('https://myapp1.localhost');
  await expect(page.locator('body')).not.toContainText('myapp-1.localhost');
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

test('feature pages share the layout and link back', async ({ page }) => {
  for (const [path, title] of [
    ['/lanes/', 'Lanes'],
    ['/remote/', 'Remote boxes'],
    ['/agents/', 'Coding agents']
  ] as const) {
    await page.goto(path);
    await expect(page).toHaveTitle(`${title} | devlanes`);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `https://devlanes.run${path}`
    );
    await expect(page.locator('.site-header nav a[aria-current="page"]')).toHaveAttribute(
      'href',
      path
    );
    await expect(page.locator('.sign')).toHaveCount(0);
    await expect(page.locator('#install')).toHaveCount(1);
  }
});

test('motion pauses and honours reduced motion', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'running');
  await page.locator('#motion').click();
  await expect(page.locator('#motion')).toHaveText('Play motion');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'paused');
  await page.locator('#motion').click();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'running');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('#motion')).toHaveText('Play motion');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'paused');
});

test('mobile has no page-wide overflow and remains usable without JavaScript', async ({
  browser,
  page
}) => {
  for (const path of ['/', '/lanes/', '/remote/', '/agents/']) {
    await page.setViewportSize({ width: 320, height: 812 });
    await page.goto(path);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
  }
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  const context = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await context.newPage();
  await staticPage.goto('http://127.0.0.1:4321/');
  await expect(staticPage.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(staticPage.locator('#install-npm')).toContainText('npm install -g devlanes');
  await expect(staticPage.locator('[data-tui-static]')).toBeVisible();
  await expect(staticPage.locator('#motion')).toBeHidden();
  await context.close();
});
