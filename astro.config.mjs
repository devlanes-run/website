import { readFile } from 'node:fs/promises';
import sitemap from '@astrojs/sitemap';
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
import compress from 'astro-compress';
import icon from 'astro-icon';
import { pluginConfigDocs } from './integrations/config-docs.mjs';
import { pluginConsole } from './integrations/console-blocks.mjs';
import directives from './integrations/directives.mjs';
import markdown from './integrations/markdown.mjs';
import { importedNav, importedPages } from './scripts/sync-docs.mjs';
import { groupDocs, isGroup } from './src/lib/docs-nav.mjs';
import { categories, examplesGroup, taxonomyIcons } from './src/lib/example-taxonomy.mjs';
import { siteDescription as description } from './src/lib/site.mjs';

// Read once when the config loads: restart `astro dev` after a sync adds or removes pages.
const nav = await importedNav();
const pages = await importedPages();
const docs = groupDocs(
  pages.filter(({ id }) => !id.startsWith('examples/')),
  nav
);
/** @param {import('./src/lib/docs-nav.mjs').Group<{ id: string }>} group @returns {any} */
const toSidebar = ({ label, collapsed, items }) => ({
  label,
  collapsed,
  items: items.map((item) => (isGroup(item) ? toSidebar(item) : item.id))
});
const docsSidebar = docs.groups.map(toSidebar);

// The examples have their own sidebar, by category. Starlight takes one sidebar for the whole
// site, so they sit in one group that src/lib/route-data.ts shows on their pages only.
const catalog = JSON.parse(
  await readFile(new URL('./src/data/examples.json', import.meta.url), 'utf8').catch(
    () => '{"examples":[]}'
  )
);
const examplesSidebar = categories
  .map(({ id, label }) => ({
    label,
    items: catalog.examples
      .filter((example) => example.category === id)
      .map((example) => ({ slug: `examples/${example.slug}`, label: example.title }))
  }))
  .filter(({ items }) => items.length > 0);
const sidebar = examplesSidebar.length
  ? [...docsSidebar, { label: examplesGroup, items: examplesSidebar }]
  : docsSidebar;
const examplesIcons = taxonomyIcons();
if (!nav) console.warn('The docs source has no nav.yaml: every page is in one sidebar group.');
if (nav && docs.unfiled.length) {
  console.warn(`Docs pages not in nav.yaml: ${docs.unfiled.map(({ id }) => id).join(', ')}`);
}

/** Paths in nav.yaml without a page fail a build, and only warn in `astro dev` while writing. */
function checkNav() {
  return {
    name: 'devlanes:docs-nav',
    hooks: {
      'astro:config:setup': ({ command, logger }) => {
        if (!docs.missing.length) return;
        const message = `docs/nav.yaml names pages that do not exist: ${docs.missing.join(', ')}`;
        if (command === 'build') throw new Error(message);
        logger.warn(message);
      }
    }
  };
}

export default defineConfig({
  site: 'https://devlanes.run',
  output: 'static',
  integrations: [
    icon({
      include: {
        mdi: [
          'github',
          'weather-sunny',
          'weather-night',
          'content-copy',
          'language-markdown-outline',
          'open-in-new',
          'apple',
          'linux',
          'microsoft-windows',
          'magnify',
          ...(examplesIcons.mdi ?? [])
        ],
        'simple-icons': examplesIcons['simple-icons'] ?? [],
        logos: examplesIcons.logos ?? []
      }
    }),
    sitemap(),
    checkNav(),
    // Before Starlight, whose catch-all for unknown directives runs right after it.
    directives(),
    starlight({
      title: 'devlanes',
      description,
      favicon: '/favicon.svg',
      customCss: ['./src/styles/docs.scss'],
      // Pages come from scripts/sync-docs.mjs, which writes them under src/content/docs/docs/;
      // src/lib/docs-nav.mjs files them into the groups of docs/nav.yaml.
      sidebar,
      routeMiddleware: './src/lib/route-data.ts',
      components: {
        Head: './src/components/docs/Head.astro',
        Header: './src/components/docs/Header.astro',
        PageTitle: './src/components/docs/PageTitle.astro',
        Pagination: './src/components/docs/Pagination.astro',
        ThemeProvider: './src/components/docs/ThemeProvider.astro',
        ThemeSelect: './src/components/docs/ThemeSelect.astro'
      },
      // Code blocks keep the landing page's dark terminal look in both themes.
      expressiveCode: {
        themes: ['github-dark-default'],
        useStarlightDarkModeSwitch: false,
        plugins: [pluginConfigDocs(), pluginConsole()],
        styleOverrides: {
          borderRadius: '12px',
          borderWidth: '1px',
          borderColor: 'rgba(255, 255, 255, 0.09)',
          codeFontFamily: "'JetBrains Mono', monospace",
          codeFontSize: '13px',
          codeLineHeight: '1.65',
          codePaddingBlock: '18px',
          codePaddingInline: '22px',
          uiFontFamily: "'JetBrains Mono', monospace",
          uiFontSize: '11.5px',
          codeBackground: '#1a1917',
          codeSelectionBackground: 'rgba(245, 197, 66, 0.3)',
          scrollbarThumbColor: 'rgba(255, 255, 255, 0.14)',
          scrollbarThumbHoverColor: 'rgba(255, 255, 255, 0.28)',
          frames: {
            editorBackground: '#1a1917',
            // The frame itself has no background, so the bars are the landing terminal's
            // rgba(255,255,255,.035) over #1a1917 flattened to a solid colour.
            editorTabBarBackground: '#22211f',
            editorTabBarBorderColor: 'transparent',
            editorTabBarBorderBottomColor: 'rgba(255, 255, 255, 0.07)',
            editorActiveTabBackground: 'transparent',
            editorActiveTabBorderColor: 'transparent',
            editorActiveTabForeground: '#a9a396',
            editorActiveTabIndicatorTopColor: 'transparent',
            editorActiveTabIndicatorBottomColor: 'transparent',
            terminalBackground: '#1a1917',
            terminalTitlebarBackground: '#22211f',
            terminalTitlebarBorderBottomColor: 'rgba(255, 255, 255, 0.07)',
            terminalTitlebarForeground: '#a9a396',
            terminalTitlebarDotsForeground: '#4a463f',
            terminalTitlebarDotsOpacity: '1',
            inlineButtonBackground: '#2a2925',
            inlineButtonBorder: 'rgba(255, 255, 255, 0.12)',
            inlineButtonForeground: '#e8e6df',
            shadowColor: 'transparent',
            frameBoxShadowCssValue: 'none'
          }
        }
      },
      head: [
        {
          tag: 'meta',
          attrs: { property: 'og:image', content: 'https://devlanes.run/social.png' }
        },
        {
          tag: 'meta',
          attrs: { name: 'twitter:image', content: 'https://devlanes.run/social.png' }
        }
      ]
    }),
    markdown(),
    compress({ CSS: true, Image: true, JavaScript: true, SVG: true, HTML: true })
  ]
});
