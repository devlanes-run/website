import assert from 'node:assert/strict';
import test from 'node:test';
import { rewriteLinks, routeFor, toStarlightPage } from './sync-docs.mjs';

const source = {
  repository: 'acme/tool',
  ref: 'main',
  path: 'docs',
  target: 'docs',
  order: ['getting-started.md']
};
const commit = 'abc123';

test('maps source files to the routes Starlight generates', () => {
  assert.equal(routeFor(source, 'README.md'), '/docs/');
  assert.equal(routeFor(source, 'guides/Run Scripts.md'), '/docs/guides/run-scripts/');
  assert.equal(routeFor(source, 'milestones/M0.md'), '/docs/milestones/m0/');
});

test('rewrites links to site routes, local images or the pinned source on GitHub', () => {
  const markdown = [
    '[guide](guides/infra.md#volumes) [readme](../README.md) [schema](https://example.com/a.md)',
    '![diagram](images/lanes.png) [example](examples/minimal.yaml) [top](#install)',
    '[ref]: reference/cli.md',
    '`[not](a.md)` stays in code',
    '```md',
    '[also](kept.md)',
    '```'
  ].join('\n');
  assert.equal(
    rewriteLinks(markdown, 'getting-started.md', source, commit),
    [
      '[guide](/docs/guides/infra/#volumes) [readme](https://github.com/acme/tool/blob/abc123/README.md) [schema](https://example.com/a.md)',
      '![diagram](images/lanes.png) [example](https://github.com/acme/tool/blob/abc123/docs/examples/minimal.yaml) [top](#install)',
      '[ref]: /docs/reference/cli/',
      '`[not](a.md)` stays in code',
      '```md',
      '[also](kept.md)',
      '```'
    ].join('\n')
  );
});

test('moves the leading heading and first sentence into Starlight frontmatter', () => {
  const page = toStarlightPage(
    '# Getting started\n\nInstall `devlanes` first. Then add a config.\n\n## Install\n',
    'getting-started.md',
    source,
    commit
  );
  assert.equal(
    page,
    [
      '---',
      'title: "Getting started"',
      'description: "Install devlanes first."',
      'editUrl: https://github.com/acme/tool/edit/main/docs/getting-started.md',
      'sidebar:',
      '  order: 1',
      '---',
      '',
      'Install `devlanes` first. Then add a config.',
      '',
      '## Install',
      ''
    ].join('\n')
  );
});

test('keeps existing frontmatter and a heading that is not the first block', () => {
  const page = toStarlightPage(
    '---\ntitle: Custom\ndescription: Kept.\n---\nIntro.\n\n# Later heading\n',
    'guides/infra.md',
    source,
    commit
  );
  assert.match(page, /^---\ntitle: Custom\ndescription: Kept\.\neditUrl: /);
  assert.match(page, /# Later heading/);
  assert.doesNotMatch(page, /sidebar:/);
});
