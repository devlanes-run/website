// Turns a source repository's Markdown into Starlight pages. scripts/sync.mjs decides which
// repositories and refs are imported.
import { execFile } from 'node:child_process';
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, extname, join, posix, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const contentDir = fileURLToPath(new URL('../src/content/docs/', import.meta.url));

const markdownExtensions = new Set(['.md', '.mdx']);
const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif']);

/** Matches the per-segment slugs Astro's glob loader generates for entry ids. */
export function slugify(segment) {
  return segment
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

/** Maps a Markdown path inside a source to the route Starlight generates for it. */
export function routeFor(source, file) {
  const parts = file.replace(/\.mdx?$/, '').split('/');
  const last = parts.at(-1)?.toLowerCase();
  if (last === 'readme' || last === 'index') parts.pop();
  return `/${[source.target, ...parts].map(slugify).join('/')}/`;
}

/** Destination of a Markdown file in the collection; READMEs become directory index pages. */
function outputPath(file) {
  const parsed = posix.parse(file);
  const name = parsed.name.toLowerCase() === 'readme' ? 'index' : parsed.name;
  return posix.join(parsed.dir, `${name}${parsed.ext}`);
}

/** Frontmatter block of a Markdown file, or an empty string. */
function frontmatterOf(markdown) {
  return markdown.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? '';
}

/** Pages opt out of the website with `publish: false`; they stay readable on GitHub. */
export function isPublished(markdown) {
  return !/^publish:\s*false\s*(#.*)?$/m.test(frontmatterOf(markdown));
}

/**
 * Resolves one link or image target.
 * - Published pages link to their site route; unpublished ones to GitHub.
 * - Markdown images inside the source stay relative, so Astro copies and optimizes them.
 * - Other images use raw GitHub URLs, because only Markdown image syntax is processed by Astro
 *   and files outside the source are not part of the checkout.
 * - Any other file opens on GitHub. Every GitHub URL is pinned to the built commit.
 */
function rewriteTarget(target, file, context, kind) {
  if (/^([a-z][a-z\d+.-]*:|#|\/)/i.test(target)) return target;
  const { source, commit, unpublished } = context;
  const [rawPath = '', hash] = target.split('#');
  let path = rawPath;
  try {
    path = decodeURI(rawPath);
  } catch {
    // Keep malformed escapes as written.
  }
  const fromRoot = posix.normalize(posix.join(source.path, posix.dirname(file), path));
  if (fromRoot.startsWith('..')) return target;
  const suffix = hash ? `#${hash}` : '';
  const inSource = fromRoot === source.path || fromRoot.startsWith(`${source.path}/`);
  const relativePath = posix.relative(source.path, fromRoot);
  const extension = posix.extname(fromRoot).toLowerCase();
  const repositoryPath = `${source.repository}/${commit}/${encodeURI(fromRoot)}`;

  if (imageExtensions.has(extension)) {
    if (inSource && kind === 'markdown-image') return target;
    return `https://raw.githubusercontent.com/${repositoryPath}`;
  }
  if (inSource && markdownExtensions.has(extension) && !unpublished?.has(relativePath)) {
    return routeFor(source, relativePath) + suffix;
  }
  return `https://github.com/${source.repository}/blob/${commit}/${encodeURI(fromRoot)}${suffix}`;
}

/** Finds where the `[` matching the `]` at `close` starts, honouring nested brackets. */
function openingBracket(text, close) {
  let depth = 0;
  for (let index = close; index >= 0; index -= 1) {
    if (text[index] === ']') depth += 1;
    else if (text[index] === '[' && --depth === 0) return index;
  }
  return -1;
}

function rewriteInline(text, file, context) {
  const links = text.replace(/\]\(([^)\s]+)/g, (_match, target, offset) => {
    const open = openingBracket(text, offset);
    const kind = open > 0 && text[open - 1] === '!' ? 'markdown-image' : 'link';
    return `](${rewriteTarget(target, file, context, kind)}`;
  });
  // Raw HTML is not processed by Astro, so its images always use absolute URLs.
  return links.replace(
    /\b(src|href)=(["'])([^"']+)\2/g,
    (_, attribute, quote, target) =>
      `${attribute}=${quote}${rewriteTarget(target, file, context, 'html')}${quote}`
  );
}

/** Rewrites link and image targets outside code spans and fenced code blocks. */
export function rewriteLinks(markdown, file, context) {
  let fence = null;
  return markdown
    .split('\n')
    .map((line) => {
      const marker = line.match(/^\s*(`{3,}|~{3,})/)?.[1];
      if (marker && (!fence || marker.startsWith(fence))) {
        fence = fence ? null : marker;
        return line;
      }
      if (fence) return line;
      const definition = line.match(/^(\s*\[[^\]]+\]:\s*)(\S+)(.*)$/);
      if (definition) {
        const [, prefix, target, rest] = definition;
        return prefix + rewriteTarget(target, file, context, 'definition') + rest;
      }
      return line
        .split(/(`+[^`]*`+)/)
        .map((part, index) => (index % 2 ? part : rewriteInline(part, file, context)))
        .join('');
    })
    .join('\n');
}

/** Whether the body has h2 or h3 headings, the levels Starlight lists in the page outline. */
function hasSections(markdown) {
  let fence = null;
  for (const line of markdown.split('\n')) {
    const marker = line.match(/^\s*(`{3,}|~{3,})/)?.[1];
    if (marker && (!fence || marker.startsWith(fence))) fence = fence ? null : marker;
    else if (!fence && /^#{2,3}\s/.test(line)) return true;
  }
  return false;
}

function plainText(markdown) {
  return markdown
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Turns repository Markdown into a Starlight page: the first H1 becomes the title, the first
 * paragraph the description, and links point at site routes or the source on GitHub.
 */
export function toStarlightPage(markdown, file, context) {
  const { source } = context;
  let frontmatter = '';
  let body = markdown.replace(/\r\n/g, '\n');
  const existing = body.match(/^---\n([\s\S]*?)\n---\n/);
  if (existing) {
    // `publish` only steers the importer; Starlight's schema does not know it.
    frontmatter = (existing[1] ?? '').replace(/^publish:.*(\n|$)/m, '').trim();
    body = body.slice(existing[0].length);
  }

  const fields = [];
  const has = (key) => new RegExp(`^${key}:`, 'm').test(frontmatter);
  // Starlight renders the title itself, so only a leading H1 is moved out of the body.
  const match = body.match(/^# (.+)\n+/m);
  const heading = match && !body.slice(0, match.index).trim() ? match : null;
  if (heading) body = body.slice((heading.index ?? 0) + heading[0].length);
  if (!has('title')) {
    const fallback = posix.basename(posix.dirname(`${source.target}/${file}`));
    fields.push(`title: ${JSON.stringify(heading?.[1]?.trim() ?? fallback)}`);
  }
  if (!has('description')) {
    const paragraph = body
      .split(/\n{2,}/)
      .find((block) => /^[\p{L}\p{N}`[*_]/u.test(block.trim()) && !block.startsWith('|'));
    const sentence = paragraph ? plainText(paragraph).match(/^.+?[.!?](\s|$)/)?.[0] : undefined;
    if (sentence) fields.push(`description: ${JSON.stringify(sentence.trim())}`);
  }
  // A page outline with only "Overview" wastes the column next to the text.
  if (!has('tableOfContents') && !hasSections(body)) fields.push('tableOfContents: false');
  const updated = context.updated?.get(file);
  if (!has('lastUpdated') && updated) fields.push(`lastUpdated: ${updated}`);
  if (!has('editUrl')) {
    const path = posix.join(source.path, file);
    // Edits go to the development branch; the published ref is usually a release tag.
    fields.push(
      `editUrl: https://github.com/${source.repository}/edit/${source.editBranch}/${path}`
    );
  }
  const index = source.order?.indexOf(file) ?? -1;
  if (!has('sidebar') && (index >= 0 || routeFor(source, file) === `/${source.target}/`)) {
    fields.push(`sidebar:\n  order: ${index >= 0 ? index + 1 : 0}`);
  }

  const header = [frontmatter, ...fields].filter(Boolean).join('\n');
  return `---\n${header}\n---\n\n${rewriteLinks(body, file, context).trimStart()}`;
}

async function listFiles(root, directory = root) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? listFiles(root, path) : [relative(root, path)];
    })
  );
  return files.flat().map((file) => file.split('\\').join('/'));
}

/**
 * Maps each file under `sourcePath` to the ISO date of the newest commit that touched it, from
 * `git log --format=%x1f%cI --name-only` output (newest commits first).
 */
export function parseLastUpdated(log, sourcePath) {
  const dates = new Map();
  for (const commit of log.split('\x1f').slice(1)) {
    const [date, ...files] = commit.trim().split('\n');
    for (const path of files) {
      const file = posix.relative(sourcePath, path.trim());
      if (date && file && !file.startsWith('..') && !dates.has(file)) dates.set(file, date);
    }
  }
  return dates;
}

/** Last-change dates of the files under `sourcePath`; empty when there is no Git history. */
export async function historyDates(repositoryRoot, sourcePath) {
  try {
    const { stdout } = await run(
      'git',
      ['-C', repositoryRoot, 'log', '--format=%x1f%cI', '--name-only', '--', sourcePath],
      { maxBuffer: 64 * 1024 * 1024 }
    );
    return parseLastUpdated(stdout, sourcePath);
  } catch {
    return new Map();
  }
}

/**
 * Writes the docs found in `root` (the source's docs directory) into the Starlight collection.
 * `context` holds the `source` options, the built `commit` and the `updated` dates.
 */
export async function importDocs(root, context) {
  const { source } = context;
  const target = join(contentDir, source.target);
  await rm(target, { recursive: true, force: true });
  const files = await listFiles(root);
  const pages = new Map();
  for (const file of files) {
    if (markdownExtensions.has(extname(file).toLowerCase())) {
      pages.set(file, await readFile(join(root, file), 'utf8'));
    }
  }
  // Collected first, so links from published pages can point unpublished ones at GitHub.
  const unpublished = new Set([...pages].filter(([, text]) => !isPublished(text)).map(([f]) => f));
  const pageContext = { ...context, unpublished };

  for (const file of files) {
    const markdown = pages.get(file);
    if (markdown !== undefined && !unpublished.has(file)) {
      const destination = join(target, outputPath(file));
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination, toStarlightPage(markdown, file, pageContext));
    } else if (imageExtensions.has(extname(file).toLowerCase())) {
      await mkdir(dirname(join(target, file)), { recursive: true });
      await cp(join(root, file), join(target, file));
    }
  }
  return { published: pages.size - unpublished.size, skipped: unpublished.size };
}
