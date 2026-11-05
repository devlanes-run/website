// Maps the keys of a devlanes config example to the parts of the JSON Schema that describe them,
// for the hovers in integrations/config-docs.mjs. Only keys are checked; values are not validated.
import { isMap, isScalar, isSeq, parseDocument } from 'yaml';

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

function resolveRef(schema, ref) {
  if (!ref.startsWith('#/')) throw new Error(`Unsupported $ref ${ref}`);
  return ref
    .slice(2)
    .split('/')
    .reduce((node, part) => node?.[part.replaceAll('~1', '/').replaceAll('~0', '~')], schema);
}

/** The node followed by every schema it stands for through `$ref`, `anyOf` and `oneOf`. */
function expand(schema, node, seen = new Set()) {
  if (!isObject(node) || seen.has(node)) return [];
  seen.add(node);
  const nodes = [node];
  if (node.$ref) nodes.push(...expand(schema, resolveRef(schema, node.$ref), seen));
  for (const branch of [...(node.anyOf ?? []), ...(node.oneOf ?? [])]) {
    nodes.push(...expand(schema, branch, seen));
  }
  return nodes;
}

/** Schemas that only point elsewhere say nothing about which keys they allow. */
const isWrapper = (node) => Boolean(node.$ref || node.anyOf || node.oneOf || node.allOf);

function acceptsAnyKey(node) {
  if (isWrapper(node) || node.additionalProperties === false) return false;
  if (node.enum || 'const' in node) return false;
  const types = node.type === undefined ? undefined : [node.type].flat();
  return !types || types.includes('object');
}

function acceptsAnyItem(node) {
  if (isWrapper(node) || node.items === false) return false;
  const types = node.type === undefined ? undefined : [node.type].flat();
  return !types || types.includes('array');
}

/**
 * Schema of `key` inside `node`: a named property, or the value schema of a map, whose path
 * segment is `<name>` as in the config reference. `open` means any key is allowed but nothing
 * describes it; `null` means the key is not allowed.
 */
function propertyOf(schema, node, key) {
  const candidates = expand(schema, node);
  for (const candidate of candidates) {
    if (isObject(candidate.properties) && Object.hasOwn(candidate.properties, key)) {
      return { node: candidate.properties[key], segment: key };
    }
  }
  for (const candidate of candidates) {
    if (isObject(candidate.additionalProperties)) {
      return { node: candidate.additionalProperties, segment: '<name>' };
    }
  }
  return candidates.some(acceptsAnyKey) ? 'open' : null;
}

function itemOf(schema, node) {
  const candidates = expand(schema, node);
  const items = candidates.find((candidate) => isObject(candidate.items))?.items;
  if (items) return items;
  return candidates.some(acceptsAnyItem) ? 'open' : null;
}

/** First non-empty description: the node's own, then the ones it refers to. */
function descriptionOf(schema, node) {
  for (const candidate of expand(schema, node)) {
    const text = candidate.markdownDescription || candidate.description;
    if (text) return text;
  }
}

/**
 * Finds the keys of a YAML document in `schema`. Returns the described keys with their source
 * offsets and reference paths (`services.<name>.hosts[].host`), and the keys the schema rejects
 * with their paths as written (`services.api.prot`).
 */
export function describeKeys(source, schema) {
  const document = parseDocument(source);
  if (document.errors.length) throw new Error(document.errors[0].message);
  const keys = [];
  const unknown = [];
  const join = (path, segment) => (path ? `${path}.${segment}` : segment);

  // `path` is the reference path, `written` the same place with the example's own names.
  const visit = (value, node, path, written) => {
    if (isMap(value)) {
      for (const pair of value.items) {
        if (!isScalar(pair.key) || !pair.key.range) continue;
        const name = String(pair.key.value);
        const [start, end] = pair.key.range;
        const property = propertyOf(schema, node, name);
        if (property === null) unknown.push({ path: join(written, name), start });
        if (!isObject(property)) continue;
        const keyPath = join(path, property.segment);
        const description = descriptionOf(schema, property.node);
        if (description) keys.push({ start, end, path: keyPath, description });
        visit(pair.value, property.node, keyPath, join(written, name));
      }
    } else if (isSeq(value)) {
      const item = itemOf(schema, node);
      if (item === null && value.items.length) {
        unknown.push({ path: `${written}[]`, start: value.range[0] });
      }
      if (!isObject(item)) return;
      for (const entry of value.items) visit(entry, item, `${path}[]`, `${written}[]`);
    }
  };

  visit(document.contents, schema, '', '');
  return { keys, unknown };
}
