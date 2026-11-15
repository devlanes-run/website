// Search and filters of the examples index. Everything is in the page already: each example is
// an element carrying its facets and search text, and this hides, counts and orders them. The
// state lives in the URL, so a filtered list can be linked.

type Facet = 'category' | 'language' | 'stack' | 'feature';
const facetNames: Facet[] = ['category', 'language', 'stack', 'feature'];

interface Item {
  element: HTMLElement;
  order: number;
  title: string;
  text: string;
  terms: string[];
  facets: Record<Facet, string[]>;
}

type State = { query: string } & Record<Facet, string[]>;

const words = (value: string | undefined) => (value ?? '').split(' ').filter(Boolean);
const tokens = (value: string) =>
  value
    .toLowerCase()
    .split(/[^\p{L}\p{N}_.<>:-]+/u)
    .filter(Boolean);

/**
 * How well an item answers the query, or 0 when a word of it matches nothing. A word counts
 * most at the start of a word in the title, then as a tool or feature, then in the description.
 */
function score(item: Item, query: string[]) {
  let total = 0;
  for (const typed of query) {
    // Without a plural's `s`, so "monorepos" finds "monorepo" and the other way round.
    const word = typed.length > 3 ? typed.replace(/s$/, '') : typed;
    let best = 0;
    if (item.title.split(/\s+/).some((part) => part.startsWith(word))) best = 8;
    else if (item.title.includes(word)) best = 5;
    if (item.terms.some((term) => term === typed || term === word)) best = Math.max(best, 6);
    else if (item.terms.some((term) => term.includes(word))) best = Math.max(best, 4);
    if (!best && item.text.includes(word)) best = 1;
    if (!best) return 0;
    total += best;
  }
  return total;
}

function filterExamples(root: HTMLElement) {
  const single = new Set(words(root.dataset.single));
  const items: Item[] = [...root.querySelectorAll<HTMLElement>('[data-example]')].map(
    (element, order) => ({
      element,
      order,
      title: (element.dataset.title ?? '').toLowerCase(),
      text: (element.dataset.text ?? '').toLowerCase(),
      terms: tokens(element.dataset.terms ?? ''),
      facets: {
        category: words(element.dataset.category),
        language: words(element.dataset.language),
        stack: words(element.dataset.stack),
        feature: words(element.dataset.feature)
      }
    })
  );
  const search = root.querySelector<HTMLInputElement>('[data-examples-search]');
  const controls = [...root.querySelectorAll<HTMLElement>('[data-facet][data-value]')];
  const count = root.querySelector<HTMLElement>('[data-examples-count]');
  const clear = root.querySelector<HTMLElement>('[data-examples-clear]');
  const empty = root.querySelector<HTMLElement>('[data-examples-empty]');
  const groups = [...root.querySelectorAll<HTMLElement>('[data-examples-group]')];

  const params = new URLSearchParams(location.search);
  const state: State = {
    query: params.get('q') ?? '',
    category: words(params.get('category')?.replaceAll(',', ' ')),
    language: words(params.get('language')?.replaceAll(',', ' ')),
    stack: words(params.get('stack')?.replaceAll(',', ' ')),
    feature: words(params.get('feature')?.replaceAll(',', ' '))
  };

  const matches = (item: Item, selected: Record<Facet, string[]>) =>
    facetNames.every((facet) =>
      selected[facet].every((value) => item.facets[facet].includes(value))
    );

  /** The selection as it would be after pressing a control. */
  const pressed = (facet: Facet, value: string) => {
    const current = state[facet];
    if (current.includes(value)) return current;
    return single.has(facet) ? [value] : [...current, value];
  };

  function render() {
    const query = tokens(state.query);
    const scored = items.map((item) => ({ item, points: query.length ? score(item, query) : 1 }));
    const inQuery = scored.filter(({ points }) => points > 0);
    const shown = inQuery.filter(({ item }) => matches(item, state));

    for (const { item } of scored) item.element.hidden = true;
    // Best answer first while searching; the catalogue's order otherwise.
    const ordered = [...shown].sort((a, b) =>
      query.length
        ? b.points - a.points || a.item.order - b.item.order
        : a.item.order - b.item.order
    );
    for (const { item } of ordered) {
      item.element.hidden = false;
      item.element.parentElement?.append(item.element);
      for (const chip of item.element.querySelectorAll<HTMLElement>('[data-group]')) {
        const text = chip.textContent?.toLowerCase() ?? '';
        const hit =
          state.feature.includes(chip.dataset.group ?? '') ||
          query.some((word) => text.includes(word));
        chip.toggleAttribute('data-hit', hit);
      }
    }

    for (const control of controls) {
      const facet = control.dataset.facet as Facet;
      const value = control.dataset.value ?? '';
      const on = state[facet].includes(value);
      const would = inQuery.filter(({ item }) =>
        matches(item, { ...state, [facet]: pressed(facet, value) })
      ).length;
      control.setAttribute('aria-pressed', String(on));
      control.toggleAttribute('data-none', would === 0 && !on);
      const number = control.querySelector('[data-facet-count]');
      if (number) number.textContent = String(would);
    }

    for (const group of groups) {
      group.hidden = !group.querySelector('[data-example]:not([hidden])');
    }
    const filtered = Boolean(query.length || facetNames.some((facet) => state[facet].length));
    if (count) {
      const noun = items.length === 1 ? 'example' : 'examples';
      count.textContent = filtered
        ? `${shown.length} of ${items.length} ${noun}`
        : `${items.length} ${noun}`;
    }
    if (clear) clear.hidden = !filtered;
    if (empty) empty.hidden = shown.length > 0;

    const next = new URLSearchParams();
    if (state.query.trim()) next.set('q', state.query.trim());
    for (const facet of facetNames)
      if (state[facet].length) next.set(facet, state[facet].join(','));
    const url = `${location.pathname}${next.size ? `?${next}` : ''}${location.hash}`;
    history.replaceState(null, '', url);
  }

  for (const control of controls) {
    control.addEventListener('click', () => {
      const facet = control.dataset.facet as Facet;
      const value = control.dataset.value ?? '';
      state[facet] = state[facet].includes(value)
        ? state[facet].filter((item) => item !== value)
        : pressed(facet, value);
      render();
    });
  }
  if (search) {
    search.value = state.query;
    search.addEventListener('input', () => {
      state.query = search.value;
      render();
    });
    search.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || !search.value) return;
      search.value = '';
      state.query = '';
      render();
    });
    document.addEventListener('keydown', (event) => {
      const target = event.target as HTMLElement | null;
      if (event.key !== '/' || target?.closest('input, textarea, [contenteditable]')) return;
      event.preventDefault();
      search.focus();
    });
  }
  clear?.addEventListener('click', () => {
    state.query = '';
    for (const facet of facetNames) state[facet] = [];
    if (search) search.value = '';
    render();
  });
  // Phones keep the filters closed until asked for (see _examples.scss).
  const toggle = root.querySelector<HTMLElement>('[data-examples-toggle]');
  toggle?.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    toggle.closest('.examples-filters')?.toggleAttribute('data-open', open);
  });

  root.dataset.ready = '';
  render();
}

for (const root of document.querySelectorAll<HTMLElement>('[data-examples]')) filterExamples(root);
