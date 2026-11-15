import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { anchorFor, configReference } from './config-reference.mjs';
import { describeKeys } from './config-schema.mjs';

// Shapes the devlanes schema generator emits: optional fields as `anyOf` with null and
// placeholder metadata on the branches, `Templated_*` wrappers, maps as `additionalProperties`.
const placeholders = { description: '', markdownDescription: '', examples: [] };
const optional = (ref, extra) => ({
  anyOf: [{ $ref: `#/$defs/${ref}`, ...placeholders }, { type: 'null' }],
  ...extra
});

const project = {
  type: 'object',
  additionalProperties: false,
  examples: [{ services: { web: { run: 'pnpm dev' } } }],
  properties: {
    services: {
      type: 'object',
      description: 'Processes of a lane.',
      default: {},
      examples: [{ web: { run: 'pnpm dev' } }],
      additionalProperties: { $ref: '#/$defs/Service', description: 'One process.' }
    },
    jobs: {
      type: 'object',
      description: 'Jobs of a lane.',
      additionalProperties: { $ref: '#/$defs/Job', description: 'One job.' }
    },
    templates: {
      type: 'object',
      description: 'Settings services reuse.',
      additionalProperties: { $ref: '#/$defs/Service', description: 'One template.' }
    }
  },
  $defs: {
    Service: {
      type: 'object',
      additionalProperties: false,
      // biome-ignore lint/suspicious/noThenProperty: JSON Schema if/then
      allOf: [{ if: { required: ['vite'] }, then: { properties: { preset: { const: 'vite' } } } }],
      properties: {
        run: optional('Templated_string', { description: 'Command.', examples: ['pnpm dev'] }),
        ready: optional('Ready', {
          description: 'Readiness of the service.',
          examples: ['started']
        }),
        hosts: optional('Hosts', { description: 'Hostnames.' }),
        tags: {
          type: ['array', 'null'],
          description: 'Labels.',
          markdownDescription: 'Labels.',
          items: { type: 'string', description: 'Labels.' },
          examples: [['api']]
        },
        preset: { type: ['string', 'null'], enum: ['vite'], description: 'Framework.' },
        vite: {
          $ref: '#/$defs/ViteOptions',
          description: 'Vite options.',
          examples: [{ args: ['--open'] }]
        },
        env: {
          type: 'object',
          default: {},
          description: 'Variables.',
          examples: [{ NODE_ENV: 'development' }],
          additionalProperties: { $ref: '#/$defs/Templated_string', description: 'Variables.' }
        }
      }
    },
    Job: {
      type: 'object',
      additionalProperties: false,
      properties: { ready: optional('Ready', { description: 'Readiness of the job.' }) }
    },
    Ready: {
      anyOf: [
        { $ref: '#/$defs/Started', ...placeholders },
        { $ref: '#/$defs/ReadyCheck', ...placeholders }
      ],
      description: 'Shared readiness text.'
    },
    Started: {
      type: 'string',
      enum: ['started'],
      enumDescriptions: ['Ready once it runs.'],
      markdownEnumDescriptions: ['Ready once it runs.']
    },
    ReadyCheck: {
      type: 'object',
      additionalProperties: false,
      properties: {
        timeout: {
          $ref: '#/$defs/ConfigDuration',
          description: 'How long to wait.',
          default: '15000ms'
        }
      }
    },
    ConfigDuration: { type: 'string', pattern: '^[0-9]+(ms|s)$', description: 'A duration.' },
    Hosts: {
      anyOf: [
        { $ref: '#/$defs/Host', ...placeholders },
        { type: 'array', items: { $ref: '#/$defs/Host', description: 'Hostnames.' } }
      ]
    },
    Host: {
      anyOf: [
        { $ref: '#/$defs/Templated_string', ...placeholders },
        { $ref: '#/$defs/HostRoute', ...placeholders }
      ]
    },
    HostRoute: {
      type: 'object',
      additionalProperties: false,
      required: ['host'],
      properties: {
        host: { type: 'string', description: 'Hostname.', examples: ['web.test'] },
        port: { type: ['string', 'null'], description: 'Port name.', examples: ['http'] }
      }
    },
    ViteOptions: {
      type: 'object',
      additionalProperties: false,
      properties: {
        args: {
          type: 'array',
          items: { type: 'string' },
          description: 'Extra arguments.',
          examples: [['--open']]
        }
      }
    },
    Templated_string: {
      anyOf: [{ type: 'string' }, { type: 'string', pattern: '\\$\\{\\{' }],
      description: 'A value with expressions.'
    }
  }
};

