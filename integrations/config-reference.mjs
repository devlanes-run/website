// Builds the config reference pages (/docs/reference/config/...) from the JSON Schemas of
// devlanes.yaml and ~/.devlanes/config.yaml. Every key at every depth gets one entry headed by its
// dotted path; a definition reached from several paths is documented once and linked elsewhere.
// requirements.md, "Config reference generated from the JSON Schemas", has the rules.
import { stringify } from 'yaml';

const route = '/docs/reference/config/';
const expressionsRoute = '/docs/reference/expressions/';

const kinds = {
  project: {
    dir: 'project',
    file: 'devlanes.yaml',
    shortFile: 'devlanes.yaml',
    fence: 'devlanes',
    title: 'Project file reference',
    label: 'Project file (devlanes.yaml)'
  },
  user: {
    dir: 'user',
    file: '~/.devlanes/config.yaml',
    shortFile: 'config.yaml',
    fence: 'devlanes-user',
    title: 'User file reference',
    label: 'User file (config.yaml)'
  }
};

// Shared definitions are documented under `services` when they occur there, since readers look
// for `ready` and `hosts` there first; everything else goes to the first key that uses it.
const documentFirst = ['services'];

// String definitions with a fixed format. The type line names them and links to the overview,
// which explains each once; the definition names themselves are never printed.
const formats = {
  ConfigDuration: { one: 'duration', many: 'durations', heading: 'Durations' },
  ByteSize: { one: 'byte size', many: 'byte sizes', heading: 'Byte sizes' },
  Percent: { one: 'percentage', many: 'percentages', heading: 'Percentages' }
};

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const code = (value) => `\`${typeof value === 'string' ? value : JSON.stringify(value)}\``;
const join = (path, segment) => (path ? `${path}.${segment}` : segment);

