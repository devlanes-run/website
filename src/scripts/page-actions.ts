for (const button of document.querySelectorAll<HTMLButtonElement>('[data-copy-markdown]')) {
  const label = button.querySelector('span');
  // Copying needs JavaScript; without it the "View Markdown" link remains.
  button.hidden = false;
  button.addEventListener('click', async () => {
    const url = button.dataset.copyMarkdown;
    if (!url || !label) return;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await navigator.clipboard.writeText(await response.text());
      label.textContent = 'Copied';
    } catch {
      label.textContent = 'Copy failed';
    }
    setTimeout(() => {
      label.textContent = 'Copy Markdown';
    }, 2000);
  });
}
