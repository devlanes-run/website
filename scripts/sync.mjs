// Brings published content from source repositories into the build: docs, JSON Schemas and
// the installer all come from one checkout of the same release tag.
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { historyDates, importDocs } from './sync-docs.mjs';

const run = promisify(execFile);
const publicDir = fileURLToPath(new URL('../public/', import.meta.url));

export const sources = [
  {
    repository: 'devlanes-run/devlanes',
    editBranch: 'main',
    // For previews only: a branch or tag to build instead of the latest release, or a local
    // checkout of the repository.
    refEnv: 'DEVLANES_REF',
    dirEnv: 'DEVLANES_DIR',
    docs: { path: 'docs', target: 'docs', order: ['getting-started.md'] },
    files: [
      ['crates/config/schema.json', 'v1/schema.json'],
      ['crates/config/user-schema.json', 'v1/user-schema.json'],
      ['install.sh', 'install.sh'],
      // Optional until a release includes it: 0.3.0 and earlier have no Windows installer.
      ['install.ps1', 'install.ps1', { optional: true }]
    ]
  }
];

/** Tag of the latest published, non-prerelease GitHub release, or null without releases. */
export async function latestRelease(repository, fetcher = fetch, token = undefined) {
  const headers = { Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetcher(`https://api.github.com/repos/${repository}/releases/latest`, {
    headers,
    signal: AbortSignal.timeout(30_000)
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Release lookup for ${repository} failed: ${response.status}`);
  const release = await response.json();
  if (release.draft || release.prerelease || typeof release.tag_name !== 'string') {
    throw new Error(`Unexpected latest release for ${repository}`);
  }
  return release.tag_name;
}

/**
 * Picks the ref to publish: an explicit preview override, otherwise the latest release. A
 * release that triggered the build passes its tag, which must still be the latest, so a rerun
 * of an older release cannot replace newer content.
 */
export async function resolveRef(source, env = process.env, fetcher = fetch) {
  const override = env[source.refEnv];
  if (override) return override;
  const latest = await latestRelease(source.repository, fetcher, env.GH_TOKEN);
  if (!latest) throw new Error(`${source.repository} has no published release yet`);
  const requested = env.DISPATCH_REPOSITORY === source.repository ? env.DISPATCH_TAG : undefined;
  if (requested && requested !== latest) {
    throw new Error(`${requested} is not the latest release of ${source.repository} (${latest})`);
  }
  return latest;
}

/** Checks a downloaded file before it is published. */
export function validateFile(name, content) {
  if (name.endsWith('.json')) {
    const json = JSON.parse(content);
    if (!json.$schema || !json.$id) throw new Error(`${name} is not a JSON Schema with an $id`);
  } else if (name.endsWith('.sh') && !content.startsWith('#!')) {
    throw new Error(`${name} does not start with a shebang`);
  } else if (name.endsWith('.ps1') && !/^\s*#/.test(content)) {
    // The installer opens with its usage comment; anything else is not the script.
    throw new Error(`${name} does not start with a comment`);
  }
}

async function git(directory, ...args) {
  const { stdout } = await run('git', ['-C', directory, ...args], { maxBuffer: 16 * 1024 * 1024 });
  return stdout.trim();
}

async function checkout(source, env = process.env) {
  const local = env[source.dirEnv];
  if (local) {
    const root = resolve(local);
    const commit = await git(root, 'rev-parse', 'HEAD').catch(() => 'local');
    return { root, ref: 'local', commit, cleanup: async () => {} };
  }
  const ref = await resolveRef(source, env);
  const root = await mkdtemp(join(tmpdir(), 'website-source-'));
  // History without file contents gives per-page dates; only the sparse paths are downloaded.
  const url = `https://github.com/${source.repository}.git`;
  await run('git', [
    'clone',
    '--quiet',
    '--filter=blob:none',
    '--sparse',
    `--branch=${ref}`,
    url,
    root
  ]);
  const patterns = [`/${source.docs.path}/`, ...source.files.map(([from]) => `/${from}`)];
  await git(root, 'sparse-checkout', 'set', '--no-cone', ...patterns);
  return {
    root,
    ref,
    commit: await git(root, 'rev-parse', 'HEAD'),
    cleanup: () => rm(root, { recursive: true, force: true })
  };
}

async function syncSource(source) {
  const { root, ref, commit, cleanup } = await checkout(source);
  try {
    const missing = [];
    for (const [from, to, { optional = false } = {}] of source.files) {
      let content;
      try {
        content = await readFile(join(root, from), 'utf8');
      } catch (error) {
        if (!optional || error.code !== 'ENOENT') throw error;
        // A local build must not keep the file from a newer ref.
        await rm(join(publicDir, to), { force: true });
        missing.push(from);
        continue;
      }
      validateFile(from, content);
      await mkdir(dirname(join(publicDir, to)), { recursive: true });
      await writeFile(join(publicDir, to), content);
    }
    const { repository, editBranch, docs } = source;
    const { published, skipped } = await importDocs(join(root, docs.path), {
      source: { repository, editBranch, ...docs },
      commit,
      updated: await historyDates(root, docs.path)
    });
    const hidden = skipped ? `, ${skipped} with publish: false skipped` : '';
    const copied = source.files.length - missing.length;
    const absent = missing.length ? ` (not in this ref: ${missing.join(', ')})` : '';
    console.log(
      `Synced ${repository}@${ref} (${commit.slice(0, 12)}): ${published} docs pages${hidden}, ${copied} files${absent}.`
    );
  } finally {
    await cleanup();
  }
}

if (import.meta.main) {
  for (const source of sources) await syncSource(source);
}
