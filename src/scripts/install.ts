const installer = document.querySelector<HTMLElement>('#install');
if (installer) {
  const platforms = installer.querySelectorAll<HTMLButtonElement>('[data-os]');
  const methods = [...installer.querySelectorAll<HTMLButtonElement>('[data-method]')];
  const panels = installer.querySelectorAll<HTMLElement>('[data-install-panel]');
  const status = installer.querySelector<HTMLElement>('.install-status');
  const browser = navigator as Navigator & { userAgentData?: { platform?: string } };
  const platform = browser.userAgentData?.platform ?? navigator.platform;
  const detected = /^win/i.test(platform)
    ? 'windows'
    : /linux/i.test(platform) && !/android/i.test(navigator.userAgent)
      ? 'linux'
      : 'macos';
  const supports = (button: HTMLButtonElement, os: string) =>
    (button.dataset.systems ?? '').split(' ').includes(os);

  function selectMethod(method: string) {
    for (const button of methods)
      button.setAttribute('aria-pressed', String(button.dataset.method === method));
    for (const panel of panels) panel.hidden = panel.dataset.installPanel !== method;
    if (status) status.textContent = '';
  }

  function selectPlatform(os: string) {
    for (const button of platforms)
      button.setAttribute('aria-pressed', String(button.dataset.os === os));
    for (const button of methods) button.hidden = !supports(button, os);
    // The markup lists each system's preferred method first.
    const preferred = methods.find(
      (button) => supports(button, os) && button.dataset.systems?.startsWith(os)
    );
    const fallback = methods.find((button) => supports(button, os));
    selectMethod((preferred ?? fallback)?.dataset.method ?? 'npm');
  }

  for (const button of platforms)
    button.addEventListener('click', () => selectPlatform(button.dataset.os ?? 'macos'));
  for (const button of methods)
    button.addEventListener('click', () => selectMethod(button.dataset.method ?? 'npm'));
  for (const button of installer.querySelectorAll<HTMLButtonElement>('.install-copy')) {
    button.hidden = false;
    button.addEventListener('click', async () => {
      const command = button.closest('.install-command')?.querySelector('code')?.textContent;
      if (!command) return;
      try {
        await navigator.clipboard.writeText(command);
        if (status) status.textContent = 'Command copied.';
      } catch {
        if (status) status.textContent = 'Select the command to copy it.';
      }
    });
  }

  selectPlatform(detected);
  installer.dataset.enhanced = 'true';
  const controls = installer.querySelector<HTMLElement>('.install-controls');
  if (controls) controls.hidden = false;
}
