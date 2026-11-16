// Markdown directives of the docs pages, as Sätteri mdast plugins (Astro's default Markdown
// processor). The pages stay plain `.md`; src/lib/docs-twin.mjs gives their Markdown twins the
// same content without the directives.
//
//   ::::tabs{sync="os"} with :::tab[macOS] children   tabs that switch together across pages
//   :::steps around one ordered list                   numbered steps with a connecting line
//   ::::compare with :::side[Title] children           two columns, like the ledger on /remote/
//   ::tui{view="monitor"}                              the live TUI, opened on a view
//   ![Alt](diagram.svg)                                the SVG inlined, so it follows the theme
//
// Headings of the generated config reference also get their anchors here.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { anchorFor } from './config-reference.mjs';

// Lowercased, since Windows paths reach plugins with either case of the drive letter. Only the
// docs: the examples' READMEs (src/content/docs/examples/) are written for GitHub.
const docsRoot = new URL('../src/content/docs/docs/', import.meta.url).href.toLowerCase();
const configReference = new URL(
  '../src/content/docs/docs/reference/config/',
  import.meta.url
).href.toLowerCase();
const within = (fileURL, root) => fileURL?.href.toLowerCase().startsWith(root) ?? false;
const tuiViews = ['lanes', 'monitor', 'daemon', 'boxes'];

/** A block element around Markdown children, the way Starlight builds its asides. */
const element = (tagName, properties, children = []) => ({
  type: 'paragraph',
  data: { hName: tagName, hProperties: properties },
  children
});

const escapeHtml = (text) =>
  text.replace(
    /[&<>"]/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]
  );

/** A directive's `[label]` and the children after it. */
function labelled(node, ctx) {
  const [first, ...rest] = node.children;
  if (first?.type === 'paragraph' && first.data?.directiveLabel) {
    return { label: ctx.textContent(first), labelChildren: [...first.children], rest };
  }
  return { label: '', labelChildren: [], rest: [...node.children] };
}

/**
 * Prefixes every id in an SVG, and the references to them, so two diagrams on one page cannot
 * point at each other's markers or gradients.
 */
function prefixIds(svg, prefix) {
  const ids = new Set([...svg.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]));
  if (!ids.size) return svg;
  return svg
    .replace(/(\sid=")([^"]+)"/g, (whole, start, id) =>
      ids.has(id) ? `${start}${prefix}${id}"` : whole
    )
    .replace(/url\(#([^)]+)\)/g, (whole, id) => (ids.has(id) ? `url(#${prefix}${id})` : whole))
    .replace(/((?:xlink:)?href=")#([^"]+)"/g, (whole, start, id) =>
      ids.has(id) ? `${start}#${prefix}${id}"` : whole
    );
}

/** The SVG of a diagram, ready to inline: no prolog, ids prefixed, labelled as one image. */
export function inlineSvg(source, alt, prefix) {
  const svg = source
    .replace(/^\uFEFF/, '')
    .replace(/<\?xml[\s\S]*?\?>/, '')
    .replace(/<!DOCTYPE[\s\S]*?>/i, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();
  if (!svg.startsWith('<svg')) throw new Error('it is not an SVG document');
  const root = svg.replace(/^<svg\b([^>]*)>/, (_, attributes) => {
    const rest = attributes.replace(/\s(role|aria-label|aria-hidden)="[^"]*"/g, '');
    const className = rest.match(/\sclass="([^"]*)"/)?.[1];
    const withClass = className
      ? rest.replace(/\sclass="[^"]*"/, ` class="dl-diagram ${className}"`)
      : `${rest} class="dl-diagram"`;
    return `<svg${withClass} role="img" aria-label="${escapeHtml(alt)}">`;
  });
  return prefixIds(root, prefix);
}

/** The window around a docs TUI embed: src/components/Terminal.astro and Tui.astro. */
function tuiHtml(view, id) {
  // `not-content` keeps Starlight's spacing between Markdown blocks out of the window.
  return `<div class="dl-tui not-content" data-tui-optional hidden>
<div class="terminal terminal-tui"><div class="terminal-bar"><span class="terminal-dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="terminal-title">devlanes</span></div>
<div class="tui" data-tui data-rows="30" data-mobile-rows="24" data-view="${view}"><span class="tui-badge" data-tui-badge hidden><i aria-hidden="true"></i><span data-tui-badge-text>Live, click to interact</span></span><div class="tui-static" data-tui-static></div><div class="tui-live" data-tui-live hidden><div class="tui-screen" id="${id}" tabindex="0" role="application" aria-label="The devlanes terminal, live"></div><p class="tui-hint" data-tui-hint aria-hidden="true" hidden><span>Click to interact</span></p></div></div>
</div>
</div>`;
}