/** Anchor of a reference path: `services.<name>.hosts[].host` becomes `services-name-hosts-host`. */
export function anchorFor(path) {
  return path
    .toLowerCase()
    .replace(/[<>]|\[\]/g, '')
    .replace(/[^a-z0-9_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function joinOr(items) {
  if (items.length < 2) return items.join('');
  return `${items.slice(0, -1).join(', ')} or ${items.at(-1)}`;
}

/** The first sentence of a Markdown text, ignoring periods inside code spans and links. */
function firstSentence(text) {
  let inCode = false;
  let depth = 0;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '`') inCode = !inCode;
    else if (!inCode && (char === '[' || char === '(')) depth++;
    else if (!inCode && (char === ']' || char === ')')) depth = Math.max(0, depth - 1);
    else if (!inCode && !depth && char === '.' && /\s/.test(text[index + 1] ?? ' ')) {
      return text.slice(0, index + 1);
    }
  }
  return text;
}

// The schema generator puts placeholders on `anyOf` branches; they mean nothing.
const textOf = (value) => (typeof value === 'string' && value.trim() ? value : undefined);
const examplesOf = (node) =>
  Array.isArray(node?.examples) && node.examples.length ? node.examples : undefined;

/** `markdownDescription` repeats `description`; use it only when it says more. */
function descriptionText(node) {
  if (!isObject(node)) return undefined;
  const plain = textOf(node.description);
  const markdown = textOf(node.markdownDescription);
  return markdown && markdown.length > (plain?.length ?? 0) ? markdown : plain;
}

function enumDescriptions(node) {
  const plain = Array.isArray(node.enumDescriptions) ? node.enumDescriptions : [];
  const markdown = Array.isArray(node.markdownEnumDescriptions)
    ? node.markdownEnumDescriptions
    : [];
  return node.enum.map((_, index) => {
    const a = textOf(plain[index]);
    const b = textOf(markdown[index]);
    return b && b.length > (a?.length ?? 0) ? b : a;
  });
}

function isPlainDefault(value) {
  return value !== undefined && value !== null && !isObject(value) && !Array.isArray(value);
}

/** Defaults as devlanes writes them back (`604800000ms`), shown in the unit a person would use. */
function humanDefault(value) {
  if (typeof value !== 'string') return value;
  const ms = value.match(/^(\d+)ms$/);
  if (ms) {
    const amount = Number(ms[1]);
    for (const [unit, size] of [
      ['d', 86400000],
      ['h', 3600000],
      ['m', 60000],
      ['s', 1000]
    ]) {
      if (amount && amount % size === 0) return `${amount / size}${unit}`;
    }
    return value;
  }
  const bytes = value.match(/^(\d+)B$/);
  if (bytes) {
    const amount = Number(bytes[1]);
    for (const [unit, size] of [
      ['GiB', 2 ** 30],
      ['MiB', 2 ** 20],
      ['KiB', 2 ** 10]
    ]) {
      if (amount && amount % size === 0) return `${amount / size}${unit}`;
    }
  }
  return value;
}

/** Reads one schema: resolves references and unions into the shapes a key can take. */
function schemaReader(schema) {
  const names = new Map(Object.entries(schema.$defs ?? {}).map(([name, node]) => [node, name]));

  const resolve = (ref) => {
    if (!ref.startsWith('#/')) throw new Error(`Unsupported $ref ${ref}`);
    return ref
      .slice(2)
      .split('/')
      .reduce((node, part) => node?.[part.replaceAll('~1', '/').replaceAll('~0', '~')], schema);
  };

  const isNull = (node) => node.type === 'null';
  // The `${{ ... }}` branch of a `Templated_*` definition: a string pattern that matches an
  // expression and not plain text.
  const isExpression = (node) => {
    if (node.type !== 'string' || typeof node.pattern !== 'string') return false;
    const pattern = new RegExp(node.pattern);
    // biome-ignore lint/suspicious/noTemplateCurlyInString: a devlanes expression, not JS
    return pattern.test('${{ x }}') && !pattern.test('x');
  };

  const leafCache = new Map();
  /**
   * The concrete shapes behind a node, through `$ref`, `anyOf` and `oneOf`, without null
   * branches. `expression` says whether a `${{ ... }}` branch was among them. Each leaf keeps
   * the definition it was reached through, which names formats and identifies shared values.
   */
  function leaves(node) {
    if (leafCache.has(node)) return leafCache.get(node);
    const found = [];
    let expression = false;
    const visit = (current, via, seen) => {
      if (!isObject(current) || seen.has(current)) return;
      seen.add(current);
      if (current.$ref) {
        const target = resolve(current.$ref);
        visit(target, target, seen);
        return;
      }
      const branches = [...(current.anyOf ?? []), ...(current.oneOf ?? [])];
      if (branches.length) {
        for (const branch of branches) {
          if (!isObject(branch) || isNull(branch)) continue;
          if (isExpression(branch)) expression = true;
          else visit(branch, via, new Set(seen));
        }
        return;
      }
      if (isNull(current)) return;
      found.push({ node: current, via });
    };
    visit(node, undefined, new Set());
    const result = { leaves: found, expression };
    leafCache.set(node, result);
    return result;
  }

  const typesOf = (node) => {
    const declared = [node.type].flat().filter((type) => type && type !== 'null');
    if (declared.length) return declared;
    if (node.properties || node.additionalProperties) return ['object'];
    if (node.items) return ['array'];
    return [];
  };

  /** What a node can contain: named keys, a map's values and a list's items. */
  function childrenOf(node) {
    const properties = [];
    const seen = new Set();
    let map;
    const items = [];
    for (const { node: leaf } of leaves(node).leaves) {
      if (isObject(leaf.items)) items.push(leaf.items);
      if (isObject(leaf.additionalProperties) && !map) map = leaf.additionalProperties;
      if (!isObject(leaf.properties)) continue;
      const conditions = presetConditions(leaf);
      for (const [name, child] of Object.entries(leaf.properties)) {
        if (seen.has(name)) continue;
        seen.add(name);
        properties.push({
          name,
          node: child,
          parent: leaf,
          required: (leaf.required ?? []).includes(name),
          condition: conditions.get(name)
        });
      }
    }
    return { properties, map, items };
  }

  /** `allOf: [{ if: { required: [vite] }, then: { properties: { preset: { const: vite } } } }]` */
  function presetConditions(leaf) {
    const conditions = new Map();
    for (const rule of leaf.allOf ?? []) {
      const [key] = rule?.if?.required ?? [];
      if (!key || rule.if.required.length !== 1 || !isObject(rule.then?.properties)) continue;
      for (const [name, value] of Object.entries(rule.then.properties)) {
        if (isObject(value) && 'const' in value) conditions.set(key, { name, value: value.const });
      }
    }
    return conditions;
  }

  function hasKeys(node, seen = new Set()) {
    if (seen.has(node)) return false;
    seen.add(node);
    const { properties, map, items } = childrenOf(node);
    return Boolean(properties.length || map || items.some((item) => hasKeys(item, seen)));
  }

  /**
   * The definition whose keys a node takes, so two paths reaching it share one set of entries.
   * A node with structure of its own, or several definitions, is its own key.
   */
  function sharedDefinition(node) {
    if (node.properties || node.items || node.additionalProperties) return node;
    if (node.$ref) return resolve(node.$ref);
    const branches = [...(node.anyOf ?? []), ...(node.oneOf ?? [])].filter(
      (branch) => isObject(branch) && !isNull(branch) && !isExpression(branch)
    );
    if (branches.length === 1 && branches[0].$ref) return resolve(branches[0].$ref);
    return node;
  }

  // Descriptions of expression and format definitions, which the generator copies onto every
  // field that uses them. The type line already covers them.
  const generic = new Set();
  for (const [name, node] of Object.entries(schema.$defs ?? {})) {
    const branches = node.anyOf ?? [];
    if (formats[name] || branches.some((branch) => isObject(branch) && isExpression(branch))) {
      if (descriptionText(node)) generic.add(descriptionText(node));
    }
  }

  function descriptionOf(node) {
    const own = descriptionText(node);
    if (own && !generic.has(own)) return own;
    const target = sharedDefinition(node);
    if (target !== node) {
      const inherited = descriptionText(target);
      if (inherited && !generic.has(inherited)) return inherited;
    }
    return undefined;
  }

  function formatOf(leaf) {
    const name = leaf.via && names.get(leaf.via);
    return name && leaf.node === leaf.via ? formats[name] : undefined;
  }

  /**
   * Singular and plural wording of each shape a node can take. `listOfThese` marks a key that
   * takes one entry or a list of the same entries.
   */
  function shapes(node, inList = false) {
    const { leaves: found, expression } = leaves(node);
    const result = [];
    const add = (one, many, items) => {
      if (!result.some((shape) => shape.one === one)) result.push({ one, many, items });
    };
    for (const leaf of found) {
      const current = leaf.node;
      const values = Array.isArray(current.enum)
        ? current.enum.filter((value) => value !== null)
        : null;
      if (values?.length === 1) add(code(values[0]), `${code(values[0])} values`);
      else if ('const' in current) add(code(current.const), `${code(current.const)} values`);
      const format = formatOf(leaf);
      if (format) {
        const href = `${route}#${anchorFor(format.heading)}`;
        add(`[${format.one}](${href})`, `[${format.many}](${href})`);
        continue;
      }
      if (values?.length === 1 || 'const' in current) continue;
      for (const type of typesOf(current)) {
        if (type === 'object') {
          if (isObject(current.additionalProperties) && !isObject(current.properties)) {
            // A value with keys of several shapes has an entry of its own that spells them out.
            const value = current.additionalProperties;
            const found = shapes(value, false);
            const simple = !hasKeys(value) || (found.length === 1 && !found.listOfThese);
            const words = simple ? ` to ${phrase(value, true)}` : '';
            add(`mapping of names${words}`, `mappings of names${words}`);
          } else add('mapping', 'mappings');
        } else if (type === 'array') {
          if (isObject(current.items)) {
            const item = phrase(current.items, true, expression);
            add(`list of ${item}`, `lists of ${item}`, current.items);
          } else add('list', 'lists');
        } else add(type, `${type}s`);
      }
    }
    if (expression && !inList) {
      add(`an [expression](${expressionsRoute})`, `[expressions](${expressionsRoute})`);
    }
    // Integer and float branches of one value read as "number".
    const merged = result.some((shape) => shape.one === 'number')
      ? result.filter((shape) => shape.one !== 'integer')
      : result;
    const lists = merged.filter((shape) => shape.items);
    if (lists.length === 1) {
      const others = merged.filter(
        (shape) => !shape.items && !shape.one.includes(expressionsRoute)
      );
      const items = shapes(lists[0].items, true).map((shape) => shape.one);
      const same =
        others.length > 1 &&
        others.length === items.length &&
        others.every((shape) => items.includes(shape.one));
      if (same) {
        const single = merged.filter((shape) => !shape.items);
        single.listOfThese = true;
        return single;
      }
    }
    return merged;
  }

  /** The type of a node in words: `string or an [expression](...)`, `list of strings`. */
  function phrase(node, plural = false, outerExpression = false) {
    const found = shapes(node, outerExpression);
    const words = joinOr(found.map((shape) => (plural ? shape.many : shape.one)));
    if (!words) return plural ? 'values' : 'any value';
    return found.listOfThese
      ? `${words}, or ${plural ? 'lists of them' : 'a list of these'}`
      : words;
  }

  /** Enumerated values of a node or of its list items, with the definition that owns them. */
  function valuesOf(node) {
    const owners = [];
    const collect = (target) => {
      for (const leaf of leaves(target).leaves) {
        if (Array.isArray(leaf.node.enum)) owners.push(leaf);
        else if (isObject(leaf.node.items) && target === node) collect(leaf.node.items);
      }
    };
    collect(node);
    return owners.map((leaf) => ({
      key: leaf.via ?? leaf.node,
      values: leaf.node.enum
        .map((value, index) => ({ value, description: enumDescriptions(leaf.node)[index] }))
        .filter(({ value }) => value !== null)
    }));
  }

  return {
    schema,
    leaves,
    childrenOf,
    hasKeys,
    sharedDefinition,
    descriptionOf,
    phrase,
    valuesOf
  };
}

/** First key of a map's first example, used as the placeholder for its `<name>` segment. */
function placeholderFor(node, reader) {
  const candidates = [node, ...reader.leaves(node).leaves.map((leaf) => leaf.node)];
  for (const candidate of candidates) {
    const example = examplesOf(candidate)?.find(
      (value) => isObject(value) && Object.keys(value).length
    );
    if (example) return Object.keys(example)[0];
  }
  return 'example';
}

/** A value for a required sibling, so an example stays valid: the sibling's own first example. */
function siblingValue(parent, name) {
  const property = parent.properties?.[name];
  const own = examplesOf(property)?.[0];
  if (own !== undefined) return own;
  return examplesOf(parent)?.find((value) => isObject(value) && name in value)?.[name];
}

function buildKind(kindName, schema) {
  const kind = kinds[kindName];
  const reader = schemaReader(schema);
  const entries = [];
  const entryByNode = new Map();
  const foldedInto = new Map();
  const keysOwner = new Map();
  const valuesOwner = new Map();

  const pageOf = (path) => `${route}${kind.dir}/${path.split(/[.[]/)[0]}/`;
  const urlOf = (entry) => `${pageOf(entry.path)}#${anchorFor(entry.path)}`;

  function addEntry(node, path, trail, parentEntry, property) {
    if (entryByNode.has(node)) return;
    const entry = { node, path, trail, parentEntry, property };
    entryByNode.set(node, entry);
    entries.push(entry);
    descend(node, path, trail, entry);
  }

  function descend(node, path, trail, entry) {
    const definition = reader.sharedDefinition(node);
    if (definition !== node) {
      const owner = keysOwner.get(definition);
      if (owner && owner !== entry) {
        if (reader.hasKeys(node)) entry.sameKeysAs = owner;
        return;
      }
      keysOwner.set(definition, entry);
    }
    const { properties, map, items } = reader.childrenOf(node);
    // Items first, so a key taking one entry or a list documents its keys in the list form.
    for (const item of items) {
      if (!foldedInto.has(item)) foldedInto.set(item, entry);
      descend(item, `${path}[]`, [...trail, { token: '[]', node: item }], entry);
    }
    for (const property of properties) {
      addEntry(
        property.node,
        join(path, property.name),
        [...trail, { token: property.name, node: property.node, property }],
        entry,
        property
      );
    }
    if (map) {
      const own = reader.descriptionOf(map);
      const foldable =
        !reader.hasKeys(map) &&
        !reader.valuesOf(map).length &&
        (!own || own === reader.descriptionOf(entry.node));
      if (foldable) foldedInto.set(map, entry);
      else {
        addEntry(map, join(path, '<name>'), [...trail, { token: '<name>', node: map }], entry);
      }
    }
  }

  const top = Object.keys(schema.properties ?? {});
  const order = [
    ...documentFirst.filter((key) => top.includes(key)),
    ...top.filter((key) => !documentFirst.includes(key))
  ];
  for (const key of order) {
    const node = schema.properties[key];
    const property = { name: key, parent: schema, required: (schema.required ?? []).includes(key) };
    addEntry(node, key, [{ token: key, node, property }], undefined, property);
  }

  // `<name>` steps need their map; each trail step records the node it is in.
  for (const entry of entries) {
    let parent = schema;
    for (const step of entry.trail) {
      step.container = parent;
      parent = step.node;
    }
  }

  function exampleFor(entry) {
    let value = examplesOf(entry.node)?.[0];
    if (value === undefined) {
      if (isPlainDefault(entry.node.default)) value = humanDefault(entry.node.default);
      else {
        const values = reader.valuesOf(entry.node);
        const only = reader.leaves(entry.node).leaves;
        if (values.length === 1 && values[0].values.length === 1 && only.length === 1)
          value = values[0].values[0].value;
      }
    }
    if (value === undefined) return undefined;
    for (let index = entry.trail.length - 1; index >= 0; index--) {
      const step = entry.trail[index];
      if (step.token === '[]') {
        value = [value];
      } else if (step.token === '<name>') {
        value = { [placeholderFor(step.container, reader)]: value };
      } else {
        const wrapped = {};
        const { property } = step;
        if (property?.condition) wrapped[property.condition.name] = property.condition.value;
        for (const name of property?.parent?.required ?? []) {
          if (name === step.token || name in wrapped) continue;
          const sibling = siblingValue(property.parent, name);
          if (sibling !== undefined) wrapped[name] = sibling;
        }
        wrapped[step.token] = value;
        value = wrapped;
      }
    }
    return stringify(value, { lineWidth: 0 }).trimEnd();
  }

  function render(entry) {
    const { node, path } = entry;
    const level = path.includes('.') || path.includes('[') ? '###' : '##';
    const lines = [`${level} \`${path}\``, ''];

    let type = `Type: ${reader.phrase(node)}`;
    if (entry.property?.condition) {
      const { name, value } = entry.property.condition;
      type += `, with \`${name}: ${value}\``;
    }
    type += '.';
    if (isPlainDefault(node.default)) type += ` Default: ${code(humanDefault(node.default))}.`;
    if (entry.property?.required) type += ' Required.';
    lines.push(type, '');

    const description = reader.descriptionOf(node);
    const parentDescription = entry.parentEntry && reader.descriptionOf(entry.parentEntry.node);
    if (description && description !== parentDescription) lines.push(description, '');

    if (isObject(node.items)) {
      const item = reader.descriptionOf(node.items);
      if (item && item !== description) lines.push(`Each item: ${item}`, '');
    }

    let sameValuesAs;
    for (const { key, values } of reader.valuesOf(node)) {
      const owner = valuesOwner.get(key);
      if (owner && owner !== entry) {
        sameValuesAs = owner;
        continue;
      }
      valuesOwner.set(key, entry);
      lines.push('Values:', '');
      for (const { value, description: text } of values) {
        lines.push(text ? `- ${code(value)}: ${text}` : `- ${code(value)}`);
      }
      lines.push('');
    }

    const link = (target) => `[\`${target.path}\`](${urlOf(target)})`;
    if (entry.sameKeysAs && sameValuesAs === entry.sameKeysAs) {
      lines.push(`Takes the same values and keys as ${link(entry.sameKeysAs)}.`, '');
    } else {
      if (sameValuesAs) lines.push(`Takes the same values as ${link(sameValuesAs)}.`, '');
      if (entry.sameKeysAs) lines.push(`Takes the same keys as ${link(entry.sameKeysAs)}.`, '');
    }

    const example = exampleFor(entry);
    if (example) lines.push(`\`\`\`yaml ${kind.fence}`, example, '```', '');
    return lines.join('\n');
  }

  // Values are claimed in page order so the first page that shows a list keeps it.
  const pages = [];
  const rendered = new Map();
  for (const key of order) {
    for (const entry of entries.filter((item) => item.path.split(/[.[]/)[0] === key)) {
      rendered.set(entry, render(entry));
    }
  }

  top.forEach((key, index) => {
    const body = entries
      .filter((entry) => entry.path.split(/[.[]/)[0] === key)
      .map((entry) => rendered.get(entry))
      .join('\n');
    pages.push({
      key,
      index,
      file: `reference/config/${kind.dir}/${key}.md`,
      title: `${key} in ${kind.shortFile}`,
      description: `Reference for the ${key} key in ${kind.file}.`,
      body: `A top-level key of [\`${kind.file}\`](${route}${kind.dir}/).\n\n${body}`
    });
  });

  function linkFor(path) {
    const tokens = path.match(/\[\]|[^.[\]]+/g) ?? [];
    let node = schema;
    for (const token of tokens) {
      const { properties, map, items } = reader.childrenOf(node);
      if (token === '[]') node = items[0];
      else if (token === '<name>') node = map;
      else node = properties.find((property) => property.name === token)?.node;
      if (!node) return undefined;
    }
    const entry = entryByNode.get(node) ?? foldedInto.get(node);
    return entry && urlOf(entry);
  }

  return { kind, reader, pages, linkFor, entries };
}

function frontmatter(data) {
  return `---\n${stringify(data, { lineWidth: 0 })}---\n\n`;
}

function overview(project, user) {
  const formatSections = [];
  for (const [name, format] of Object.entries(formats)) {
    const definition = project.schema.$defs?.[name] ?? user.schema.$defs?.[name];
    const text = definition && descriptionText(definition);
    if (text) formatSections.push(`### ${format.heading}\n\n${text}\n`);
  }
  const expression = Object.entries(project.schema.$defs ?? {}).find(([name]) =>
    name.startsWith('Templated_')
  )?.[1];
  const projectSchema = project.schema.$id ?? 'https://devlanes.run/v1/schema.json';
  const userSchema = user.schema.$id ?? 'https://devlanes.run/v1/user-schema.json';
  return [
    'devlanes reads two YAML files. Both are described by JSON Schemas, and this reference is generated from them.',
    '',
    '## Project file',
    '',
    '`devlanes.yaml` describes one project: its services, tasks, containers and lanes. It sits at the repository root or in a subdirectory, and devlanes uses the nearest one above the current directory, up to the repository root. A `devlanes.local.yaml` next to it takes the same keys and holds changes for one machine; keep it out of Git.',
    '',
    `Editors validate it with the modeline \`# yaml-language-server: $schema=${projectSchema}\`. [Project file reference](${route}project/) lists its keys.`,
    '',
    '## User file',
    '',
    `\`~/.devlanes/config.yaml\` holds settings for you on this machine, such as the port range, hostnames, the proxy and the TUI. Its schema is \`${userSchema}\`. [User file reference](${route}user/) lists its keys.`,
    '',
    '## Reading an entry',
    '',
    'Each entry is headed by the dotted path of its key. In a path, `<name>` stands for a key you choose, such as a service or task name, and `[]` for an item of a list. A key that takes one entry or a list is written in its list form. Under the heading come the type, the default when there is one and whether the key is required, then what the key does, its allowed values and an example.',
    '',
    ...(formatSections.length ? ['## Value formats', '', ...formatSections] : []),
    '## Expressions',
    '',
    `${expression && descriptionText(expression) ? `${descriptionText(expression)} ` : ''}A type that ends in "or an expression" accepts one. [Expressions](${expressionsRoute}) lists the names they can use.`,
    ''
  ].join('\n');
}

function indexPage(built) {
  const { kind, pages, reader } = built;
  const lines = pages.map((page) => {
    const summary = reader.descriptionOf(reader.schema.properties[page.key]);
    return `- [\`${page.key}\`](${route}${kind.dir}/${page.key}/)${summary ? `: ${firstSentence(summary)}` : ''}`;
  });
  const example = examplesOf(reader.schema)?.[0];
  return [
    `Top-level keys of \`${kind.file}\`. Each has a page with every key under it.`,
    '',
    ...lines,
    '',
    ...(example
      ? [`\`\`\`yaml ${kind.fence}`, stringify(example, { lineWidth: 0 }).trimEnd(), '```', '']
      : [])
  ].join('\n');
}

/**
 * @param {{ project: object, user: object }} schemas parsed schema.json and user-schema.json
 */
export function configReference(schemas) {
  const project = buildKind('project', schemas.project);
  const user = buildKind('user', schemas.user);
  const pages = [];
  let order = 0;
  pages.push({
    file: 'reference/config/index.md',
    markdown:
      frontmatter({
        title: 'Configuration reference',
        description:
          'The two devlanes config files, where each lives, and how to read the reference generated from their schemas.',
        sidebar: { label: 'Overview', order: order++ }
      }) + overview(project.reader, user.reader)
  });
  for (const built of [project, user]) {
    pages.push({
      file: `reference/config/${built.kind.dir}/index.md`,
      markdown:
        frontmatter({
          title: built.kind.title,
          description: `Every top-level key of ${built.kind.file}, each with a one-sentence summary.`,
          sidebar: { label: built.kind.label, order: order++ },
          tableOfContents: false
        }) + indexPage(built)
    });
    for (const page of built.pages) {
      pages.push({
        file: page.file,
        markdown:
          frontmatter({
            title: page.title,
            description: page.description,
            sidebar: { label: page.key, order: order++ }
          }) + page.body
      });
    }
  }
  return {
    pages,
    linkFor(kind, path) {
      return (kind === 'user' ? user : project).linkFor(path);
    }
  };
}
