import { execFile } from 'node:child_process';
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, extname, join, posix, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const contentDir = fileURLToPath(new URL('../src/content/docs/', import.meta.url));

/**
 * Repositories whose Markdown is published under the site's docs. Each source owns one
 * directory of the Starlight collection, so other repositories can be added later.
 */
export const sources = [
  {
    repository: 'devlanes-run/devlanes',
    ref: process.env.DEVLANES_DOCS_REF ?? 'main',
    // Point at a local checkout to preview unpushed documentation.
    local: process.env.DEVLANES_DOCS_DIR,
    path: 'docs',
    target: 'docs',
    order: ['getting-started.md']
  }
];

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

function rewriteTarget(target, file, source, commit) {
  if (/^([a-z][a-z\d+.-]*:|#|\/)/i.test(target)) return target;
  const [path = '', hash] = target.split('#');
  const fromRoot = posix.normalize(posix.join(source.path, posix.dirname(file), path));
  if (fromRoot.startsWith('..')) return target;
  const suffix = hash ? `#${hash}` : '';
  const inSource = fromRoot === source.path || fromRoot.startsWith(`${source.path}/`);
  const extension = posix.extname(fromRoot).toLowerCase();
  if (inSource && markdownExtensions.has(extension)) {
    return routeFor(source, posix.relative(source.path, fromRoot)) + suffix;
  }
  if (inSource && imageExtensions.has(extension)) return target;
  // Code, examples and files outside the docs stay on GitHub, pinned to the built commit.
  return `https://github.com/${source.repository}/blob/${commit}/${fromRoot}${suffix}`;
}

/** Rewrites link targets outside code spans and fenced code blocks. */
export function rewriteLinks(markdown, file, source, commit) {
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
        return prefix + rewriteTarget(target, file, source, commit) + rest;
      }
      return line
        .split(/(`+[^`]*`+)/)
        .map((part, index) =>
          index % 2
            ? part
            : part.replace(
                /(\]\()([^)\s]+)/g,
                (_, open, target) => open + rewriteTarget(target, file, source, commit)
              )
        )
        .join('');
    })
    .join('\n');
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
export function toStarlightPage(markdown, file, source, commit) {
  let frontmatter = '';
  let body = markdown.replace(/\r\n/g, '\n');
  const existing = body.match(/^---\n([\s\S]*?)\n---\n/);
  if (existing) {
    frontmatter = existing[1] ?? '';
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
  if (!has('editUrl')) {
    const path = posix.join(source.path, file);
    fields.push(`editUrl: https://github.com/${source.repository}/edit/${source.ref}/${path}`);
  }
  const index = source.order?.indexOf(file) ?? -1;
  if (!has('sidebar') && (index >= 0 || routeFor(source, file) === `/${source.target}/`)) {
    fields.push(`sidebar:\n  order: ${index >= 0 ? index + 1 : 0}`);
  }

  const header = [frontmatter, ...fields].filter(Boolean).join('\n');
  return `---\n${header}\n---\n\n${rewriteLinks(body, file, source, commit).trimStart()}`;
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

async function checkout(source) {
  if (source.local) {
    const root = resolve(source.local);
    const { stdout } = await run('git', ['-C', root, 'rev-parse', 'HEAD']).catch(() => ({
      stdout: source.ref
    }));
    return { root, commit: stdout.trim(), cleanup: async () => {} };
  }
  const directory = await mkdtemp(join(tmpdir(), 'devlanes-docs-'));
  const url = `https://github.com/${source.repository}.git`;
  const args = ['clone', '--quiet', '--depth=1', '--filter=blob:none', '--sparse'];
  await run('git', [...args, `--branch=${source.ref}`, url, directory]);
  await run('git', ['-C', directory, 'sparse-checkout', 'set', source.path]);
  const { stdout } = await run('git', ['-C', directory, 'rev-parse', 'HEAD']);
  return {
    root: join(directory, source.path),
    commit: stdout.trim(),
    cleanup: () => rm(directory, { recursive: true, force: true })
  };
}

async function syncSource(source) {
  const { root, commit, cleanup } = await checkout(source);
  try {
    const target = join(contentDir, source.target);
    await rm(target, { recursive: true, force: true });
    let pages = 0;
    for (const file of await listFiles(root)) {
      const extension = extname(file).toLowerCase();
      if (markdownExtensions.has(extension)) {
        const destination = join(target, outputPath(file));
        await mkdir(dirname(destination), { recursive: true });
        const markdown = await readFile(join(root, file), 'utf8');
        await writeFile(destination, toStarlightPage(markdown, file, source, commit));
        pages += 1;
      } else if (imageExtensions.has(extension)) {
        await mkdir(dirname(join(target, file)), { recursive: true });
        await cp(join(root, file), join(target, file));
      }
    }
    console.log(`Imported ${pages} pages from ${source.repository}@${commit.slice(0, 12)}.`);
  } finally {
    await cleanup();
  }
}

if (import.meta.main) {
  for (const source of sources) await syncSource(source);
}
