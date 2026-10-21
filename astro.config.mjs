import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import compress from 'astro-compress';
import icon from 'astro-icon';
import slop from 'astro-slop';
import markdown from './integrations/markdown.mjs';

export default defineConfig({
  site: 'https://devlanes.run',
  output: 'static',
  integrations: [
    icon({ include: { mdi: ['github', 'weather-sunny', 'weather-night'] } }),
    sitemap(),
    markdown(),
    slop({
      siteName: 'devlanes',
      siteDescription:
        'devlanes runs development stacks locally or on remote machines with localhost access. It is in early development and is not ready to use.',
      injectAlternateLink: false
    }),
    compress({ CSS: true, Image: true, JavaScript: true, SVG: true, HTML: true })
  ]
});
