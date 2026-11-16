// Everything served to language models: the Markdown twin of each docs page, /llms.txt (the
// index, in the sidebar's groups) and /llms-full.txt (every docs twin in the same order). The
// twins of the other pages are converted from their HTML by integrations/markdown.mjs.
import { type CollectionEntry, getCollection } from 'astro:content';
import { groupDocs, pagesOf } from './docs-nav.mjs';
import { twinMarkdown } from './docs-twin.mjs';
import { categories } from './example-taxonomy.mjs';
import { examples, inCategory, repository } from './examples';
import { nav } from './nav';
import { siteDescription, sitePages } from './site.mjs';

const examplesTwin = '/examples.md';

type Entry = CollectionEntry<'docs'>;

const markdownHeaders = { 'Content-Type': 'text/markdown; charset=utf-8' };
const textHeaders = { 'Content-Type': 'text/plain; charset=utf-8' };

const docsEntries = () => getCollection('docs', ({ data }) => !data.draft);

/**
 * Published docs pages filed into the sidebar's top-level groups, without those it hides.
 * Subgroups are flattened: llms.txt has one level of sections.
 */
async function groupedEntries() {
  // The examples' pages are in the collection too; they are not docs.
  const entries = (await docsEntries()).filter(
    ({ id, data }) => !data.sidebar.hidden && !id.startsWith('examples/')
  );
  const pages = entries.map((entry) => ({ id: entry.id, order: entry.data.sidebar.order, entry }));
  return groupDocs(pages, nav).groups.map((group) => ({
    label: group.label,
    pages: pagesOf(group) as typeof pages
  }));
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
  const body = [`# ${title}`, twinMarkdown(entry.body ?? '').trim()].filter(Boolean).join('\n\n');
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
  // The examples: their index, then each README's twin in the index's order.
  if (examples.length) {
    const links = categories.flatMap(({ id }) =>
      inCategory(id).map(({ slug, title, description }) =>
        link(title, `/examples/${slug}.md`, description)
      )
    );
    const index = link('All examples', examplesTwin, 'Every example, by category.');
    sections.push(`## Examples\n\n${[index, ...links].join('\n')}`);
  }
  const pages = sitePages
    .filter(({ twin }) => twin !== examplesTwin)
    .map(({ title, twin }) => link(title, twin));
  const body = [
    ...header,
    `Every page below is Markdown. ${new URL('/llms-full.txt', site)} has all the docs in one file.`,
    ...sections,
    `## Optional\n\n${pages.join('\n')}`
  ];
  return new Response(`${body.join('\n\n')}\n`, { headers: textHeaders });
}

/**
 * The Markdown twin of the examples index: the same sections and examples as the page, each
 * linked to its README's twin with what it is built with, what it needs and what it teaches.
 */
export function examplesIndex(site: URL | undefined) {
  const sections = categories.flatMap(({ id, label, text }) => {
    const items = inCategory(id).map((example) => {
      const built = [...example.langs, ...example.tools].map(({ label }) => label);
      return [
        `### [${example.title}](${new URL(`/examples/${example.slug}.md`, site)})`,
        example.description,
        [
          `- Built with: ${[...built, ...example.others].join(', ')}`,
          `- Needs: devlanes, Git, ${example.requires.join(', ')}`,
          `- Teaches: ${example.features.map((feature) => `\`${feature}\``).join(', ')}`,
          `- Code: ${example.code}`
        ].join('\n')
      ].join('\n\n');
    });
    return items.length ? [`## ${label}\n\n${text}`, ...items] : [];
  });
  const body = [
    '# devlanes examples',
    `> Small apps to clone and start, each a devlanes project with a README that walks through its start. Source: https://github.com/${repository}`,
    `\`\`\`sh\ngit clone https://github.com/${repository}\ncd examples/basics-hello-node\ndevlanes start\n\`\`\``,
    ...sections
  ];
  return new Response(`${body.join('\n\n')}\n`, { headers: markdownHeaders });
}

export async function llmsFullTxt(site: URL | undefined) {
  const twins = (await groupedEntries()).flatMap(({ pages }) =>
    pages.map(({ entry }) => twinText(entry, site))
  );
  return new Response(`${header.join('\n\n')}\n\n${twins.join('\n')}`, { headers: textHeaders });
}
