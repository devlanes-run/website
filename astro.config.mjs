import sitemap from '@astrojs/sitemap';
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
import compress from 'astro-compress';
import icon from 'astro-icon';
import slop from 'astro-slop';
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
          'open-in-new'
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
        styleOverrides: {
          borderRadius: '7px',
          borderColor: '#666158',
          codeFontFamily: "'JetBrains Mono', monospace",
          codeFontSize: '12px',
          codeLineHeight: '1.65',
          uiFontFamily: "'JetBrains Mono', monospace",
          uiFontSize: '11px',
          codeBackground: '#1a1917',
          frames: {
            editorBackground: '#1a1917',
            editorTabBarBackground: '#272622',
            editorActiveTabBackground: '#1a1917',
            terminalBackground: '#1a1917',
            terminalTitlebarBackground: '#272622',
            terminalTitlebarBorderBottomColor: '#47443d',
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
