// Expressive Code plugin for config examples fenced as ```yaml devlanes (devlanes.yaml) or
// ```yaml devlanes-user (~/.devlanes/config.yaml): each key shows its JSON Schema description on
// hover, like Twoslash, and a key the schema does not allow fails the build. Untagged YAML, such
// as Compose files and partial snippets, renders as usual.
import { readFileSync } from 'node:fs';
import { definePlugin, ExpressiveCodeAnnotation } from '@astrojs/starlight/expressive-code';
import { h } from '@astrojs/starlight/expressive-code/hast';
import { describeKeys } from './config-schema.mjs';

const kinds = {
  devlanes: { schema: 'v1/schema.json', title: 'devlanes.yaml' },
  'devlanes-user': { schema: 'v1/user-schema.json', title: '~/.devlanes/config.yaml' }
};

const publicDir = new URL('../public/', import.meta.url);
const referenceRoute = '/docs/reference/config/';
const referenceFile = new URL('../src/content/docs/docs/reference/config.md', import.meta.url);
const clientScript = readFileSync(new URL('./config-docs.client.js', import.meta.url), 'utf8');

// Both are written by `pnpm sync`, so they are read on first use rather than at config load.
const schemas = new Map();
function schemaFor(kind) {
  if (!schemas.has(kind.schema)) {
    schemas.set(kind.schema, JSON.parse(readFileSync(new URL(kind.schema, publicDir), 'utf8')));
  }
  return schemas.get(kind.schema);
}

let headings;
/**
 * Anchors of the reference's top-level key sections, as Astro slugs them. The project config
 * comes before the user config there, so a name both have (`lanes`) is the first heading for
 * the project and the last, `lanes-1`, for the user config.
 */
function anchorFor(kindName, key) {
  if (!headings) {
    headings = new Map();
    const seen = new Map();
    let markdown = '';
    try {
      markdown = readFileSync(referenceFile, 'utf8');
    } catch {
      // Without the reference page the hovers link to the route alone.
    }
    let fence = null;
    for (const line of markdown.split('\n')) {
      const marker = line.match(/^\s*(`{3,}|~{3,})/)?.[1];
      if (marker && (!fence || marker.startsWith(fence))) fence = fence ? null : marker;
      const text = !fence && !marker && line.match(/^#{2,6}\s+(.+?)\s*$/)?.[1];
      if (!text) continue;
      const base = text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s_-]/gu, '')
        .replace(/\s/g, '-');
      const count = seen.get(base) ?? 0;
      seen.set(base, count + 1);
      const slug = count ? `${base}-${count}` : base;
      headings.set(text, [...(headings.get(text) ?? []), slug]);
    }
  }
  const slugs = headings.get(key);
  if (!slugs) return referenceRoute;
  return `${referenceRoute}#${kindName === 'devlanes' ? slugs[0] : slugs.at(-1)}`;
}

function kindOf(codeBlock) {
  if (codeBlock.language !== 'yaml') return undefined;
  const name = Object.keys(kinds).find((key) => codeBlock.metaOptions.getBoolean(key));
  return name ? { name, ...kinds[name] } : undefined;
}

/** Inline Markdown of a schema description: only code spans occur there. */
function inlineMarkdown(text) {
  return text
    .split(/(`[^`]+`)/)
    .map((part, index) => (index % 2 ? h('code', part.slice(1, -1)) : part));
}

class ConfigKeyAnnotation extends ExpressiveCodeAnnotation {
  constructor({ doc, ...options }) {
    super(options);
    this.doc = doc;
  }

  render({ nodesToTransform }) {
    return nodesToTransform.map((node) =>
      h('span', { className: 'devlanes-config-key', 'data-doc': this.doc }, node)
    );
  }
}

const docsByBlock = new WeakMap();

export function pluginConfigDocs() {
  return definePlugin({
    name: 'devlanes config docs',
    jsModules: [clientScript],
    baseStyles: styles,
    hooks: {
      // Runs after the frames plugin has taken a file name comment as the title.
      preprocessCode({ codeBlock }) {
        const kind = kindOf(codeBlock);
        if (kind && codeBlock.props.title === undefined) codeBlock.props.title = kind.title;
      },
      annotateCode({ codeBlock }) {
        const kind = kindOf(codeBlock);
        if (!kind) return;
        const source = codeBlock.code;
        const where = codeBlock.parentDocument?.sourceFilePath ?? 'a code block';
        const lineOf = (offset) => source.slice(0, offset).split('\n').length;
        let found;
        try {
          found = describeKeys(source, schemaFor(kind));
        } catch (error) {
          throw new Error(`Invalid YAML in a \`yaml ${kind.name}\` block in ${where}: ${error}`);
        }
        if (found.unknown.length) {
          const list = found.unknown.map(
            (key) => `${key.path} (line ${lineOf(key.start)} of the block)`
          );
          throw new Error(
            `A \`yaml ${kind.name}\` block in ${where} has keys ${kind.schema} does not allow: ${list.join(', ')}`
          );
        }

        const docs = [];
        const lineStarts = [0];
        for (const line of source.split('\n')) lineStarts.push(lineStarts.at(-1) + line.length + 1);
        for (const key of found.keys) {
          const lineIndex = lineStarts.findLastIndex((start) => start <= key.start);
          // Multi-line keys (quoted keys with line breaks) are left without a hover.
          if (key.end > lineStarts[lineIndex + 1]) continue;
          let doc = docs.findIndex((entry) => entry.path === key.path);
          if (doc < 0) doc = docs.push(key) - 1;
          codeBlock.getLine(lineIndex)?.addAnnotation(
            new ConfigKeyAnnotation({
              doc,
              inlineRange: {
                columnStart: key.start - lineStarts[lineIndex],
                columnEnd: key.end - lineStarts[lineIndex]
              }
            })
          );
        }
        docsByBlock.set(codeBlock, { kind, docs });
      },
      postprocessRenderedBlock({ codeBlock, renderData }) {
        const entry = docsByBlock.get(codeBlock);
        if (!entry) return;
        const figure = renderData.blockAst;
        const title = String(codeBlock.props.title ?? '');
        figure.properties.className = [
          ...[figure.properties.className ?? []].flat(),
          'devlanes-config',
          ...(title.endsWith('.local.yaml') ? ['is-local'] : [])
        ];
        // The client script copies these into one floating tooltip, so they are never shown
        // in place, read out or indexed by search.
        figure.children.push(
          h(
            'div',
            { className: 'devlanes-config-docs', hidden: true, 'data-pagefind-ignore': '' },
            entry.docs.map((doc, index) =>
              h('div', { 'data-doc': index }, [
                h('code', { className: 'path' }, doc.path),
                h('p', inlineMarkdown(doc.description)),
                h(
                  'a',
                  { href: anchorFor(entry.kind.name, doc.path.split(/[.[]/)[0]) },
                  'Config reference'
                )
              ])
            )
          )
        );
      }
    }
  });
}

