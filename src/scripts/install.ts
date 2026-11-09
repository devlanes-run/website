// Each control on the page keeps its own selection.
for (const installer of document.querySelectorAll<HTMLElement>('.install')) {
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
  let os = detected;

  const offered = (button: HTMLButtonElement) =>
    (button.dataset.systems ?? '').split(' ').includes(os);

  function selectMethod(method: string) {
    for (const button of methods)
      button.setAttribute('aria-pressed', String(button.dataset.method === method));
    for (const panel of panels) panel.hidden = panel.dataset.installPanel !== method;
    if (status) status.textContent = '';
  }

  function showMethods() {
    for (const button of platforms)
      button.setAttribute('aria-pressed', String(button.dataset.os === os));
    for (const button of methods) button.hidden = !offered(button);
    // The markup lists each system's preferred method first.
    const available = methods.filter(offered);
    const preferred = available.find((button) => button.dataset.systems?.startsWith(os));
    selectMethod((preferred ?? available[0])?.dataset.method ?? 'npm');
  }

  for (const button of platforms)
    button.addEventListener('click', () => {
      os = button.dataset.os ?? 'macos';
      showMethods();
    });
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
  showMethods();
  installer.dataset.enhanced = 'true';
  const controls = installer.querySelector<HTMLElement>('.install-controls');
  if (controls) controls.hidden = false;
}
