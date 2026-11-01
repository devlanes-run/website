import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { gzipSync } from 'node:zlib';
import {
  assetUrl,
  fetchAsset,
  latestRelease,
  resolveRef,
  sources,
  untar,
  validateAsset,
  validateFile
} from './sync.mjs';

const [source] = sources;
const tuiAsset = source.assets.find(([name]) => name === 'devlanes-tui-web.tar.gz');
const wasm = Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);

/**
 * Builds a tar archive like `tar -C out -czf asset.tar.gz .` does: a `./` directory entry
 * followed by `./`-prefixed files. `magic` switches between POSIX and GNU headers.
 */
function tarball(files, magic = 'ustar\u000000') {
  const blocks = [];
  const header = (name, size, type) => {
    const block = Buffer.alloc(512);
    block.write(name, 0);
    block.write('0000644\0', 100);
    block.write(`${size.toString(8).padStart(11, '0')}\0`, 124);
    block.write(type, 156);
    block.write(magic, 257);
    return block;
  };
  blocks.push(header('./', 0, '5'));
  for (const [name, content] of Object.entries(files)) {
    const body = Buffer.from(content);
    blocks.push(header(`./${name}`, body.length, '0'), body);
    blocks.push(Buffer.alloc((512 - (body.length % 512)) % 512));
  }
  blocks.push(Buffer.alloc(1024));
  return Buffer.concat(blocks);
}
const releases =
  (tag, extra = {}) =>
  async (url) => {
    assert.match(url, /\/repos\/devlanes-run\/devlanes\/releases\/latest$/);
    return tag
      ? Response.json({ tag_name: tag, draft: false, prerelease: false, ...extra })
      : new Response(null, { status: 404 });
  };

test('publishes the latest release by default', async () => {
  assert.equal(await resolveRef(source, {}, releases('v0.3.0')), 'v0.3.0');
});

test('accepts the tag of the release that triggered the build', async () => {
  const env = { DISPATCH_REPOSITORY: 'devlanes-run/devlanes', DISPATCH_TAG: 'v0.3.0' };
  assert.equal(await resolveRef(source, env, releases('v0.3.0')), 'v0.3.0');
});

test('refuses to publish a release older than the latest', async () => {
  const env = { DISPATCH_REPOSITORY: 'devlanes-run/devlanes', DISPATCH_TAG: 'v0.2.0' };
  await assert.rejects(resolveRef(source, env, releases('v0.3.0')), /not the latest release/);
});

test('ignores dispatches from other repositories', async () => {
  const env = { DISPATCH_REPOSITORY: 'devlanes-run/action', DISPATCH_TAG: 'v9.0.0' };
  assert.equal(await resolveRef(source, env, releases('v0.3.0')), 'v0.3.0');
});

test('lets previews override the ref without asking GitHub', async () => {
  const unused = async () => assert.fail('no release lookup expected');
  assert.equal(await resolveRef(source, { DEVLANES_REF: 'main' }, unused), 'main');
});

test('fails without a published release and on API errors', async () => {
  await assert.rejects(resolveRef(source, {}, releases(null)), /no published release/);
  await assert.rejects(
    latestRelease('devlanes-run/devlanes', async () => new Response(null, { status: 403 })),
    /403/
  );
  await assert.rejects(
    resolveRef(source, {}, releases('v1.0.0', { prerelease: true })),
    /Unexpected/
  );
});

test('sends the token to the GitHub API', async () => {
  let headers;
  await latestRelease(
    'devlanes-run/devlanes',
    async (_url, options) => {
      headers = options.headers;
      return Response.json({ tag_name: 'v1.0.0', draft: false, prerelease: false });
    },
    'secret'
  );
  assert.equal(headers.Authorization, 'Bearer secret');
});

test('validates schemas and the installer before publishing them', () => {
  validateFile('schema.json', '{"$schema":"x","$id":"https://devlanes.run/v1/schema.json"}');
  validateFile('install.sh', '#!/bin/sh\n');
  assert.throws(() => validateFile('schema.json', '{}'), /JSON Schema/);
  assert.throws(() => validateFile('install.sh', 'echo hi'), /shebang/);
  validateFile('install.ps1', '# Installs devlanes for Windows\n& { }\n');
  assert.throws(() => validateFile('install.ps1', '<!doctype html>'), /comment/);
});

