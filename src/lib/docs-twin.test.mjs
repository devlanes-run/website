import assert from 'node:assert/strict';
import test from 'node:test';
import { twinMarkdown } from './docs-twin.mjs';

test('tabs and comparison sides become their labels over their content', () => {
  const body = [
    'Install it.',
    '',
    '::::tabs{sync="os"}',
    ':::tab[macOS]',
    'On a Mac.',
    ':::',
    ':::tab[Linux]',
    'On Linux.',
    ':::',
    '::::',
    '',
    '::::compare',
    ':::side[The usual way]',
    '- `ssh -L`: one per port.',
    ':::',
    '::::',
    'After.'
  ].join('\n');
  assert.equal(
    twinMarkdown(body),
    [
      'Install it.',
      '',
      '**macOS**',
      '',
      'On a Mac.',
      '',
      '**Linux**',
      '',
      'On Linux.',
      '',
      '**The usual way**',
      '',
      '- `ssh -L`: one per port.',
      '',
      'After.'
    ].join('\n')
  );
});

test('steps keep their list, the TUI goes, diagrams leave their alt text, asides stay', () => {
  const body = [
    ':::steps',
    '1. One.',
    '2. Two.',
    ':::',
    '',
    '::tui{view="monitor"}',
    '',
    '![A box and a laptop](remote.svg)',
    '',
    ':::caution',
    'Careful.',
    ':::',
    '',
    '![A photo](photo.png) and ![Remote](https://example.com/a.svg)'
  ].join('\n');
  assert.equal(
    twinMarkdown(body),
    [
      '1. One.',
      '2. Two.',
      '',
      '*Diagram: A box and a laptop*',
      '',
      ':::caution',
      'Careful.',
      ':::',
      '',
      '![A photo](photo.png) and ![Remote](https://example.com/a.svg)'
    ].join('\n')
  );
});

test('code blocks are left alone', () => {
  const body = '```markdown\n::::tabs\n:::tab[A]\n\n\nx\n:::\n::::\n```';
  assert.equal(twinMarkdown(body), body);
});
