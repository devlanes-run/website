const themeButton = document.querySelector<HTMLButtonElement>('#theme');
if (themeButton) {
  themeButton.hidden = false;
  const sync = () => {
    const dark = document.documentElement.dataset.theme === 'dark';
    const label = dark ? 'Switch to light theme' : 'Switch to dark theme';
    themeButton.setAttribute('aria-label', label);
    themeButton.title = label;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', dark ? '#22211e' : '#f2f2ef');
  };
  sync();
  themeButton.addEventListener('click', () => {
    const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('theme', theme);
    } catch {
      /* Theme still works when storage is unavailable. */
    }
    sync();
  });
}

const controls = document.querySelectorAll<HTMLButtonElement>('[data-scene]');
for (const button of controls) {
  button.addEventListener('click', () => {
    for (const control of controls)
      control.setAttribute('aria-pressed', String(control === button));
    for (const scene of document.querySelectorAll<HTMLElement>('.scene'))
      scene.hidden = scene.id !== `scene-${button.dataset.scene}`;
  });
  button.hidden = false;
}
const sceneControls = document.querySelector<HTMLElement>('.scene-controls');
if (sceneControls) sceneControls.hidden = false;
