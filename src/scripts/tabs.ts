for (const list of document.querySelectorAll<HTMLElement>('[data-tab-list]')) {
  const buttons = [...list.querySelectorAll<HTMLButtonElement>('[data-tab]')];
  const panels = buttons
    .map((button) => document.getElementById(button.dataset.tab ?? ''))
    .filter((panel): panel is HTMLElement => panel !== null);
  for (const button of buttons) {
    button.addEventListener('click', () => {
      for (const other of buttons) other.setAttribute('aria-pressed', String(other === button));
      for (const panel of panels) panel.hidden = panel.id !== button.dataset.tab;
    });
  }
  list.hidden = false;
}
