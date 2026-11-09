import { expect, test } from '@playwright/test';

// The landing page has two controls, the hero's and the closing's; the tests drive the first.
const control = '#install';

const systems = [
  {
    platform: 'macOS',
    method: '#install-brew',
    shown: ['Homebrew', 'Shell script', 'npm', 'uv', 'cargo binstall'],
    hidden: ['PowerShell', 'WSL']
  },
  {
    platform: 'Linux',
    method: '#install-script',
    shown: ['Homebrew', 'Shell script', 'npm', 'uv', 'cargo binstall'],
    hidden: ['PowerShell', 'WSL']
  },
  {
    platform: 'Windows',
    method: '#install-powershell',
    shown: ['PowerShell', 'WSL', 'npm', 'uv', 'cargo binstall'],
    hidden: ['Homebrew', 'Shell script']
  }
];

for (const { platform, method, shown, hidden } of systems) {
  test(`detects ${platform} and offers only its install methods`, async ({ page }) => {
    await page.addInitScript((platform) => {
      Object.defineProperty(navigator, 'userAgentData', { value: { platform } });
    }, platform);
    await page.goto('/');
    await expect(
      page.locator(control).getByRole('button', { name: platform, exact: true })
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator(method)).toBeVisible();
    const methods = page.locator(control).getByRole('group', { name: 'Install method' });
    for (const name of shown)
      await expect(methods.getByRole('button', { name, exact: true })).toBeVisible();
    for (const name of hidden)
      await expect(methods.getByRole('button', { name, exact: true })).toBeHidden();
  });
}

test('switching to Windows shows the PowerShell installer', async ({ page }) => {
  await page.goto('/');
  await page.locator(control).getByRole('button', { name: 'Windows', exact: true }).click();
  await expect(page.locator('#install-powershell')).toContainText(
    'irm https://devlanes.run/install.ps1 | iex'
  );
  await expect(page.locator('#install-powershell .install-prompt')).toHaveText('PS>');
  await page.locator(control).getByRole('button', { name: 'macOS', exact: true }).click();
  await expect(page.locator('#install-brew')).toBeVisible();
});

test('switches install methods and copies only the selected command', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  // Playwright's desktop Chrome profile reports Windows, so pick a system explicitly.
  await page.locator(control).getByRole('button', { name: 'Linux', exact: true }).click();
  await page.locator(control).getByRole('button', { name: 'npm', exact: true }).click();
  await expect(page.locator('#install-npm')).toBeVisible();
  await page.locator(control).getByRole('button', { name: 'Copy npm install command' }).click();
  await expect(page.locator(control).getByRole('status')).toHaveText('Command copied.');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('npm install -g devlanes');
  await page.locator(control).getByRole('button', { name: 'uv', exact: true }).click();
  await expect(page.locator('#install-uv')).toBeVisible();
  await expect(page.locator('#install-npm')).toBeHidden();
  await page.locator(control).getByRole('button', { name: 'Copy uv install command' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    'uv tool install devlanes'
  );
  await page.locator(control).getByRole('button', { name: 'cargo binstall', exact: true }).click();
  await expect(page.locator('#install-cargo')).toContainText(
    'cargo binstall --git https://github.com/devlanes-run/devlanes devlanes'
  );
  await expect(page.locator('#install-npm')).toBeHidden();
  // Phones hide the hero's control and keep the one at the end of the page.
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.locator(control)).toBeHidden();
  const closing = page.locator('#install-again');
  await closing.getByRole('button', { name: 'Linux', exact: true }).click();
  await closing.getByRole('button', { name: 'Shell script', exact: true }).click();
  await expect(page.locator('#install-again-script')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
