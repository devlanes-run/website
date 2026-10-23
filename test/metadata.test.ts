import { expect, test } from '@playwright/test';

test('generated crawler documents and assets are available', async ({ request }) => {
  const markdown = await request.get('/index.md');
  expect(markdown.ok()).toBe(true);
  const content = await markdown.text();
  expect(content).toContain('Sandboxes for your agents. localhost for you.');
  expect(content).not.toContain('not ready to use');
  expect(content).toContain('npm install -g devlanes');
  expect(content).toContain('same checkout');
  expect(content).not.toContain('astro-slop: fetch');
  const llms = await request.get('/llms.txt');
  expect(await llms.text()).toContain('/index.md');
  const full = await request.get('/llms-full.txt');
  expect(await full.text()).toContain('security boundary');
  const sitemap = await request.get('/sitemap-0.xml');
  const urls = await sitemap.text();
  expect(urls).toContain('https://devlanes.run/');
  expect(urls).toContain('https://devlanes.run/docs/');
  const robots = await request.get('/robots.txt');
  expect(await robots.text()).toContain('Allow: /');
  expect((await request.get('/icons/1-stagger/favicon.svg')).status()).toBe(404);
  for (const path of [
    '/assets/logo-badge-square.svg',
    '/assets/logo-badge-square.png',
    '/assets/fileicon.svg',
    '/assets/favicon-universal.png'
  ]) {
    expect((await request.get(path)).ok(), path).toBe(true);
  }
});

test('social metadata, structured data and analytics are emitted', async ({ page }) => {
  await page.route('https://metrics.arthur.one/**', (route) => route.fulfill({ body: '' }));
  await page.goto('/');
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    'https://devlanes.run/social.png'
  );
  await expect(page.locator('link[rel="alternate"][type="text/markdown"]')).toHaveAttribute(
    'href',
    '/index.md'
  );
  const json = await page.locator('script[type="application/ld+json"]').textContent();
  const data = JSON.parse(json ?? '{}');
  expect(data['@graph'].map((node: { '@type': string }) => node['@type'])).toEqual([
    'WebSite',
    'SoftwareApplication'
  ]);
  await expect(
    page.locator('script[src="https://metrics.arthur.one/js/pa-3pDH1YhCzpfClRVGg57Ha.js"]')
  ).toHaveAttribute('async', '');
});
