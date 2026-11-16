// The Markdown twin of a docs page keeps the page's content without the website's directives
// (integrations/directives.mjs), which only the website renders: an agent reading the twin
// gets every tab and comparison side under its label, and no embed it cannot run.
const containers = /^(\s*)(:{3,})([a-z][\w-]*)(?:\[([^\]]*)\])?(?:\{[^}]*\})?\s*$/i;
const closing = /^\s*(:{3,})\s*$/;
const leaf = /^\s*::([a-z][\w-]*)(?:\[[^\]]*\])?(?:\{[^}]*\})?\s*$/i;
/** Inline SVG diagrams next to the page: their files are not published on their own. */
const diagram = /!\[([^\]]*)\]\((?![a-z][a-z\d+.-]*:|\/)([^)\s]+\.svg)\)/gi;

/** Containers whose fences go away and whose content stays. */
const wrappers = new Set(['tabs', 'steps', 'compare']);
/** Containers that become their label, in bold, over their content. */
const labelled = new Set(['tab', 'side']);
/** Leaf directives that have nothing to say in Markdown. */
const dropped = new Set(['tui']);

/** @param {string} body The page's Markdown as the collection holds it. */
export function twinMarkdown(body) {
  /** @type {string[]} */
  const out = [];
  /** Colons and kind of each open container, so a closing fence knows what it ends. */
  /** @type {{ colons: number, kind: 'drop' | 'label' | 'keep' }[]} */
  const stack = [];
  /** @type {string | null} */
  let fence = null;
  const emit = (/** @type {string} */ line) => {
    if (line.trim() === '' && (out.length === 0 || out.at(-1)?.trim() === '')) return;
    out.push(line);
  };
  for (const line of body.split('\n')) {
    const marker = line.match(/^\s*(`{3,}|~{3,})/)?.[1];
    if (marker && (!fence || marker.startsWith(fence))) {
      fence = fence ? null : marker;
      out.push(line);
      continue;
    }
    if (fence) {
      out.push(line);
      continue;
    }
    const open = line.match(containers);
    if (open) {
      const [, indent = '', colons = '', name = '', label] = open;
      const kind = wrappers.has(name) ? 'drop' : labelled.has(name) ? 'label' : 'keep';
      stack.push({ colons: colons.length, kind });
      if (kind === 'label') {
        emit('');
        emit(`${indent}**${(label ?? '').trim()}**`);
        emit('');
      } else if (kind === 'keep') emit(line);
      continue;
    }
    const close = line.match(closing);
    if (close && stack.length) {
      const length = (close[1] ?? '').length;
      const index = stack.findLastIndex(({ colons }) => colons <= length);
      const [ended] = index < 0 ? [] : stack.splice(index);
      if (ended?.kind === 'keep') emit(line);
      else emit('');
      continue;
    }
    const directive = line.match(leaf)?.[1];
    if (directive && dropped.has(directive)) continue;
    emit(line.replace(diagram, (_, alt) => `*Diagram: ${alt}*`));
  }
  return out.join('\n');
}
