// Turns the `::::tabs` blocks of integrations/directives.mjs into tab lists. Without JavaScript
// every tab shows under its label. Tabs with the same `data-sync` switch together across the
// page, and the choice is kept for the next page.
const groups = [...document.querySelectorAll<HTMLElement>('.dl-tabs')];
const storageKey = (sync: string) => `devlanes-tabs:${sync}`;

const panelsOf = (group: HTMLElement) =>
  [...group.children].filter((child): child is HTMLElement => child.matches('.dl-tab'));
const tabsOf = (group: HTMLElement) => [
  ...group.querySelectorAll<HTMLElement>(':scope > [role="tablist"] > [role="tab"]')
];

function read(sync: string) {
  try {
    return localStorage.getItem(storageKey(sync));
  } catch {
    return null;
  }
}

function store(sync: string, label: string) {
  try {
    localStorage.setItem(storageKey(sync), label);
  } catch {
    // Private windows may refuse storage; the choice then lasts for this page only.
  }
}

/** Shows the tab with `label` in `group`; false when the group has no such tab. */
function show(group: HTMLElement, label: string) {
  const panels = panelsOf(group);
  if (!panels.some((panel) => panel.dataset.label === label)) return false;
  const tabs = tabsOf(group);
  panels.forEach((panel, index) => {
    const selected = panel.dataset.label === label;
    panel.hidden = !selected;
    tabs[index]?.setAttribute('aria-selected', String(selected));
    if (tabs[index]) tabs[index].tabIndex = selected ? 0 : -1;
  });
  return true;
}

/** Selects a tab, in every group with the same sync key, keeping the clicked tab in place. */
function choose(group: HTMLElement, label: string, anchor: HTMLElement) {
  const before = anchor.getBoundingClientRect().top;
  const sync = group.dataset.sync;
  if (sync) {
    store(sync, label);
    for (const other of groups) if (other.dataset.sync === sync) show(other, label);
  } else {
    show(group, label);
  }
  const shift = anchor.getBoundingClientRect().top - before;
  if (shift) window.scrollBy(0, shift);
}

let count = 0;
for (const group of groups) {
  const panels = panelsOf(group);
  const list = document.createElement('div');
  list.setAttribute('role', 'tablist');
  for (const panel of panels) {
    count += 1;
    const label = panel.dataset.label ?? '';
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.id = `dl-tab-${count}`;
    tab.setAttribute('role', 'tab');
    tab.textContent = label;
    panel.id = `dl-tab-panel-${count}`;
    tab.setAttribute('aria-controls', panel.id);
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tab.id);
    panel.tabIndex = 0;
    tab.addEventListener('click', () => choose(group, label, tab));
    list.append(tab);
  }
  list.addEventListener('keydown', (event) => {
    const tabs = tabsOf(group);
    const current = tabs.indexOf(document.activeElement as HTMLElement);
    if (current < 0) return;
    const moves: Record<string, number> = {
      ArrowRight: current + 1,
      ArrowLeft: current - 1,
      Home: 0,
      End: tabs.length - 1
    };
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    const tab = tabs[(next + tabs.length) % tabs.length];
    if (!tab) return;
    tab.focus();
    tab.click();
  });
  group.prepend(list);
  group.classList.add('is-ready');
  const stored = group.dataset.sync ? read(group.dataset.sync) : null;
  if (!stored || !show(group, stored)) show(group, panels[0]?.dataset.label ?? '');
}
