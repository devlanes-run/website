import assert from 'node:assert/strict';
import test from 'node:test';
import { downloadRelease } from './sync-release.mjs';

const base = 'https://github.com/devlanes-run/devlanes/releases/download/v1.2.3/';
const release = {
  tag_name: 'v1.2.3',
  draft: false,
  prerelease: false,
  assets: ['schema.json', 'user-schema.json', 'install.sh'].map((name) => ({
    name,
    browser_download_url: base + name
  }))
};

test('downloads a consistent release without forwarding API credentials to assets', async () => {
  const calls = [];
  const result = await downloadRelease(async (url, options) => {
    calls.push({ url, options });
    if (url.includes('/releases/latest')) return Response.json(release);
    return new Response(
      url.endsWith('.json')
        ? JSON.stringify({
            $schema: 'https://json-schema.org/draft/2020-12/schema',
            $id: 'https://devlanes.run/v1/schema.json'
          })
        : '#!/bin/sh\necho install\n'
    );
  }, 'test-token');
  assert.equal(result.tag, 'v1.2.3');
  assert.deepEqual(
    result.files.map((file) => file.path),
    ['v1/schema.json', 'v1/user-schema.json', 'install.sh']
  );
  assert.equal(calls[0].options.headers.Authorization, 'Bearer test-token');
  assert.ok(calls.slice(1).every((call) => call.url.startsWith(base) && !call.options.headers));
});

test('allows the pre-release site to build before its first stable release', async () => {
  assert.equal(await downloadRelease(async () => new Response(null, { status: 404 })), null);
});

test('fails on missing assets and API failures rather than deploying incomplete files', async () => {
  await assert.rejects(
    downloadRelease(async () => Response.json({ ...release, assets: [] })),
    /missing/
  );
  await assert.rejects(
    downloadRelease(async () => new Response(null, { status: 403 })),
    /403/
  );
});

test('rejects invalid downloaded schemas', async () => {
  await assert.rejects(
    downloadRelease(async (url) =>
      url.includes('/releases/latest')
        ? Response.json(release)
        : new Response(url.endsWith('.json') ? '{}' : '#!/bin/sh\n')
    ),
    /Invalid schema/
  );
});
