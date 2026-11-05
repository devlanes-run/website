import { readFile, writeFile } from 'node:fs/promises';
import { Defuddle } from 'defuddle/node';
import { parseHTML } from 'linkedom';
import { sitePages } from '../src/lib/site.mjs';

// The pages outside the docs have no Markdown source, so their twins are converted from the
// built HTML: Defuddle keeps the main content and drops the header, footer and other chrome.
export default function markdown() {
  return {
    name: 'devlanes:site-markdown',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        for (const { path, twin } of sitePages) {
          const html = await readFile(new URL(`.${path}index.html`, dir), 'utf8');
          const { document } = parseHTML(html);
          // The live TUI's fake units and key hints read as page content.
          for (const element of document.querySelectorAll('.terminal-tui')) element.remove();
          const url = new URL(path, 'https://devlanes.run').href;
          const { content } = await Defuddle(document, url, { markdown: true });
          if (!content.trim()) throw new Error(`Markdown conversion of ${path} is empty`);
          const title = html.match(/<title>(.*?)<\/title>/s)?.[1] ?? 'devlanes';
          await writeFile(new URL(`.${twin}`, dir), `# ${title}\n\n${content}`);
        }
      }
    }
  };
}
