// Brings published content from source repositories into the build: docs, JSON Schemas, the
// installer and release assets all come from the same release tag.
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { gunzipSync } from 'node:zlib';
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
    ],
    // Release archives unpacked into public/<target>/. A local checkout has no release, so
    // `dirEnv` names a directory holding the unpacked files instead.
    assets: [
      // The TUI built for the browser, shown live by the monitor section. Optional until a
      // release includes it.
      [
        'devlanes-tui-web.tar.gz',
        'tui',
        {
          optional: true,
          dirEnv: 'DEVLANES_TUI_DIR',
          requires: ['devlanes_tui_web.js', 'devlanes_tui_web_bg.wasm']
        }
      ]
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

/** Download URL of an asset attached to the GitHub release of `tag`. */
export function assetUrl(repository, tag, name) {
  return `https://github.com/${repository}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(name)}`;
}

/**
 * Reads the regular files of an uncompressed tar archive. Release archives keep their files at
 * the root, so anything nested is refused rather than written outside the target directory.
 */
export function untar(archive) {
  const files = new Map();
  let offset = 0;
  while (offset + 512 <= archive.length) {
    const header = archive.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const field = (start, length) =>
      header
        .subarray(start, start + length)
        .toString('utf8')
        .replace(/\0.*$/s, '');
    const size = Number.parseInt(field(124, 12).trim() || '0', 8);
    // Only POSIX ustar headers carry a name prefix; GNU tar keeps other data in those bytes.
    const prefix = field(257, 6) === 'ustar' ? field(345, 155) : '';
    const name = (prefix ? `${prefix}/${field(0, 100)}` : field(0, 100)).replace(/^(\.\/)+/, '');
    const type = field(156, 1) || '0';
    offset += 512;
    if (type === '0') {
      if (!name || /[/\\]/.test(name) || name === '..') {
        throw new Error(`Unexpected path in archive: ${name}`);
      }
      files.set(name, archive.subarray(offset, offset + size));
    }
    // Directory entries such as `./` and pax or GNU metadata headers carry no file to publish.
    offset += Math.ceil(size / 512) * 512;
  }
  return files;
}

// Every WebAssembly binary starts with `\0asm`; an HTML error page or a broken build does not.
const wasmMagic = Buffer.from([0x00, 0x61, 0x73, 0x6d]);

/** Checks the files of an unpacked asset before they are published. */
export function validateAsset(name, files, requires = []) {
  for (const file of requires) {
    if (!files.has(file)) throw new Error(`${name} has no ${file}`);
  }
  for (const [file, content] of files) {
    if (file.endsWith('.wasm') && !Buffer.from(content).subarray(0, 4).equals(wasmMagic)) {
      throw new Error(`${name}: ${file} is not a WebAssembly module`);
    }
  }
}

/**
 * Files of an asset for a ref, or null when the ref has none: the release of `ref` provides the
 * archive, while a local checkout reads the unpacked files from the directory in `dirEnv`.
 */
export async function fetchAsset(source, asset, ref, env = process.env, fetcher = fetch) {
  const [name, , { dirEnv } = {}] = asset;
  if (ref === 'local') {
    const directory = dirEnv && env[dirEnv];
    if (!directory) return null;
    const files = new Map();
    for (const entry of await readdir(resolve(directory), { withFileTypes: true })) {
      if (entry.isFile()) files.set(entry.name, await readFile(join(entry.parentPath, entry.name)));
    }
    return files;
  }
  const headers = {};
  if (env.GH_TOKEN) headers.Authorization = `Bearer ${env.GH_TOKEN}`;
  const response = await fetcher(assetUrl(source.repository, ref, name), {
    headers,
    signal: AbortSignal.timeout(30_000)
  });
  // Releases published before the asset existed answer 404.
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Download of ${name} for ${ref} failed: ${response.status}`);
  return untar(gunzipSync(Buffer.from(await response.arrayBuffer())));
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

/** Publishes the docs, files and release assets of one source into the build. */
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
    const assets = source.assets ?? [];
    for (const asset of assets) {
      const [name, to, { optional = false, requires = [] } = {}] = asset;
      const files = await fetchAsset(source, asset, ref);
      if (files) validateAsset(name, files, requires);
      // Cleared even when the ref has no asset, so files from a newer ref never stay behind.
      await rm(join(publicDir, to), { recursive: true, force: true });
      if (!files) {
        if (!optional) throw new Error(`${name} is missing from ${source.repository}@${ref}`);
        missing.push(name);
        continue;
      }
      await mkdir(join(publicDir, to), { recursive: true });
      for (const [file, content] of files) await writeFile(join(publicDir, to, file), content);
    }
    const { repository, editBranch, docs } = source;
    const { published, skipped } = await importDocs(join(root, docs.path), {
      source: { repository, editBranch, ...docs },
      commit,
      updated: await historyDates(root, docs.path)
    });
    const hidden = skipped ? `, ${skipped} with publish: false skipped` : '';
    const copied = source.files.length + assets.length - missing.length;
    const absent = missing.length ? ` (not in this ref: ${missing.join(', ')})` : '';
    console.log(
      `Synced ${repository}@${ref} (${commit.slice(0, 12)}): ${published} docs pages${hidden}, ${copied} files and assets${absent}.`
    );
  } finally {
    await cleanup();
  }
}

if (import.meta.main) {
  for (const source of sources) await syncSource(source);
}
