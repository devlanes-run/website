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
