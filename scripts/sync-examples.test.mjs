import assert from 'node:assert/strict';
import test from 'node:test';
import { siteLinks } from './sync-examples.mjs';

test('points GitHub links at the site only where the site has the page', () => {
  const slugs = new Set(['basics-hello-node']);
  const docs = 'https://github.com/devlanes-run/devlanes/blob/main/docs';
  const examples = 'https://github.com/devlanes-run/examples';
  const cases = [
    [`[a](${docs}/guides/infra.md#per-lane)`, '[a](/docs/guides/infra/#per-lane)'],
    [`[a](${docs}/README.md)`, '[a](/docs/)'],
    [`[a](${docs}/errors/README.md)`, '[a](/docs/errors/)'],
    [`[a](${examples}/blob/abc123/basics-hello-node)`, '[a](/examples/basics-hello-node/)'],
    // Files of an example, examples the site does not have and other repositories stay.
    [`[a](${examples}/blob/abc123/basics-hello-node/devlanes.yaml)`, null],
    [`[a](${examples}/blob/abc123/languages-polyglot)`, null],
    ['[a](https://github.com/devlanes-run/devlanes/blob/main/install.sh)', null],
    ['[a](https://github.com/devlanes-run/action)', null]
  ];
  for (const [markdown, expected] of cases) {
    assert.equal(siteLinks(markdown, slugs), expected ?? markdown);
  }
});
