// ```mermaid fences of the docs pages, rendered at build time by beautiful-mermaid: no browser
// in the build and no script in the page. The SVG paints with CSS variables, so one render
// follows the theme; src/styles/docs.scss maps them to the site's colours.
import { renderMermaidSVG } from 'beautiful-mermaid';

// The renderer's own variable names (--line, --muted, --surface) are also site tokens, and
// `--muted: var(--muted)` would be a cycle, so every role points at a name of ours.
const colours = {
  bg: 'var(--dl-mermaid-bg)',
  fg: 'var(--dl-mermaid-fg)',
  line: 'var(--dl-mermaid-line)',
  accent: 'var(--dl-mermaid-accent)',
  muted: 'var(--dl-mermaid-muted)',
  surface: 'var(--dl-mermaid-surface)',
  border: 'var(--dl-mermaid-border)'
};

/**
 * Takes the accessible title and description out of a diagram, since the renderer would draw
 * them as nodes, and drops front matter, whose config the site's theme replaces.
 */
function splitAccessibility(source) {
  let title;
  let description;
  const diagram = source
    .replace(/\r\n/g, '\n')
    .replace(/^\s*---\n[\s\S]*?\n---\n/, '')
    .replace(/^\s*accDescr\s*\{([\s\S]*?)\}[ \t]*$/m, (_, text) => {
      description = text.trim().replace(/\s+/g, ' ');
      return '';
    })
    .replace(/^\s*acc(Title|Descr)\s*:(.*)$/gm, (_, kind, text) => {
      if (kind === 'Title') title = text.trim();
      else description = text.trim();
      return '';
    });
  return { diagram, label: title || description || '' };
}

/**
 * Keeps the renderer's <style> to its own diagram: its rules target every `svg` and `text` on
 * the page, and it imports the fonts from Google, which the site already hosts.
 */
function scopeStyles(svg) {
  const scope = (selector) =>
    selector.trim() === 'svg' ? 'svg.dl-mermaid' : `svg.dl-mermaid ${selector.trim()}`;
  return svg.replace(/(<style>)([\s\S]*?)(<\/style>)/g, (_, open, css, close) => {
    const scoped = css
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/@import\s+url\([^)]*\)[^;]*;/g, '')
      .replace(/(^|\})([^{}]+)\{/g, (_, end, selectors) => {
        return `${end}\n${selectors.split(',').map(scope).join(', ')} {`;
      });
    return open + scoped + close;
  });
}

/** The SVG of a diagram, classed `dl-mermaid`, with its label for the page to set. */
export function renderMermaid(source) {
  const { diagram, label } = splitAccessibility(source);
  const svg = renderMermaidSVG(diagram, { ...colours, font: 'Overpass', transparent: true });
  return { svg: scopeStyles(svg.replace(/^<svg\b/, '<svg class="dl-mermaid"')), label };
}
