import assert from 'node:assert/strict';
import test from 'node:test';
import { groupDocs, isGroup, pagesOf, parseNav } from './docs-nav.mjs';

const nav = parseNav(`
- label: Start
  items: [index, install]
- label: Learn
  sequence: true
  items: [learn/first-service, learn/worktrees]
- label: How-to guides
  items:
    - label: Projects
      collapsed: true
      items: [how-to/projects/migrate, how-to/projects/add-devlanes]
    - how-to/wsl
- label: Reference
  items:
    - reference/cli
    - reference/cli/*
- label: Proxy errors
  collapsed: true
  items: [errors, errors/*]
`);

const page = (id, order) => ({ id, order });
const pages = [
  page('docs'),
  page('docs/install'),
  page('docs/learn/worktrees'),
  page('docs/learn/first-service'),
  page('docs/how-to/projects/add-devlanes'),
  page('docs/how-to/projects/migrate'),
  page('docs/how-to/wsl'),
  page('docs/reference/cli'),
  page('docs/reference/cli/start'),
  page('docs/reference/cli/attach'),
  page('docs/reference/cli/stop', 1),
  page('docs/errors'),
  page('docs/errors/unknown-host'),
  page('docs/troubleshooting')
];

/** Each group as its label and items: ids, or nested groups. */
const shape = (group) => ({
  label: group.label,
  items: group.items.map((item) => (isGroup(item) ? shape(item) : item.id))
});

test('files pages in nav order, wildcards by sidebar order then id, groups one level down', () => {
  const { groups, missing, unfiled } = groupDocs(pages, nav);
  assert.deepEqual(groups.map(shape), [
    { label: 'Start', items: ['docs', 'docs/install'] },
    { label: 'Learn', items: ['docs/learn/first-service', 'docs/learn/worktrees'] },
    {
      label: 'How-to guides',
      items: [
        {
          label: 'Projects',
          items: ['docs/how-to/projects/migrate', 'docs/how-to/projects/add-devlanes']
        },
        'docs/how-to/wsl'
      ]
    },
    {
      label: 'Reference',
      items: [
        'docs/reference/cli',
        'docs/reference/cli/stop',
        'docs/reference/cli/attach',
        'docs/reference/cli/start'
      ]
    },
    {
      label: 'Proxy errors',
      items: ['docs/errors', 'docs/errors/unknown-host', 'docs/troubleshooting']
    }
  ]);
  assert.deepEqual(missing, []);
  assert.deepEqual(
    unfiled.map(({ id }) => id),
    ['docs/troubleshooting']
  );
  assert.equal(groups[1]?.sequence, true);
  assert.equal(groups[2]?.items[0]?.collapsed, true);
});

test('paths that name no page are reported and empty groups dropped', () => {
  const { groups, missing } = groupDocs([page('docs')], nav);
  assert.deepEqual(groups.map(shape), [{ label: 'Start', items: ['docs'] }]);
  assert.deepEqual(missing, [
    'install',
    'learn/first-service',
    'learn/worktrees',
    'how-to/projects/migrate',
    'how-to/projects/add-devlanes',
    'how-to/wsl',
    'reference/cli',
    'errors'
  ]);
});

test('without a nav file every page is in one group', () => {
  const { groups } = groupDocs([page('docs/b'), page('docs/a')], null);
  assert.deepEqual(
    pagesOf(groups[0]).map(({ id }) => id),
    ['docs/a', 'docs/b']
  );
});

test('malformed nav files fail', () => {
  assert.throws(() => parseNav('label: Start'), /must be a list of groups/);
  assert.throws(() => parseNav('- items: [index]'), /a group needs a label/);
  assert.throws(
    () => parseNav('- label: A\n  items: [index]\n  sequnce: true'),
    /unknown key sequnce/
  );
  assert.throws(
    () =>
      parseNav(
        '- label: A\n  items:\n    - label: B\n      items:\n        - label: C\n          items: [index]'
      ),
    /groups nest one level only/
  );
});