// Code blocks are dark in both themes, so the tooltip uses their colours rather than the page's.
const styles = `
.frame.devlanes-config {
  .devlanes-config-docs {
    display: none;
  }

  .devlanes-config-key {
    border-radius: 3px;
    text-decoration: underline dotted transparent;
    text-decoration-thickness: 1px;
    text-underline-offset: 4px;
    transition: text-decoration-color 0.15s, background-color 0.15s;
  }

  &:hover .devlanes-config-key {
    text-decoration-color: rgba(245, 197, 66, 0.45);
  }

  .devlanes-config-key:hover,
  .devlanes-config-key.is-active {
    background-color: rgba(245, 197, 66, 0.14);
    text-decoration-color: #f5c542;
    cursor: help;
  }

  &.has-title .header .title {
    display: flex;
    align-items: center;
    gap: 0.55em;

    &::before {
      content: '';
      flex: none;
      width: 1.35em;
      height: 1.35em;
      background: url('/assets/fileicon-dark.svg') center / contain no-repeat;
    }

    &::after {
      border-bottom: 2px solid #f5c542;
    }
  }

  &.is-local.has-title .header .title::before {
    background-image: url('/assets/fileicon-local-dark.svg');
  }
}

@at-root .devlanes-config-tip {
  position: fixed;
  z-index: 100;
  box-sizing: border-box;
  max-width: min(460px, calc(100vw - 16px));
  padding: 12px 14px 11px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  background: #22211f;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
  color: #d9d6cd;
  font: 400 14px/1.55 'Overpass', sans-serif;
  text-align: start;

  &[hidden] {
    display: none;
  }

  .path {
    display: block;
    margin-bottom: 6px;
    color: #f5c542;
    font: 600 12.5px/1.4 'JetBrains Mono', monospace;
    overflow-wrap: anywhere;
  }

  p {
    margin: 0;
  }

  /* Spans like --env would otherwise break at their hyphen; the longest one fits the tooltip. */
  p code {
    white-space: nowrap;
    padding: 1px 5px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.07);
    color: #e8e6df;
    font: 12.5px 'JetBrains Mono', monospace;
  }

  a {
    display: inline-block;
    margin-top: 8px;
    color: #a9a396;
    font-size: 13px;
    font-weight: 600;
    text-decoration: underline;
    text-decoration-color: rgba(245, 197, 66, 0.6);
    text-underline-offset: 4px;

    &:hover {
      color: #e8e6df;
      text-decoration-color: currentColor;
    }
  }
}
`;
