// Groups of the docs sidebar and of llms.txt, in order. Items are entry ids, which are also the
// page paths; `dir/*` takes the pages under `dir/` that no item names, by sidebar order. A label
// on an item renames it in the sidebar only. Pages no group takes join the last group, so a page
// added in the source repository shows up before it is filed here.
export const docsGroups = [
  {
    label: 'Introduction',
    items: [{ id: 'docs', label: 'Overview' }, 'docs/getting-started']
  },
  {
    label: 'Guides',
    items: [
      'docs/guides/run-scripts',
      'docs/guides/languages',
      'docs/guides/presets',
      'docs/guides/ports-and-env',
      'docs/guides/https',
      'docs/guides/infra',
      'docs/guides/services',
      'docs/guides/lifecycle',
      'docs/guides/terminals',
      'docs/guides/updates'
    ]
  },
  {
    label: 'Remote',
    items: [
      'docs/remote',
      'docs/guides/remote-setup',
      'docs/guides/remote-tailscale',
      'docs/guides/remote-cloudflare',
      'docs/guides/remote-multiple-boxes',
      'docs/guides/remote-command'
    ]
  },
  { label: 'Platforms', items: ['docs/guides/windows', 'docs/guides/wsl'] },
  { label: 'Reference', items: ['docs/reference/cli', 'docs/reference/config', 'docs/examples'] },
  {
    label: 'Proxy errors',
    collapsed: true,
    items: [{ id: 'docs/errors', label: 'Overview' }, 'docs/errors/*']
  },
  {
    label: 'More',
    items: ['docs/design', 'docs/security', 'docs/observability', 'docs/milestones/*']
  }
];

/** @param {string | { id: string, label: string }} item */
const itemId = (item) => (typeof item === 'string' ? item : item.id);

/** Starlight's order within a directory: `sidebar.order` first, then the id. */
const byOrder = (
  /** @type {{ id: string, order?: number | undefined }} */ a,
  /** @type {{ id: string, order?: number | undefined }} */ b
) =>
  (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) ||
  a.id.localeCompare(b.id);

/**
 * Files the published pages into `docsGroups`. Items naming a page that does not exist are
 * skipped, and groups left empty are dropped. Pages no item takes are marked `unfiled`.
 * @template {{ id: string, order?: number | undefined }} Page
 * @param {Page[]} pages
 * @returns {{ label: string, collapsed: boolean, pages: (Page & { label?: string, unfiled?: boolean })[] }[]}
 */
export function groupDocs(pages) {
  const byId = new Map(pages.map((page) => [page.id, page]));
  const named = new Set(docsGroups.flatMap(({ items }) => items.map(itemId)));
  const taken = new Set();
  /** @param {(Page & { label?: string, unfiled?: boolean })[]} list */
  const take = (list) => {
    const fresh = list.filter((page) => !taken.has(page.id));
    for (const page of fresh) taken.add(page.id);
    return fresh;
  };
  const groups = docsGroups.map(({ label, collapsed = false, items }) => ({
    label,
    collapsed,
    pages: items.flatMap((item) => {
      const id = itemId(item);
      if (id.endsWith('/*')) {
        const prefix = id.slice(0, -1);
        const matches = pages.filter((page) => page.id.startsWith(prefix) && !named.has(page.id));
        return take(matches.sort(byOrder));
      }
      const page = byId.get(id);
      if (!page) return [];
      return take([typeof item === 'string' ? page : { ...page, label: item.label }]);
    })
  }));
  const unfiled = [...pages].sort(byOrder).map((page) => ({ ...page, unfiled: true }));
  groups.at(-1)?.pages.push(...take(unfiled));
  return groups.filter((group) => group.pages.length > 0);
}
