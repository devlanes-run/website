import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://metrics.arthur.one/**', (route) => route.fulfill({ body: '' }));
});

test('docs share the landing header, analytics and theme preference', async ({ page }) => {
  await page.goto('/');
  await page.locator('#theme').click();
  const theme = await page.locator('html').getAttribute('data-theme');

  await page.getByRole('link', { name: 'Docs', exact: true }).click();
  await expect(page).toHaveURL(/\/docs\/$/);
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme ?? 'dark');
  await expect(page.locator('h1#_top')).toBeVisible();
  await expect(page.getByRole('note')).toContainText('not ready for production use');
  // The fixed frame must leave room for the banner, so the title is not covered.
  const banner = await page.locator('.beta-banner').boundingBox();
  const header = await page.locator('.page > header.header').boundingBox();
  const title = await page.locator('h1#_top').boundingBox();
  expect(title?.y).toBeGreaterThan((header?.y ?? 0) + (header?.height ?? 0));
  expect(banner?.width).toBe(page.viewportSize()?.width);
  await expect(page.locator('.site-header nav a[aria-current="page"]')).toHaveText('Docs');
  await expect(
    page.locator('script[src="https://metrics.arthur.one/js/pa-3pDH1YhCzpfClRVGg57Ha.js"]')
  ).toHaveCount(1);
  await expect(page.locator('link[rel="alternate"][type="text/markdown"]')).toHaveAttribute(
    'href',
    '/docs.md'
  );

  await expect(page.locator('.site-header')).toHaveCSS('font-family', /JetBrains Mono/);
  await expect(page.locator('.sl-markdown-content p').first()).toHaveCSS('font-family', /Overpass/);
});

test('every docs page in the sidebar renders with a Markdown twin', async ({ page, request }) => {
  await page.goto('/docs/');
  const links = await page
    .locator('#starlight__sidebar a[href^="/docs/"]')
    .evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute('href') ?? ''));
  expect(links.length).toBeGreaterThan(1);
  for (const link of links) {
    const markdown = await request.get(`${link.replace(/\/$/, '')}.md`);
    expect(markdown.ok(), link).toBe(true);
    expect(await markdown.text()).toMatch(/^---\ntitle: /);
  }
  const llms = await (await request.get('/llms.txt')).text();
  for (const link of links) expect(llms).toContain(`(${link.replace(/\/$/, '')}.md)`);
  expect(llms).toContain('(/index.md)');
});

test('page actions copy the Markdown twin and prompt assistants with its URL', async ({
  page,
  context
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/docs/');
  const actions = page.locator('.page-actions');
  await expect(actions.getByRole('link', { name: 'View Markdown' })).toHaveAttribute(
    'href',
    '/docs.md'
  );
  await actions.getByRole('button', { name: 'Copy Markdown' }).click();
  await expect(actions.getByRole('button')).toHaveText('Copied');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/^---\ntitle: /);
  const prompt = encodeURIComponent('Read https://devlanes.run/docs.md');
  await expect(actions.getByRole('link', { name: 'Ask Claude' })).toHaveAttribute(
    'href',
    new RegExp(`^https://claude\\.ai/new\\?q=${prompt}`)
  );
});

test('search finds docs content', async ({ page }) => {
  await page.goto('/docs/');
  await page.getByRole('button', { name: 'Search' }).click();
  await page.getByRole('dialog', { name: 'Search' }).getByRole('textbox').fill('worktree');
  await expect(page.locator('.pagefind-ui__result').first()).toBeVisible();
});

test('docs fit narrow screens and open the sidebar from the menu', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/docs/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.locator('#starlight__sidebar a[href="/docs/"]')).toBeVisible();
});
