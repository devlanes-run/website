// Brings the examples catalogue into the build: catalog.json of devlanes-run/examples becomes
// src/data/examples.json, and each ready example's README a Starlight page at /examples/<slug>/.
// Examples follow the repository's main branch, not a release: they are not versioned, and a
// merged example should show up without waiting for one. scripts/sync.mjs runs this.
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { toStarlightPage } from './sync-docs.mjs';

const run = promisify(execFile);
const repository = 'devlanes-run/examples';
const branch = 'main';
const pagesDir = fileURLToPath(new URL('../src/content/docs/examples/', import.meta.url));
const dataFile = fileURLToPath(new URL('../src/data/examples.json', import.meta.url));

async function git(directory, ...args) {
  const { stdout } = await run('git', ['-C', directory, ...args]);
  return stdout.trim();
}

/** A local checkout named by EXAMPLES_DIR, for previews, or a shallow clone of the branch. */
async function checkout(env = process.env) {
  if (env.EXAMPLES_DIR) {
    const root = resolve(env.EXAMPLES_DIR);
    const commit = await git(root, 'rev-parse', 'HEAD').catch(() => branch);
    return { root, commit, cleanup: async () => {} };
  }
  const root = await mkdtemp(join(tmpdir(), 'website-examples-'));
  const url = `https://github.com/${repository}.git`;
  await run('git', ['clone', '--quiet', '--depth=1', `--branch=${branch}`, url, root]);
  return {
    root,
    commit: await git(root, 'rev-parse', 'HEAD'),
    cleanup: () => rm(root, { recursive: true, force: true })
  };
}

/**
 * Points GitHub links at the site where the site has the page: the devlanes docs, which the
 * READMEs link by their GitHub URL, and the other examples.
 */
export function siteLinks(markdown, slugs) {
  return markdown
    .replace(
      /https:\/\/github\.com\/devlanes-run\/devlanes\/(?:blob|tree)\/main\/docs\/([\w/-]+)\.md(#[\w-]+)?(?=[)\s])/g,
      (_, path, hash = '') => {
        // A README is its folder's index page.
        const route = path.replace(/(^|\/)README$/, '');
        return `/docs/${route ? `${route}/` : ''}${hash}`;
      }
    )
    .replace(
      /https:\/\/github\.com\/devlanes-run\/examples\/(?:blob|tree)\/[\w.-]+\/([\w-]+)(?:\/README\.md)?(#[\w-]+)?(?=[)\s])/g,
      (url, slug, hash = '') => (slugs.has(slug) ? `/examples/${slug}/${hash}` : url)
    );
}

/** Writes the catalogue and the examples' pages into the build. */
export async function syncExamples() {
  const { root, commit, cleanup } = await checkout();
  try {
    const catalog = JSON.parse(await readFile(join(root, 'catalog.json'), 'utf8'));
    // A planned example has no folder yet.
    const examples = catalog.examples.filter((example) => example.status === 'ready');
    const slugs = new Set(examples.map(({ slug }) => slug));
    await rm(pagesDir, { recursive: true, force: true });
    await mkdir(pagesDir, { recursive: true });
    for (const { slug, description } of examples) {
      const readme = await readFile(join(root, slug, 'README.md'), 'utf8');
      const source = { repository, editBranch: branch, path: slug, target: `examples/${slug}` };
      // The page's description is the catalogue's, which the index and llms.txt show too.
      const described = `---\ndescription: ${JSON.stringify(description)}\n---\n\n${readme}`;
      const page = toStarlightPage(described, 'README.md', { source, commit });
      await writeFile(join(pagesDir, `${slug}.md`), siteLinks(page, slugs));
    }
    await mkdir(dirname(dataFile), { recursive: true });
    await writeFile(dataFile, `${JSON.stringify({ repository, commit, examples }, null, 2)}\n`);
    console.log(`Synced ${repository}@${commit.slice(0, 12)}: ${examples.length} examples.`);
  } finally {
    await cleanup();
  }
}
