import assert from 'node:assert/strict';
import test from 'node:test';
import { parseConsole } from './console-blocks.mjs';

test('lines starting with a prompt are commands; the copy takes them without the prompt', () => {
  const { kinds, copy } = parseConsole(
    '$ devlanes daemon pair\npairing code: K7QM-3XWD\nit works once and expires in 10 minutes'
  );
  assert.deepEqual(
    kinds.map(({ command }) => command),
    [true, false, false]
  );
  assert.equal(kinds[0]?.prompt, 2);
  assert.equal(copy, 'devlanes daemon pair');
});

test('PowerShell prompts and continued commands', () => {
  const { kinds, copy } = parseConsole(
    'PS> irm https://devlanes.run/install.ps1 | iex\ninstalled\n$ devlanes start \\\n    --profile prod\nmyapp@0: ready'
  );
  assert.deepEqual(
    kinds.map(({ command, prompt }) => [command, prompt]),
    [
      [true, 4],
      [false, 0],
      [true, 2],
      [true, 0],
      [false, 0]
    ]
  );
  assert.equal(
    copy,
    'irm https://devlanes.run/install.ps1 | iex\ndevlanes start \\\n    --profile prod'
  );
});

test('a block with no command has nothing to copy', () => {
  assert.equal(parseConsole('myapp@0 (main): 2/2 ready\n$notaprompt').copy, '');
});
