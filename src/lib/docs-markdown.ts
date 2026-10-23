import { type CollectionEntry, getCollection } from 'astro:content';

type Entry = CollectionEntry<'docs'>;

// astro-slop only indexes single-segment route parameters, so docs Markdown routes are split by
// depth instead of using one rest parameter. Deeper pages fail the build until a route exists.
const maxDepth = 3;

/** Published docs entries whose id has exactly `depth` path segments. */
export async function docsAtDepth(depth: number) {
  const entries = await getCollection('docs', ({ data }) => !data.draft);
  const deep = entries.find((entry) => entry.id.split('/').length > maxDepth);
  if (deep) throw new Error(`No Markdown route covers ${deep.id}; add one under src/pages/docs/`);
  return entries.filter((entry) => entry.id.split('/').length === depth);
}

/** Paths for a route whose parameters are the id segments after `docs/`. */
export async function docsMarkdownPaths(depth: number, names: string[]) {
  return (await docsAtDepth(depth)).map((entry) => {
    const segments = entry.id.split('/').slice(1);
    const params = Object.fromEntries(names.map((name, index) => [name, segments[index]]));
    return { params, props: { entry } };
  });
}

/** Markdown twin of a docs page, with the metadata astro-slop reads for llms.txt. */
export function docsMarkdown(entry: Entry, site: URL | undefined) {
  const { title, description } = entry.data;
  const frontmatter = [`title: ${JSON.stringify(title)}`, `url: ${new URL(`/${entry.id}/`, site)}`];
  if (description) frontmatter.push(`description: ${JSON.stringify(description)}`);
  const { lastUpdated } = entry.data;
  if (lastUpdated instanceof Date) frontmatter.push(`updated: ${lastUpdated.toISOString()}`);
  const body = [`# ${title}`, entry.body?.trim()].filter(Boolean).join('\n\n');
  return new Response(`---\n${frontmatter.join('\n')}\n---\n\n${body}\n`, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' }
  });
}
