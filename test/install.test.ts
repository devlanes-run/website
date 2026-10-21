import { expect, test } from '@playwright/test';

for (const platform of ['macOS', 'Linux']) {
  test(`detects ${platform} and selects its default install method`, async ({ page }) => {
    await page.addInitScript((platform) => {
      Object.defineProperty(navigator, 'userAgentData', { value: { platform } });
    }, platform);
    await page.goto('/');
    await expect(page.getByRole('button', { name: platform, exact: true })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(
      page.locator(platform === 'macOS' ? '#install-brew' : '#install-script')
    ).toBeVisible();
    await page
      .getByRole('button', { name: platform === 'macOS' ? 'Linux' : 'macOS', exact: true })
      .click();
    await expect(
      page.locator(platform === 'macOS' ? '#install-script' : '#install-brew')
    ).toBeVisible();
  });
}

test('switches install methods and copies only the selected command', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await page.getByRole('button', { name: 'npm', exact: true }).click();
  await expect(page.locator('#install-npm')).toBeVisible();
  await page.getByRole('button', { name: 'Copy npm install command' }).click();
  await expect(page.getByRole('status')).toHaveText('Command copied.');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('npm install -g devlanes');
  await page.getByRole('button', { name: 'cargo binstall', exact: true }).click();
  await expect(page.locator('#install-cargo')).toContainText(
    'cargo binstall --git https://github.com/devlanes-run/devlanes devlanes'
  );
  await expect(page.locator('#install-npm')).toBeHidden();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole('button', { name: 'Shell script', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
