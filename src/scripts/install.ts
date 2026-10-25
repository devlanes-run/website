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

  const channel = installer.querySelector<HTMLButtonElement>('.install-channel');
  let next = false;

  function selectMethod(method: string) {
    for (const button of methods)
      button.setAttribute('aria-pressed', String(button.dataset.method === method));
    for (const panel of panels) panel.hidden = panel.dataset.installPanel !== method;
    if (status) status.textContent = '';
    // Only the install scripts have a next channel; package managers stay on releases.
    const panel = installer?.querySelector(`[data-install-panel="${method}"] code[data-next]`);
    if (channel) channel.hidden = !panel;
  }

  function setChannel(useNext: boolean) {
    next = useNext;
    for (const code of installer?.querySelectorAll<HTMLElement>('code[data-next]') ?? []) {
      code.textContent = (next ? code.dataset.next : code.dataset.stable) ?? code.textContent;
    }
    if (channel) {
      channel.textContent = next ? 'Switch to stable releases' : 'Switch to next builds';
      channel.setAttribute('aria-pressed', String(next));
    }
    if (status) status.textContent = next ? 'Showing the latest build of main.' : '';
  }

  channel?.addEventListener('click', () => setChannel(!next));

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
