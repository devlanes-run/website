// Everything served to language models: the Markdown twin of each docs page, /llms.txt (the
// index, in the sidebar's groups) and /llms-full.txt (every docs twin in the same order). The
// twins of the other pages are converted from their HTML by integrations/markdown.mjs.
import { type CollectionEntry, getCollection } from 'astro:content';
import { groupDocs } from './docs-nav.mjs';
import { siteDescription, sitePages } from './site.mjs';

type Entry = CollectionEntry<'docs'>;

const markdownHeaders = { 'Content-Type': 'text/markdown; charset=utf-8' };
const textHeaders = { 'Content-Type': 'text/plain; charset=utf-8' };

const docsEntries = () => getCollection('docs', ({ data }) => !data.draft);

/** Published docs pages filed into the sidebar's groups, without those it hides. */
async function groupedEntries() {
  const entries = (await docsEntries()).filter(({ data }) => !data.sidebar.hidden);
  return groupDocs(
    entries.map((entry) => ({ id: entry.id, order: entry.data.sidebar.order, entry }))
  );
}

/** Paths of the docs twins: each page's URL plus `.md`, so `/docs/` has `/docs.md`. */
export async function twinPaths() {
  return (await docsEntries()).map((entry) => ({ params: { slug: entry.id }, props: { entry } }));
}

function twinText(entry: Entry, site: URL | undefined) {
  const { title, description, lastUpdated } = entry.data;
  const frontmatter = [`title: ${JSON.stringify(title)}`, `url: ${new URL(`/${entry.id}/`, site)}`];
  if (description) frontmatter.push(`description: ${JSON.stringify(description)}`);
  if (lastUpdated instanceof Date) frontmatter.push(`updated: ${lastUpdated.toISOString()}`);
  const body = [`# ${title}`, entry.body?.trim()].filter(Boolean).join('\n\n');
  return `---\n${frontmatter.join('\n')}\n---\n\n${body}\n`;
}

export function twin(entry: Entry, site: URL | undefined) {
  return new Response(twinText(entry, site), { headers: markdownHeaders });
}

/** The `# name` and `> summary` that open both text files. */
const header = ['# devlanes', `> ${siteDescription}`];

export async function llmsTxt(site: URL | undefined) {
  const link = (title: string, path: string, notes?: string) =>
    `- [${title.replace(/[[\]]/g, '\\$&')}](${new URL(path, site)})${notes ? `: ${notes}` : ''}`;
  const sections = (await groupedEntries()).map(({ label, pages }) => {
    const links = pages.map(({ entry }) =>
      link(entry.data.title, `/${entry.id}.md`, entry.data.description)
    );
    return `## ${label}\n\n${links.join('\n')}`;
  });
  const pages = sitePages.map(({ title, twin }) => link(title, twin));
  const body = [
    ...header,
    `Every page below is Markdown. ${new URL('/llms-full.txt', site)} has all the docs in one file.`,
    ...sections,
    `## Optional\n\n${pages.join('\n')}`
  ];
  return new Response(`${body.join('\n\n')}\n`, { headers: textHeaders });
}

export async function llmsFullTxt(site: URL | undefined) {
  const twins = (await groupedEntries()).flatMap(({ pages }) =>
    pages.map(({ entry }) => twinText(entry, site))
  );
  return new Response(`${header.join('\n\n')}\n\n${twins.join('\n')}`, { headers: textHeaders });
}
