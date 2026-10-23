import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isPublished,
  parseLastUpdated,
  rewriteLinks,
  routeFor,
  toStarlightPage
} from './sync-docs.mjs';

const source = {
  repository: 'acme/tool',
  editBranch: 'main',
  path: 'docs',
  target: 'docs',
  order: ['getting-started.md']
};
const context = { source, commit: 'abc123', unpublished: new Set(['milestones/m1.md']) };
const blob = 'https://github.com/acme/tool/blob/abc123';
const raw = 'https://raw.githubusercontent.com/acme/tool/abc123';

test('maps source files to the routes Starlight generates', () => {
  assert.equal(routeFor(source, 'README.md'), '/docs/');
  assert.equal(routeFor(source, 'guides/Run Scripts.md'), '/docs/guides/run-scripts/');
  assert.equal(routeFor(source, 'milestones/M0.md'), '/docs/milestones/m0/');
});

test('rewrites links to site routes, or to the pinned source on GitHub', () => {
  const markdown = [
    '[guide](guides/infra.md#volumes) [readme](../README.md) [schema](https://example.com/a.md)',
    '[example](examples/minimal.yaml) [top](#install) [spaced](guides/Run%20Scripts.md)',
    '[internal](milestones/m1.md) [ref]: reference/cli.md',
    '[ref]: reference/cli.md',
    '`[not](a.md)` stays in code',
    '```md',
    '[also](kept.md)',
    '```'
  ].join('\n');
  assert.equal(
    rewriteLinks(markdown, 'getting-started.md', context),
    [
      `[guide](/docs/guides/infra/#volumes) [readme](${blob}/README.md) [schema](https://example.com/a.md)`,
      `[example](${blob}/docs/examples/minimal.yaml) [top](#install) [spaced](/docs/guides/run-scripts/)`,
      `[internal](${blob}/docs/milestones/m1.md) [ref]: reference/cli.md`,
      '[ref]: /docs/reference/cli/',
      '`[not](a.md)` stays in code',
      '```md',
      '[also](kept.md)',
      '```'
    ].join('\n')
  );
});

test('keeps Markdown images in the docs for Astro and serves the rest from GitHub', () => {
  const markdown = [
    '![lanes](images/lanes.png) ![logo](../assets/logo.svg)',
    '[![badge](images/badge.svg)](guides/infra.md)',
    '<img src="images/tui.png" alt="TUI"> <a href="guides/infra.md">infra</a>',
    '[diagram]: images/flow.png'
  ].join('\n');
  assert.equal(
    rewriteLinks(markdown, 'getting-started.md', context),
    [
      `![lanes](images/lanes.png) ![logo](${raw}/assets/logo.svg)`,
      '[![badge](images/badge.svg)](/docs/guides/infra/)',
      `<img src="${raw}/docs/images/tui.png" alt="TUI"> <a href="/docs/guides/infra/">infra</a>`,
      `[diagram]: ${raw}/docs/images/flow.png`
    ].join('\n')
  );
});

test('takes each page date from the newest commit that touched it', () => {
  const log = [
    '\x1f2026-10-20T10:00:00-03:00',
    '',
    'docs/getting-started.md',
    'src/main.rs',
    '\x1f2026-09-01T09:00:00Z',
    '',
    'docs/getting-started.md',
    'docs/guides/infra.md',
    ''
  ].join('\n');
  assert.deepEqual(Object.fromEntries(parseLastUpdated(log, 'docs')), {
    'getting-started.md': '2026-10-20T10:00:00-03:00',
    'guides/infra.md': '2026-09-01T09:00:00Z'
  });
  const page = toStarlightPage('# Infra\n', 'guides/infra.md', {
    ...context,
    updated: new Map([['guides/infra.md', '2026-09-01T09:00:00Z']])
  });
  assert.match(page, /^lastUpdated: 2026-09-01T09:00:00Z$/m);
});

test('only publish: false hides a page', () => {
  assert.equal(isPublished('# Page\n'), true);
  assert.equal(isPublished('---\npublish: true\n---\n# Page\n'), true);
  assert.equal(isPublished('---\ntitle: Notes\npublish: false # internal\n---\n'), false);
  assert.equal(isPublished('# Page\n\n```yaml\npublish: false\n```\n'), true);
});

test('moves the leading heading and first sentence into Starlight frontmatter', () => {
  const page = toStarlightPage(
    '# Getting started\n\nInstall `devlanes` first. Then add a config.\n\n## Install\n',
    'getting-started.md',
    context
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

test('keeps existing frontmatter, minus the importer-only publish key', () => {
  const page = toStarlightPage(
    '---\ntitle: Custom\npublish: true\ndescription: Kept.\n---\nIntro.\n\n# Later heading\n',
    'guides/infra.md',
    context
  );
  assert.match(page, /^---\ntitle: Custom\ndescription: Kept\.\ntableOfContents: false\neditUrl: /);
  assert.doesNotMatch(page, /publish:/);
  assert.match(page, /# Later heading/);
  assert.doesNotMatch(page, /sidebar:/);
});
