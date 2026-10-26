import { expect, test } from '@playwright/test';

const systems = [
  {
    platform: 'macOS',
    method: '#install-brew',
    shown: ['Homebrew', 'Shell script', 'npm', 'uv', 'cargo binstall'],
    hidden: ['PowerShell']
  },
  {
    platform: 'Linux',
    method: '#install-script',
    shown: ['Homebrew', 'Shell script', 'npm', 'uv', 'cargo binstall'],
    hidden: ['PowerShell']
  },
  {
    platform: 'Windows',
    method: '#install-powershell',
    shown: ['PowerShell', 'npm', 'uv', 'cargo binstall'],
    hidden: ['Homebrew', 'Shell script']
  }
];

for (const { platform, method, shown, hidden } of systems) {
  test(`detects ${platform} and offers only its install methods`, async ({ page }) => {
    await page.addInitScript((platform) => {
      Object.defineProperty(navigator, 'userAgentData', { value: { platform } });
    }, platform);
    await page.goto('/');
    await expect(page.getByRole('button', { name: platform, exact: true })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(page.locator(method)).toBeVisible();
    const methods = page.getByRole('group', { name: 'Install method' });
    for (const name of shown)
      await expect(methods.getByRole('button', { name, exact: true })).toBeVisible();
    for (const name of hidden)
      await expect(methods.getByRole('button', { name, exact: true })).toBeHidden();
  });
}

test('switches the install scripts to next builds', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await page.getByRole('button', { name: 'Linux', exact: true }).click();
  const methods = page.getByRole('group', { name: 'Install method' });
  // The switch is offered whichever method is selected.
  await methods.getByRole('button', { name: 'npm', exact: true }).click();
  await page.getByRole('button', { name: 'Switch to next builds' }).click();

  // Package managers only install releases, so only the script remains.
  const next = 'curl -fsSL https://devlanes.run/install.sh | sh -s -- --channel next';
  await expect(page.locator('#install-script code')).toHaveText(next);
  for (const name of ['Homebrew', 'npm', 'uv', 'cargo binstall'])
    await expect(methods.getByRole('button', { name, exact: true })).toBeHidden();
  await page.getByRole('button', { name: 'Copy Shell script install command' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(next);

  await page.getByRole('button', { name: 'Windows', exact: true }).click();
  await expect(page.locator('#install-powershell code')).toHaveText(
    'iex "& {$(irm https://devlanes.run/install.ps1)} -Channel next"'
  );
  for (const name of ['npm', 'uv', 'cargo binstall'])
    await expect(methods.getByRole('button', { name, exact: true })).toBeHidden();

  await page.getByRole('button', { name: 'Switch to stable releases' }).click();
  await expect(page.locator('#install-powershell code')).toHaveText(
    'irm https://devlanes.run/install.ps1 | iex'
  );
  for (const name of ['PowerShell', 'npm', 'uv', 'cargo binstall'])
    await expect(methods.getByRole('button', { name, exact: true })).toBeVisible();
});

test('switching to Windows shows the PowerShell installer', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Windows', exact: true }).click();
  await expect(page.locator('#install-powershell')).toContainText(
    'irm https://devlanes.run/install.ps1 | iex'
  );
  await expect(page.locator('#install-powershell .install-prompt')).toHaveText('PS>');
  await page.getByRole('button', { name: 'macOS', exact: true }).click();
  await expect(page.locator('#install-brew')).toBeVisible();
});

test('switches install methods and copies only the selected command', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  // Playwright's desktop Chrome profile reports Windows, so pick a system explicitly.
  await page.getByRole('button', { name: 'Linux', exact: true }).click();
  await page.getByRole('button', { name: 'npm', exact: true }).click();
  await expect(page.locator('#install-npm')).toBeVisible();
  await page.getByRole('button', { name: 'Copy npm install command' }).click();
  await expect(page.getByRole('status')).toHaveText('Command copied.');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('npm install -g devlanes');
  await page.getByRole('button', { name: 'uv', exact: true }).click();
  await expect(page.locator('#install-uv')).toBeVisible();
  await expect(page.locator('#install-npm')).toBeHidden();
  await page.getByRole('button', { name: 'Copy uv install command' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    'uv tool install devlanes'
  );
  await page.getByRole('button', { name: 'cargo binstall', exact: true }).click();
  await expect(page.locator('#install-cargo')).toContainText(
    'cargo binstall --git https://github.com/devlanes-run/devlanes devlanes'
  );
  await expect(page.locator('#install-npm')).toBeHidden();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole('button', { name: 'Shell script', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
