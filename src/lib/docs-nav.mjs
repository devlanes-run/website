// Groups of the docs sidebar and of llms.txt, read from `docs/nav.yaml` in the source repository,
// so a new page needs no change here. Items are page paths relative to `docs/` without the
// extension (`index` is the README), `dir/*` for the pages under `dir/` that no item names, by
// sidebar order, or a group one level down. Pages no item takes join the last group.
import { parse } from 'yaml';

/**
 * @typedef {{ label: string, collapsed?: boolean, sequence?: boolean, items: (string | NavGroup)[] }} NavGroup
 * @typedef {{ id: string, order?: number | undefined }} PageLike
 */

/** @param {string} where @param {unknown} value @returns {asserts value is NavGroup} */
function checkGroup(where, value, depth) {
  const group = /** @type {Record<string, unknown>} */ (value);
  if (typeof value !== 'object' || value === null || typeof group.label !== 'string') {
    throw new Error(`${where}: a group needs a label`);
  }
  if (!Array.isArray(group.items))
    throw new Error(`${where} (${group.label}): items must be a list`);
  for (const key of ['collapsed', 'sequence']) {
    if (key in group && typeof group[key] !== 'boolean') {
      throw new Error(`${where} (${group.label}): ${key} must be true or false`);
    }
  }
  for (const key of Object.keys(group)) {
    if (!['label', 'items', 'collapsed', 'sequence'].includes(key)) {
      throw new Error(`${where} (${group.label}): unknown key ${key}`);
    }
  }
  for (const item of group.items) {
    if (typeof item === 'string') continue;
    if (depth > 0) throw new Error(`${where} (${group.label}): groups nest one level only`);
    checkGroup(where, item, depth + 1);
  }
}

/** Parses and checks the text of `docs/nav.yaml`. */
export function parseNav(text, where = 'docs/nav.yaml') {
  const nav = parse(text);
  if (!Array.isArray(nav)) throw new Error(`${where} must be a list of groups`);
  for (const group of nav) checkGroup(where, group, 0);
  return /** @type {NavGroup[]} */ (nav);
}

/** Entry id of a nav path: `index` is the docs root, anything else sits under `docs/`. */
export const idOf = (/** @type {string} */ path) => (path === 'index' ? 'docs' : `docs/${path}`);

/** Starlight's order within a directory: `sidebar.order` first, then the id. */
const byOrder = (/** @type {PageLike} */ a, /** @type {PageLike} */ b) =>
  (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) ||
  a.id.localeCompare(b.id);

/**
 * @template {PageLike} Page
 * @typedef {{ label: string, collapsed: boolean, sequence: boolean, items: (Page | Group<Page>)[] }} Group
 */

/** @template {PageLike} Page @param {Page | Group<Page>} item @returns {item is Group<Page>} */
export const isGroup = (item) => 'items' in item;

/** Pages of a group and of its subgroups, in order. */
export function pagesOf(/** @type {Group<any>} */ group) {
  return group.items.flatMap((item) => (isGroup(item) ? pagesOf(item) : [item]));
}

/**
 * Files the published pages into the groups of `nav`. Without a nav file every page goes into
 * one group. `missing` lists the paths that name no page, `unfiled` the pages no item took.
 * Groups left empty are dropped.
 * @template {PageLike} Page
 * @param {Page[]} pages
 * @param {NavGroup[] | null} nav
 */
export function groupDocs(pages, nav) {
  if (!nav) {
    const all = [...pages].sort(byOrder);
    return {
      groups: [{ label: 'Docs', collapsed: false, sequence: false, items: all }],
      missing: [],
      unfiled: all
    };
  }
  const byId = new Map(pages.map((page) => [page.id, page]));
  /** @param {(string | NavGroup)[]} items @returns {string[]} */
  const namedIn = (items) =>
    items.flatMap((item) =>
      typeof item === 'string' ? (item.endsWith('/*') ? [] : [idOf(item)]) : namedIn(item.items)
    );
  const named = new Set(namedIn(nav));
  const taken = new Set();
  /** @type {string[]} */
  const missing = [];
  const take = (/** @type {Page[]} */ list) => {
    const fresh = list.filter((page) => !taken.has(page.id));
    for (const page of fresh) taken.add(page.id);
    return fresh;
  };
  /** @param {NavGroup} group @returns {Group<Page>} */
  const build = ({ label, collapsed = false, sequence = false, items }) => ({
    label,
    collapsed,
    sequence,
    items: items.flatMap((item) => {
      if (typeof item !== 'string') {
        const sub = build(item);
        return sub.items.length ? [sub] : [];
      }
      if (item.endsWith('/*')) {
        const prefix = `${idOf(item.slice(0, -2))}/`;
        return take(
          pages.filter((page) => page.id.startsWith(prefix) && !named.has(page.id)).sort(byOrder)
        );
      }
      const page = byId.get(idOf(item));
      if (!page) missing.push(item);
      return page ? take([page]) : [];
    })
  });
  const groups = nav.map(build);
  const unfiled = take([...pages].sort(byOrder));
  groups.at(-1)?.items.push(...unfiled);
  return { groups: groups.filter((group) => group.items.length > 0), missing, unfiled };
}
