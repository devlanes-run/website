import sitemap from '@astrojs/sitemap';
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
import compress from 'astro-compress';
import icon from 'astro-icon';
import { pluginConfigDocs } from './integrations/config-docs.mjs';
import markdown from './integrations/markdown.mjs';
import { importedPages } from './scripts/sync-docs.mjs';
import { groupDocs } from './src/lib/docs-nav.mjs';
import { siteDescription as description } from './src/lib/site.mjs';

// Read once when the config loads: restart `astro dev` after a sync adds or removes pages.
const docsGroups = groupDocs(await importedPages());
const sidebar = docsGroups.map(({ label, collapsed, pages }) => ({
  label,
  collapsed,
  items: pages.map((page) => ({ slug: page.id, label: page.label }))
}));
const unfiled = docsGroups.flatMap(({ pages }) => pages.filter((page) => page.unfiled));
if (unfiled.length) {
  console.warn(
    `Docs pages not filed in src/lib/docs-nav.mjs: ${unfiled.map(({ id }) => id).join(', ')}`
  );
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
          'microsoft-windows'
        ]
      }
    }),
    sitemap(),
    starlight({
      title: 'devlanes',
      description,
      favicon: '/favicon.svg',
      customCss: ['./src/styles/docs.scss'],
      // Pages come from scripts/sync-docs.mjs, which writes them under src/content/docs/docs/;
      // src/lib/docs-nav.mjs files them into groups.
      sidebar,
      components: {
        Head: './src/components/docs/Head.astro',
        Header: './src/components/docs/Header.astro',
        PageTitle: './src/components/docs/PageTitle.astro',
        ThemeProvider: './src/components/docs/ThemeProvider.astro',
        ThemeSelect: './src/components/docs/ThemeSelect.astro'
      },
      // Code blocks keep the landing page's dark terminal look in both themes.
      expressiveCode: {
        themes: ['github-dark-default'],
        useStarlightDarkModeSwitch: false,
        plugins: [pluginConfigDocs()],
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