const user = {
  type: 'object',
  additionalProperties: false,
  properties: {
    tui: {
      type: 'object',
      additionalProperties: false,
      description: 'Terminal UI.',
      properties: {
        theme: {
          type: 'string',
          enum: ['dark', 'light'],
          enumDescriptions: ['Dark colors.', 'Light colors.'],
          default: 'dark',
          description: 'Palette.'
        }
      }
    }
  }
};

const page = (reference, file) => reference.pages.find((item) => item.file === file)?.markdown;

/** The block of one entry: its heading up to the next heading. */
function entry(markdown, path) {
  const lines = markdown.split('\n');
  const start = lines.findIndex((line) => /^#{2,3} /.test(line) && line.endsWith(`\`${path}\``));
  if (start < 0) return undefined;
  const end = lines.findIndex((line, index) => index > start && /^#{2,3} /.test(line));
  return lines.slice(start, end < 0 ? undefined : end).join('\n');
}

const yamlBlocks = (markdown) =>
  [...markdown.matchAll(/^```yaml (devlanes(?:-user)?)\n([\s\S]*?)^```$/gm)].map(
    ([, fence, source]) => ({
      fence,
      source
    })
  );

test('anchors drop brackets and keep underscores', () => {
  assert.equal(anchorFor('services.<name>.ready.http.path'), 'services-name-ready-http-path');
  assert.equal(anchorFor('services.<name>.hosts[].host'), 'services-name-hosts-host');
  assert.equal(anchorFor('global_env.<name>'), 'global_env-name');
});

test('renders pages with frontmatter, sidebar order and no H1', () => {
  const reference = configReference({ project, user });
  assert.deepEqual(
    reference.pages.map((item) => item.file),
    [
      'reference/config/index.md',
      'reference/config/project/index.md',
      'reference/config/project/services.md',
      'reference/config/project/jobs.md',
      'reference/config/project/templates.md',
      'reference/config/user/index.md',
      'reference/config/user/tui.md'
    ]
  );
  reference.pages.forEach((item, index) => {
    assert.match(
      item.markdown,
      new RegExp(`^---\\n[\\s\\S]*sidebar:\\n  label: .+\\n  order: ${index}\\n`)
    );
    assert.doesNotMatch(item.markdown, /^# /m);
    const description = item.markdown.match(/^description: (.*)$/m)[1];
    assert.doesNotMatch(description, /`/);
  });
  assert.match(
    page(reference, 'reference/config/project/index.md'),
    /^- \[`jobs`\]\(\/docs\/reference\/config\/project\/jobs\/\): Jobs of a lane\.$/m
  );
});

test('documents a shared definition once and links the other paths to it', () => {
  const reference = configReference({ project, user });
  const jobs = page(reference, 'reference/config/project/jobs.md');
  const ready = entry(jobs, 'jobs.<name>.ready');
  assert.match(ready, /Readiness of the job\./);
  assert.doesNotMatch(ready, /Shared readiness text/);
  assert.match(
    ready,
    /Takes the same values and keys as \[`services.<name>.ready`\]\(\/docs\/reference\/config\/project\/services\/#services-name-ready\)\./
  );
  assert.equal(entry(jobs, 'jobs.<name>.ready.timeout'), undefined);
  assert.equal(
    reference.linkFor('project', 'jobs.<name>.ready.timeout'),
    '/docs/reference/config/project/services/#services-name-ready-timeout'
  );

  const templates = page(reference, 'reference/config/project/templates.md');
  assert.match(
    entry(templates, 'templates.<name>'),
    /One template\.\n\nTakes the same keys as \[`services.<name>`\]/
  );
  assert.equal(entry(templates, 'templates.<name>.run'), undefined);
  assert.equal(
    reference.linkFor('project', 'templates.<name>.ready'),
    '/docs/reference/config/project/services/#services-name-ready'
  );
});

test('reads types through refs, expressions, null branches and placeholders', () => {
  const reference = configReference({ project, user });
  const services = page(reference, 'reference/config/project/services.md');
  assert.match(entry(services, 'services'), /^Type: mapping of names to mappings\.$/m);
  assert.match(entry(services, 'services.<name>'), /^One process\.$/m);
  assert.match(
    entry(services, 'services.<name>.run'),
    /^Type: string or an \[expression\]\(\/docs\/reference\/expressions\/\)\.$/m
  );
  assert.match(
    entry(services, 'services.<name>.ready.timeout'),
    /^Type: \[duration\]\(\/docs\/reference\/config\/#durations\)\. Default: `15s`\.$/m
  );
  // The overview explains expressions once; entries only link there.
  for (const { file, markdown } of reference.pages) {
    assert.doesNotMatch(markdown, /null|\$\\\{|Default: `\{\}`/, file);
    if (file !== 'reference/config/index.md')
      assert.doesNotMatch(markdown, /A value with expressions/, file);
  }
});

test('pairs enum values with their descriptions, also through a one-value ref', () => {
  const reference = configReference({ project, user });
  const ready = entry(
    page(reference, 'reference/config/project/services.md'),
    'services.<name>.ready'
  );
  assert.match(ready, /^Type: `started` or mapping\.$/m);
  assert.equal(ready.match(/^- `started`: Ready once it runs\.$/gm)?.length, 1);
  const theme = entry(page(reference, 'reference/config/user/tui.md'), 'tui.theme');
  assert.match(theme, /^Type: string\. Default: `dark`\.$/m);
  assert.match(theme, /^- `dark`: Dark colors\.\n- `light`: Light colors\.$/m);
});

test('gives a key that takes one entry or a list a single entry in list form', () => {
  const reference = configReference({ project, user });
  const services = page(reference, 'reference/config/project/services.md');
  assert.match(
    entry(services, 'services.<name>.hosts'),
    /^Type: string, mapping or an \[expression\]\(\/docs\/reference\/expressions\/\), or a list of these\.$/m
  );
  assert.ok(entry(services, 'services.<name>.hosts[].host'));
  assert.equal(entry(services, 'services.<name>.hosts.host'), undefined);
  const url = '/docs/reference/config/project/services/#services-name-hosts-host';
  assert.equal(reference.linkFor('project', 'services.<name>.hosts.host'), url);
  assert.equal(reference.linkFor('project', 'services.<name>.hosts[].host'), url);
});

test('skips descriptions that repeat the list or map they belong to', () => {
  const reference = configReference({ project, user });
  const services = page(reference, 'reference/config/project/services.md');
  assert.equal(entry(services, 'services.<name>.tags').match(/Labels\./g).length, 1);
  assert.equal(entry(services, 'services.<name>.env.<name>'), undefined);
  assert.match(
    entry(services, 'services.<name>.env'),
    /^Type: mapping of names to strings or \[expressions\]\(\/docs\/reference\/expressions\/\)\.$/m
  );
  assert.equal(
    reference.linkFor('project', 'services.<name>.env.<name>'),
    '/docs/reference/config/project/services/#services-name-env'
  );
});

test('prints examples as YAML nested under their parents', () => {
  const reference = configReference({ project, user });
  const services = page(reference, 'reference/config/project/services.md');
  const example = (path) => yamlBlocks(entry(services, path))[0]?.source;
  // `web` is the first name in the example of `services`.
  assert.equal(example('services.<name>.tags'), 'services:\n  web:\n    tags:\n      - api\n');
  // A required sibling and the preset a key depends on are filled in.
  assert.equal(
    example('services.<name>.hosts[].port'),
    'services:\n  web:\n    hosts:\n      - host: web.test\n        port: http\n'
  );
  assert.match(entry(services, 'services.<name>.vite'), /^Type: mapping, with `preset: vite`\.$/m);
  assert.equal(
    example('services.<name>.vite.args'),
    'services:\n  web:\n    preset: vite\n    vite:\n      args:\n        - --open\n'
  );
  // Without examples, a default or a single enum value is used, and otherwise nothing.
  assert.equal(
    example('services.<name>.ready.timeout'),
    'services:\n  web:\n    ready:\n      timeout: 15s\n'
  );
  assert.equal(example('services.<name>.preset'), 'services:\n  web:\n    preset: vite\n');
  assert.equal(example('services.<name>.hosts'), undefined);
  assert.equal(
    yamlBlocks(entry(page(reference, 'reference/config/user/tui.md'), 'tui.theme'))[0].fence,
    'devlanes-user'
  );
});

// The real schemas, as `pnpm sync` copies them from devlanes.
const schemaFiles = {
  project: new URL('../public/v1/schema.json', import.meta.url),
  user: new URL('../public/v1/user-schema.json', import.meta.url)
};
const haveSchemas = Object.values(schemaFiles).every((file) => existsSync(file));
const realSchemas = () =>
  haveSchemas &&
  Object.fromEntries(
    Object.entries(schemaFiles).map(([kind, file]) => [
      kind,
      JSON.parse(readFileSync(file, 'utf8'))
    ])
  );

/** Every key path the schema allows, in the form `describeKeys` reports, one-entry forms included. */
function keyPaths(schema) {
  const resolve = (ref) =>
    ref
      .slice(2)
      .split('/')
      .reduce((node, part) => node[part], schema);
  const paths = new Set();
  const visit = (node, path, stack) => {
    if (typeof node !== 'object' || node === null || stack.includes(node)) return;
    const next = [...stack, node];
    if (node.$ref) visit(resolve(node.$ref), path, next);
    for (const branch of [...(node.anyOf ?? []), ...(node.oneOf ?? [])]) visit(branch, path, next);
    for (const [name, child] of Object.entries(node.properties ?? {})) {
      const childPath = path ? `${path}.${name}` : name;
      paths.add(childPath);
      visit(child, childPath, next);
    }
    if (typeof node.additionalProperties === 'object') {
      paths.add(`${path}.<name>`);
      visit(node.additionalProperties, `${path}.<name>`, next);
    }
    if (typeof node.items === 'object') visit(node.items, `${path}[]`, next);
  };
  visit(schema, '', []);
  return [...paths];
}

test('real schemas: every key path links to an entry that exists', (t) => {
  const schemas = realSchemas();
  if (!schemas) return t.skip('public/v1 schemas are missing; run pnpm sync');
  const reference = configReference(schemas);
  const anchors = new Map();
  for (const { file, markdown } of reference.pages) {
    const url = `/docs/${file.replace(/(index)?\.md$/, '').replace(/([^/])$/, '$1/')}`;
    const headings = [...markdown.matchAll(/^#{2,3} `(.+)`$/gm)].map(([, path]) => anchorFor(path));
    assert.equal(new Set(headings).size, headings.length, `duplicate anchors in ${file}`);
    for (const anchor of headings) anchors.set(`${url}#${anchor}`, file);
  }
  for (const kind of ['project', 'user']) {
    const paths = keyPaths(schemas[kind]);
    assert.ok(paths.length > 20);
    for (const path of paths) {
      const url = reference.linkFor(kind, path);
      assert.ok(url && anchors.has(url), `${kind} ${path} links to ${url}, which has no entry`);
    }
  }
});

test('real schemas: pages hold no tables, definition names, patterns or null', (t) => {
  const schemas = realSchemas();
  if (!schemas) return t.skip('public/v1 schemas are missing; run pnpm sync');
  const reference = configReference(schemas);
  const patterns = new Set();
  const descriptions = [];
  const collect = (node) => {
    if (Array.isArray(node)) node.forEach(collect);
    else if (typeof node === 'object' && node !== null) {
      for (const [key, value] of Object.entries(node)) {
        if (key === 'pattern' && typeof value === 'string') patterns.add(value);
        else if (/description/i.test(key) && typeof value === 'string') descriptions.push(value);
        else if (/description/i.test(key) && Array.isArray(value))
          descriptions.push(...value.filter((item) => typeof item === 'string'));
        collect(value);
      }
    }
  };
  collect(schemas);
  // A definition name the schema's own prose uses as a word, such as "Run", is not a leak.
  const names = Object.values(schemas)
    .flatMap((schema) => Object.keys(schema.$defs ?? {}))
    .filter((name) => !descriptions.some((text) => new RegExp(`\\b${name}\\b`).test(text)));
  assert.ok(names.includes('ServiceConfig'));
  for (const { file, markdown } of reference.pages) {
    assert.doesNotMatch(markdown, /^\s*\|.*\|\s*$/m, `${file} has a table`);
    assert.doesNotMatch(markdown, /\bnull\b/, `${file} says null`);
    for (const name of names)
      assert.doesNotMatch(markdown, new RegExp(`\\b${name}\\b`), `${file} names ${name}`);
    for (const pattern of patterns)
      assert.ok(!markdown.includes(pattern), `${file} prints the pattern ${pattern}`);
  }
});

test('real schemas: every example block uses only keys the schema allows', (t) => {
  const schemas = realSchemas();
  if (!schemas) return t.skip('public/v1 schemas are missing; run pnpm sync');
  const reference = configReference(schemas);
  let blocks = 0;
  for (const { file, markdown } of reference.pages) {
    for (const { fence, source } of yamlBlocks(markdown)) {
      blocks++;
      const { keys, unknown } = describeKeys(
        source,
        fence === 'devlanes' ? schemas.project : schemas.user
      );
      assert.deepEqual(unknown, [], `${file}:\n${source}`);
      assert.ok(keys.length, `${file} has an example without keys`);
    }
  }
  assert.ok(blocks > 100);
});