/** The plugin for one docs page. */
export function docsDirectives(fileURL) {
  const file = fileURL ? fileURLToPath(fileURL) : 'a docs page';
  const fail = (node, message) => {
    const line = node.position?.start?.line;
    throw new Error(`${file}${line ? `:${line}` : ''}: ${message}`);
  };
  const isConfigReference = within(fileURL, configReference);
  let tuis = 0;
  let diagrams = 0;

  /** Children of a container that must all be `name` directives with a label. */
  const sections = (node, ctx, name) => {
    const children = node.children.filter((child) => child.type !== 'html' || child.value.trim());
    if (!children.length) fail(node, `:::${node.name} is empty`);
    return children.map((child) => {
      if (child.type !== 'containerDirective' || child.name !== name) {
        fail(child, `:::${node.name} holds only :::${name} blocks`);
      }
      const section = labelled(child, ctx);
      if (!section.label.trim()) fail(child, `:::${name} needs a label, as in :::${name}[Label]`);
      return section;
    });
  };

  return {
    name: 'devlanes-directives',
    options: { position: true },
    containerDirective(node, ctx) {
      const parent = ctx.parent(node);
      const inside = (name) => parent?.type === 'containerDirective' && parent.name === name;
      switch (node.name) {
        case 'tabs': {
          const sync = node.attributes?.sync ?? undefined;
          const tabs = sections(node, ctx, 'tab');
          return element(
            'div',
            { class: 'dl-tabs', ...(sync ? { 'data-sync': sync } : {}) },
            tabs.map(({ label, labelChildren, rest }) =>
              element('section', { class: 'dl-tab', 'data-label': label.trim() }, [
                element('p', { class: 'dl-tab-label' }, labelChildren),
                ...rest
              ])
            )
          );
        }
        case 'steps': {
          const [list, ...others] = node.children;
          if (list?.type !== 'list' || !list.ordered || others.length) {
            fail(node, ':::steps holds one numbered list and nothing else');
          }
          return element('div', { class: 'dl-steps' }, [list]);
        }
        case 'compare': {
          const sides = sections(node, ctx, 'side');
          // `- \`command\`: what it does` reads as the ledger's two lines, without the colon.
          for (const { rest } of sides) {
            for (const list of rest.filter((child) => child.type === 'list')) {
              for (const item of list.children) {
                const [code, text] = item.children[0]?.children ?? [];
                if (code?.type === 'inlineCode' && text?.type === 'text') {
                  ctx.setProperty(text, 'value', text.value.replace(/^\s*:\s*/, ''));
                }
              }
            }
          }
          return element(
            'div',
            { class: 'dl-compare' },
            sides.map(({ labelChildren, rest }) =>
              element('section', { class: 'dl-compare-side' }, [
                element('p', { class: 'dl-compare-title' }, labelChildren),
                ...rest
              ])
            )
          );
        }
        case 'tab':
          if (!inside('tabs')) fail(node, ':::tab belongs inside ::::tabs');
          return undefined;
        case 'side':
          if (!inside('compare')) fail(node, ':::side belongs inside ::::compare');
          return undefined;
        default:
          return undefined;
      }
    },
    leafDirective(node) {
      if (node.name !== 'tui') return undefined;
      const view = node.attributes?.view;
      if (!view || !tuiViews.includes(view)) {
        fail(node, `::tui needs view set to one of ${tuiViews.join(', ')}`);
      }
      tuis += 1;
      const page = file.replace(/\\/g, '/').split('/').at(-1)?.replace(/\.md$/, '') ?? 'page';
      return { type: 'html', value: tuiHtml(view, `tui-${page}-${tuis}`) };
    },
    image(node) {
      const url = node.url;
      if (!/\.svg$/i.test(url) || /^([a-z][a-z\d+.-]*:|\/|#)/i.test(url) || !fileURL)
        return undefined;
      if (!node.alt?.trim())
        fail(node, `the diagram ${url} needs alt text: ![What it shows](${url})`);
      let source;
      try {
        source = readFileSync(new URL(url, fileURL), 'utf8');
      } catch {
        fail(node, `the diagram ${url} does not exist next to the page`);
      }
      diagrams += 1;
      const prefix = `d${diagrams}-`;
      try {
        return { type: 'html', value: inlineSvg(source, node.alt.trim(), prefix) };
      } catch (error) {
        fail(node, `the diagram ${url} cannot be inlined: ${error.message}`);
      }
    },
    heading(node, ctx) {
      if (!isConfigReference) return undefined;
      const [code, ...others] = node.children;
      if (code?.type !== 'inlineCode' || others.length) return undefined;
      ctx.setProperty(node, 'data', { hProperties: { id: anchorFor(code.value) } });
      return undefined;
    }
  };
}

/** Registers the plugins with Astro's Sätteri processor, for the docs pages only. */
export default function directives() {
  return {
    name: 'devlanes:directives',
    hooks: {
      'astro:config:setup': ({ config }) => {
        const processor = config.markdown.processor;
        if (processor?.name !== 'satteri') {
          throw new Error('integrations/directives.mjs needs the Sätteri Markdown processor');
        }
        processor.options.features.directive = true;
        processor.options.mdastPlugins.push(({ fileURL }) =>
          within(fileURL, docsRoot) ? docsDirectives(fileURL) : null
        );
      }
    }
  };
}
