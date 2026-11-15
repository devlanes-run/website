// The examples catalogue as the pages use it: each example with its tools, feature groups and
// search text, and the facets with their counts. scripts/sync-examples.mjs writes the data.
import { categories, featureGroups, languages, stacks } from './example-taxonomy.mjs';

interface CatalogEntry {
  slug: string;
  title: string;
  description: string;
  category: string;
  languages: string[];
  frameworks: string[];
  features: string[];
  requires: string[];
}

export interface Tool {
  id: string;
  label: string;
  icon: string;
  /** Colour of a single-colour icon; logos carry their own. */
  color?: string;
}

export interface Example extends CatalogEntry {
  href: string;
  code: string;
  /** Tools with an icon, the least common first, since that one says most about the example. */
  tools: Tool[];
  /** Languages with their icons. */
  langs: Tool[];
  /** The icon that stands for the example. */
  lead: Tool;
  /** Frameworks without an icon, as written in the catalogue. */
  others: string[];
  /** Ids of the feature groups the example teaches, in the groups' order. */
  groups: string[];
}

export interface Facet {
  id: string;
  label: string;
  count: number;
  icon?: string;
  color?: string;
}

/** A taxonomy entry as a tool: its id, label and icon, without the matching rules. */
const tool = ({ id, label, icon, color }: Tool): Tool => ({
  id,
  label,
  icon,
  ...(color ? { color } : {})
});

/** Id of the feature group a catalogue feature belongs to. */
export const groupOf = (feature: string) =>
  featureGroups.find(({ match }) => match.some((pattern) => pattern.test(feature)))?.id ?? 'cli';

// The data file is written by the sync and not committed. A glob finds nothing before the first
// sync, where an import would fail: CI typechecks before it builds.
const synced = import.meta.glob<{ repository: string; examples: CatalogEntry[] }>(
  '../data/examples.json',
  { eager: true, import: 'default' }
);
const data = Object.values(synced)[0] ?? { repository: 'devlanes-run/examples', examples: [] };
const entries = data.examples;
const stackOf = (framework: string) => stacks.find(({ from }) => from.includes(framework));
const usage = new Map<string, number>();
for (const { frameworks } of entries) {
  for (const id of new Set(frameworks.flatMap((name) => stackOf(name)?.id ?? []))) {
    usage.set(id, (usage.get(id) ?? 0) + 1);
  }
}

export const examples: Example[] = entries.map((entry) => {
  const tools = [...new Set(entry.frameworks.flatMap((name) => stackOf(name) ?? []))]
    .sort((a, b) => (usage.get(a.id) ?? 0) - (usage.get(b.id) ?? 0))
    .map(tool);
  const langs = entry.languages
    .flatMap((id) => languages.find((item) => item.id === id) ?? [])
    .map(tool);
  // Hono is in nearly every example, so it stands for one only when nothing else does.
  const lead = tools.find(({ id }) => id !== 'hono') ?? langs[0] ?? tools[0];
  if (!lead) throw new Error(`${entry.slug} has no language or tool with an icon`);
  return {
    ...entry,
    href: `/examples/${entry.slug}/`,
    code: `https://github.com/${data.repository}/tree/main/${entry.slug}`,
    tools,
    langs,
    lead,
    others: entry.frameworks.filter((name) => !stackOf(name)),
    groups: featureGroups
      .map(({ id }) => id)
      .filter((id) => entry.features.some((feature) => groupOf(feature) === id))
  };
});

export const repository = data.repository;
export const bySlug = (slug: string) => examples.find((example) => example.slug === slug);

/** Features of an example that belong to a group, as written in the catalogue. */
export const featuresIn = (example: Example, group: string) =>
  example.features.filter((feature) => groupOf(feature) === group);

const counted = <Item extends { id: string; label: string; icon?: string; color?: string }>(
  items: Item[],
  has: (example: Example, id: string) => boolean
): Facet[] =>
  items
    .map(({ id, label, icon, color }) => ({
      id,
      label,
      ...(icon ? { icon } : {}),
      ...(color ? { color } : {}),
      count: examples.filter((example) => has(example, id)).length
    }))
    .filter(({ count }) => count > 0);

const byCount = (a: Facet, b: Facet) => b.count - a.count;

export const facets = {
  category: counted(categories, (example, id) => example.category === id),
  language: counted(languages, (example, id) => example.languages.includes(id)).sort(byCount),
  stack: counted(stacks, (example, id) => example.tools.some((tool) => tool.id === id)).sort(
    byCount
  ),
  feature: counted(featureGroups, (example, id) => example.groups.includes(id))
};

export const categoryText = (id: string) => categories.find((item) => item.id === id)?.text ?? '';

/** Examples of a category, in the catalogue's order. */
export const inCategory = (id: string) => examples.filter((example) => example.category === id);
