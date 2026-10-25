import assert from 'node:assert/strict';
import test from 'node:test';
import { latestRelease, resolveRef, sources, validateFile } from './sync.mjs';

const [source] = sources;
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

test('sends the token only to the GitHub API', async () => {
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