test('builds release asset URLs from the synced tag', () => {
  assert.equal(
    assetUrl('devlanes-run/devlanes', 'v1.0.0', 'devlanes-tui-web.tar.gz'),
    'https://github.com/devlanes-run/devlanes/releases/download/v1.0.0/devlanes-tui-web.tar.gz'
  );
});

test('unpacks the TUI web asset with the token when one is set', async () => {
  let request;
  const archive = gzipSync(
    tarball({ 'devlanes_tui_web.js': 'export {}', 'devlanes_tui_web_bg.wasm': wasm })
  );
  const files = await fetchAsset(
    source,
    tuiAsset,
    'v1.0.0',
    { GH_TOKEN: 'secret' },
    async (url, options) => {
      request = { url, options };
      return new Response(archive);
    }
  );
  assert.equal(request.url, assetUrl('devlanes-run/devlanes', 'v1.0.0', 'devlanes-tui-web.tar.gz'));
  assert.equal(request.options.headers.Authorization, 'Bearer secret');
  assert.deepEqual([...files.keys()], ['devlanes_tui_web.js', 'devlanes_tui_web_bg.wasm']);
  assert.equal(files.get('devlanes_tui_web.js').toString(), 'export {}');
  assert.deepEqual(files.get('devlanes_tui_web_bg.wasm'), wasm);
});

test('skips the asset for releases that predate it and fails on other errors', async () => {
  const status = (code) => async () => new Response(null, { status: code });
  assert.equal(await fetchAsset(source, tuiAsset, 'v0.3.0', {}, status(404)), null);
  await assert.rejects(fetchAsset(source, tuiAsset, 'v0.3.0', {}, status(502)), /502/);
});

test('reads the TUI web build of a local checkout from DEVLANES_TUI_DIR', async () => {
  const unused = async () => assert.fail('no download expected for a local checkout');
  assert.equal(await fetchAsset(source, tuiAsset, 'local', {}, unused), null);
  const directory = await mkdtemp(join(tmpdir(), 'website-tui-'));
  try {
    await writeFile(join(directory, 'devlanes_tui_web.js'), 'export {}');
    await writeFile(join(directory, 'devlanes_tui_web_bg.wasm'), wasm);
    const files = await fetchAsset(
      source,
      tuiAsset,
      'local',
      { DEVLANES_TUI_DIR: directory },
      unused
    );
    assert.deepEqual([...files.keys()].sort(), ['devlanes_tui_web.js', 'devlanes_tui_web_bg.wasm']);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('reads GNU and POSIX archives and refuses nested paths', () => {
  const gnu = untar(tarball({ 'a.js': 'a' }, 'ustar  \0'));
  assert.equal(gnu.get('a.js').toString(), 'a');
  const large = 'x'.repeat(700);
  const posix = untar(tarball({ 'a.js': large, 'b.wasm': wasm }));
  assert.equal(posix.get('a.js').toString(), large);
  assert.deepEqual(posix.get('b.wasm'), wasm);
  assert.throws(() => untar(tarball({ '../escape.js': 'a' })), /Unexpected path/);
  assert.throws(() => untar(tarball({ 'nested/a.js': 'a' })), /Unexpected path/);
});

test('validates the TUI web files before publishing them', () => {
  const [name, , { requires }] = tuiAsset;
  const files = (module) =>
    new Map([
      ['devlanes_tui_web.js', Buffer.from('export {}')],
      ['devlanes_tui_web_bg.wasm', module]
    ]);
  validateAsset(name, files(wasm), requires);
  assert.throws(
    () => validateAsset(name, files(Buffer.from('<!doctype html>')), requires),
    /not a WebAssembly module/
  );
  assert.throws(
    () => validateAsset(name, new Map([['devlanes_tui_web.js', Buffer.from('')]]), requires),
    /has no devlanes_tui_web_bg.wasm/
  );
});
