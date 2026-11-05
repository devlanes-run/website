import sitemap from '@astrojs/sitemap';
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
import compress from 'astro-compress';
import icon from 'astro-icon';
import slop from 'astro-slop';
import { pluginConfigDocs } from './integrations/config-docs.mjs';
import markdown from './integrations/markdown.mjs';

const description =
  'devlanes runs development stacks locally or on remote machines with localhost access.';

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
      // Pages come from scripts/sync-docs.mjs, which writes them under src/content/docs/docs/.
      sidebar: [{ autogenerate: { directory: 'docs' } }],
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
    slop({ siteName: 'devlanes', siteDescription: description, injectAlternateLink: false }),
    compress({ CSS: true, Image: true, JavaScript: true, SVG: true, HTML: true })
  ]
});
