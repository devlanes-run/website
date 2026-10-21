import { readFile, writeFile } from 'node:fs/promises';
import { fromHtml } from 'astro-slop';

// slop's HTML helper normally fetches a live server. A data URL lets static builds
// convert their own completed HTML, without fetching the production site.
export default function markdown() {
  return {
    name: 'devlanes:static-markdown',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        const html = await readFile(new URL('index.html', dir), 'utf8');
        const source = `data:text/html;base64,${Buffer.from(html).toString('base64')}`;
        const response = await fromHtml(source)({ request: new Request('https://devlanes.run/') });
        if (!response.ok) throw new Error(`Markdown conversion failed: ${response.status}`);
        const title = html.match(/<title>(.*?)<\/title>/s)?.[1] ?? 'devlanes';
        await writeFile(new URL('index.md', dir), `# ${title}\n\n${await response.text()}`);
      }
    }
  };
}
