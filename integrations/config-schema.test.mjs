import assert from 'node:assert/strict';
import test from 'node:test';
import { describeKeys } from './config-schema.mjs';

// The shapes schemars emits for the devlanes config: optional fields as `anyOf` with null,
// structs closed with `additionalProperties: false`, maps as `additionalProperties` schemas.
const schema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    services: {
      description: 'Services.',
      type: 'object',
      additionalProperties: { $ref: '#/$defs/Service', description: 'One service.' }
    },
    labels: { description: 'Free-form labels.', type: 'object' }
  },
  $defs: {
    Service: {
      type: 'object',
      additionalProperties: false,
      properties: {
        run: { anyOf: [{ $ref: '#/$defs/Run' }, { type: 'null' }] },
        hosts: { description: 'Hosts.', type: 'array', items: { $ref: '#/$defs/Host' } }
      }
    },
    Run: {
      description: 'Command.',
      anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }]
    },
    Host: {
      type: 'object',
      additionalProperties: false,
      properties: { host: { description: 'Hostname.', type: 'string' } }
    }
  }
};

test('describes keys through refs, nullable unions, maps and lists', () => {
  const source =
    'services:\n  api:\n    run: node server.mjs\n    hosts:\n      - host: api.test\n';
  const { keys, unknown } = describeKeys(source, schema);
  assert.deepEqual(unknown, []);
  assert.deepEqual(
    keys.map(({ start, end, path, description }) => [source.slice(start, end), path, description]),
    [
      ['services', 'services', 'Services.'],
      ['api', 'services.<name>', 'One service.'],
      ['run', 'services.<name>.run', 'Command.'],
      ['hosts', 'services.<name>.hosts', 'Hosts.'],
      ['host', 'services.<name>.hosts[].host', 'Hostname.']
    ]
  );
});

test('reports keys only where the schema closes the object', () => {
  const cases = [
    ['servics:\n  api: {}\n', ['servics']],
    ['services:\n  api:\n    prot: 3000\n', ['services.api.prot']],
    ['services:\n  api:\n    hosts:\n      - hostname: x\n', ['services.api.hosts[].hostname']],
    ['services:\n  api:\n    run:\n      cmd: x\n', ['services.api.run.cmd']],
    ['labels:\n  anything: goes\n', []]
  ];
  for (const [source, expected] of cases) {
    assert.deepEqual(
      describeKeys(source, schema).unknown.map((key) => key.path),
      expected,
      source
    );
  }
});
