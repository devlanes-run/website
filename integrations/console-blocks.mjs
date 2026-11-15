// Expressive Code plugin for ```console blocks: a terminal window like the landing page's, where
// a line starting with `$ ` (or `PS> ` for PowerShell) is a command and every other line is its
// output. The copy button takes the commands only, without their prompts; a block with no
// command has no copy button. A command ending in `\` (or a PowerShell backtick) continues on
// the next line.
import { definePlugin, ExpressiveCodeAnnotation } from '@astrojs/starlight/expressive-code';
import { h } from '@astrojs/starlight/expressive-code/hast';

const prompt = /^(\$|PS>) /;

class PromptAnnotation extends ExpressiveCodeAnnotation {
  render({ nodesToTransform }) {
    return nodesToTransform.map((node) => h('span', { className: 'dl-prompt' }, node));
  }
}

/** Which lines are commands, and the text the copy button takes. */
export function parseConsole(code) {
  const lines = code.split('\n');
  const commands = [];
  const kinds = [];
  let continued = false;
  for (const line of lines) {
    const match = line.match(prompt);
    if (match || continued) {
      const text = match ? line.slice(match[0].length) : line;
      kinds.push({ command: true, prompt: match ? match[0].length : 0 });
      commands.push(text);
      continued = /[\\`]$/.test(text);
    } else {
      kinds.push({ command: false, prompt: 0 });
    }
  }
  return { kinds, copy: commands.join('\n') };
}

const parsed = new WeakMap();

export function pluginConsole() {
  return definePlugin({
    name: 'devlanes console',
    baseStyles: styles,
    hooks: {
      preprocessLanguage({ codeBlock }) {
        if (codeBlock.language !== 'console') return;
        // Commands are drawn like the landing page's, not highlighted as shell.
        codeBlock.language = 'txt';
        codeBlock.props.frame = 'terminal';
        parsed.set(codeBlock, true);
      },
      annotateCode({ codeBlock }) {
        if (!parsed.has(codeBlock)) return;
        const result = parseConsole(codeBlock.code);
        parsed.set(codeBlock, result);
        result.kinds.forEach(({ prompt: length }, index) => {
          if (!length) return;
          codeBlock
            .getLine(index)
            ?.addAnnotation(
              new PromptAnnotation({ inlineRange: { columnStart: 0, columnEnd: length } })
            );
        });
      },
      postprocessRenderedLine({ codeBlock, lineIndex, renderData }) {
        const result = parsed.get(codeBlock);
        if (!result || result === true) return;
        const kind = result.kinds[lineIndex];
        const line = renderData.lineAst;
        line.properties.className = [
          ...[line.properties.className ?? []].flat(),
          kind?.command ? 'dl-command' : 'dl-output'
        ];
      },
      postprocessRenderedBlock({ codeBlock, renderData }) {
        const result = parsed.get(codeBlock);
        if (!result || result === true) return;
        const figure = renderData.blockAst;
        figure.properties.className = [...[figure.properties.className ?? []].flat(), 'dl-console'];
        const index = figure.children.findIndex(
          (child) =>
            child.type === 'element' && [child.properties?.className ?? []].flat().includes('copy')
        );
        if (index < 0) return;
        if (!result.copy) {
          figure.children.splice(index, 1);
          return;
        }
        const button = figure.children[index].children.find(
          (child) => child.type === 'element' && child.tagName === 'button'
        );
        // The frames plugin's copy script turns \x7F back into line breaks.
        if (button) button.properties.dataCode = result.copy.replace(/\n/g, '\x7F');
      }
    }
  });
}

// Code blocks are dark in both themes; these are the landing terminal's colours
// (src/styles/_terminal.scss): commands bold and bright, output muted.
const styles = `
.frame.dl-console {
  .ec-line.dl-command .code {
    color: #fdfcf8;
    font-weight: 700;
  }

  .ec-line.dl-output .code {
    color: #b3ada0;
  }

  .ec-line .code span {
    color: inherit;
  }

  .dl-prompt {
    color: #a39e91;
    font-weight: 400;
    user-select: none;
  }

  .header .title {
    color: #b5b0a3;
  }
}
`;
