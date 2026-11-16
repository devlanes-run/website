import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { markdownToHtml } from 'satteri';
import { docsDirectives, inlineSvg } from './directives.mjs';

const dir = mkdtempSync(join(tmpdir(), 'directives-'));
const page = pathToFileURL(join(dir, 'page.md'));
writeFileSync(
  join(dir, 'flow.svg'),
  '<?xml version="1.0"?>\n<svg viewBox="0 0 10 10"><defs><marker id="arrow"/></defs><path marker-end="url(#arrow)"/></svg>'
);

const render = async (markdown, url = page) => {
  const result = await markdownToHtml(markdown, {
    features: { directive: true },
    mdastPlugins: [docsDirectives(url)]
  });
  return result.html;
};

test('tabs keep every tab under its label, with its sync key', async () => {
  const html = await render(
    '::::tabs{sync="os"}\n:::tab[macOS]\nOn a Mac.\n\n```sh\nbrew install devlanes\n```\n:::\n:::tab[Linux]\nOn Linux.\n:::\n::::'
  );
  assert.match(html, /^<div class="dl-tabs" data-sync="os">/);
  assert.match(
    html,
    /<section class="dl-tab" data-label="macOS"><p class="dl-tab-label">macOS<\/p><p>On a Mac\.<\/p><pre>/
  );
  assert.match(
    html,
    /<section class="dl-tab" data-label="Linux"><p class="dl-tab-label">Linux<\/p><p>On Linux\.<\/p><\/section>/
  );
});

test('steps wrap one ordered list', async () => {
  const html = await render(':::steps\n1. Install.\n2. Run `devlanes daemon pair`.\n:::');
  assert.match(html, /^<div class="dl-steps"><ol>\n<li>Install\.<\/li>/);
});

test('a comparison has a titled column per side, without the colon after each command', async () => {
  const html = await render(
    '::::compare\n:::side[The usual way]\n- `ssh -L 1:2 box`: one forward per port.\n:::\n:::side[With devlanes]\n- `devlanes remote connect box`: one command.\n:::\n::::'
  );
  assert.match(
    html,
    /<p class="dl-compare-title">The usual way<\/p><ul>\n<li><code>ssh -L 1:2 box<\/code>one forward per port\.<\/li>/
  );
  assert.equal(html.match(/dl-compare-side/g)?.length, 2);
});

test('the TUI embed opens a view and stays hidden until the bundle loads', async () => {
  const html = await render('::tui{view="daemon"}');
  assert.match(html, /^<div class="dl-tui not-content" data-tui-optional hidden>/);
  assert.match(html, /data-view="daemon"/);
  assert.match(html, /id="tui-page-1"/);
});

test('diagrams are inlined with their alt text as the label', async () => {
  const html = await render('![A box and a laptop](flow.svg)');
  assert.match(
    html,
    /<svg viewBox="0 0 10 10" class="dl-diagram" role="img" aria-label="A box and a laptop">/
  );
  assert.match(html, /<marker id="d1-arrow"\/><\/defs><path marker-end="url\(#d1-arrow\)"\/>/);
  assert.doesNotMatch(html, /<\?xml/);
});

test('other images are left to Astro', async () => {
  assert.match(await render('![A photo](photo.png)'), /<img src="photo.png" alt="A photo"/);
});

test('mistakes fail with the file and line', async () => {
  const cases = [
    [
      'Text.\n\n::tui{view="logs"}',
      /page\.md:3: ::tui needs view set to one of lanes, monitor, daemon, boxes/
    ],
    ['![](flow.svg)', /needs alt text/],
    ['![A diagram](missing.svg)', /does not exist next to the page/],
    [':::tab[macOS]\nText.\n:::', /:::tab belongs inside ::::tabs/],
    ['::::tabs\nText.\n::::', /holds only :::tab blocks/],
    ['::::tabs\n:::tab\nText.\n:::\n::::', /:::tab needs a label/],
    [':::steps\n- Unordered.\n:::', /one numbered list/],
    [':::side[A]\nText.\n:::', /:::side belongs inside ::::compare/]
  ];
  for (const [markdown, error] of cases) await assert.rejects(render(markdown), error);
});

test('headings of the config reference get the anchor of their path', async () => {
  const reference = new URL(
    '../src/content/docs/docs/reference/config/project/services.md',
    import.meta.url
  );
  const heading = '### `services.<name>.hosts[].host`';
  assert.match(await render(heading, reference), /<h3 id="services-name-hosts-host">/);
  assert.match(await render(heading), /<h3><code>/);
});

test('inlineSvg refuses what is not an SVG and replaces an existing label', () => {
  assert.throws(() => inlineSvg('<html></html>', 'x', 'p-'), /not an SVG/);
  assert.equal(
    inlineSvg('<svg role="presentation" class="wide"><g/></svg>', 'A "quoted" label', 'p-'),
    '<svg class="dl-diagram wide" role="img" aria-label="A &quot;quoted&quot; label"><g/></svg>'
  );
});
