# devlanes website

Static Astro website for [devlanes.run](https://devlanes.run), deployed to Cloudflare Workers static assets. Repository: [devlanes-run/website](https://github.com/devlanes-run/website).

## Development

Use Node.js 24.16 or newer and pnpm 12.6.0. With nvm installed:

```sh
nvm install
nvm use
npm install --global pnpm@12.6.0
pnpm install
pnpm dev
```

| Command | Purpose |
| --- | --- |
| `pnpm build` | Generate the static site and sitemap in `dist/` |
| `pnpm preview` | Serve the production build locally |
| `pnpm test-types` | Check Astro templates and TypeScript |
| `pnpm lint` | Check formatting and lint rules |
| `pnpm lint-ci` | Run Biome and Astro/SCSS formatting checks |
| `pnpm format` | Format supported files |
| `pnpm lint-fix` | Apply fixes, including unsafe fixes; review the diff |
| `pnpm test` | Run Playwright against the production preview |
| `pnpm deploy` | Deploy the existing build to production |
| `pnpm deploy:preview` | Upload the existing build as a branch Preview |

Before the first browser test, run `pnpm exec playwright install chromium`. Run `pnpm build` before `pnpm test`; Playwright starts the production preview automatically.

## Cloudflare Workers Builds

Connect `devlanes-run/website` to the Worker named `website`, matching `wrangler.jsonc`. Use repository root `/` and production branch `main`.

| Dashboard field | Command |
| --- | --- |
| Build command | `pnpm build` |
| Deploy command | `pnpm deploy` |
| Preview command | `pnpm deploy:preview` |

The deploy scripts only upload the existing `dist/` build. `deploy` uses `wrangler deploy`; `deploy:preview` uses `wrangler preview` to create a branch Preview without promoting it to production. Cloudflare manages deployment credentials. No GitHub deployment job or Cloudflare GitHub secrets are needed. GitHub Actions runs lint, types, build and browser checks independently.

Attach `devlanes.run` under the Worker's custom domains. Keep production publicly accessible: if Cloudflare Access is enabled, scope it to previews rather than all traffic so people and crawlers can read the landing page. Astro remains fully static with no Worker script or server adapter.

For a manual deployment, authenticate Wrangler, run `pnpm build`, then `pnpm deploy`. For a local deployment check, use `pnpm exec wrangler deploy --dry-run`.

## Shared configuration

Tooling follows `jev-playwright`: pnpm 12.6.0, Node.js 24, explicit esbuild build permission, and `@arthurfiorette/biomejs-config`. `tsconfig.json` extends Astro's strict preset with `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`.

TypeScript uses version 6 rather than the reference project's version 7 because `@astrojs/check@0.9.11` accepts TypeScript 5 or 6. Keep that compatibility requirement in mind when updating dependencies.

Biome handles JavaScript, TypeScript and JSON. Prettier with its Astro plugin handles complete Astro templates and SCSS; Biome's partial Astro support otherwise reports template imports as unused. Styles are split into SCSS partials in `src/styles/`, and `src/pages/index.astro` composes the landing sections.

## Crawlers and assets

`astro-slop` generates `llms.txt` and `llms-full.txt`. The Markdown endpoint uses its HTML converter in development. During static builds, `integrations/markdown.mjs` passes the built homepage to the same converter before slop indexes the result. `index.md` is derived from the page, with no separate product copy to maintain or production-site fetch. Cloudflare Workers static assets serves these static files directly; content negotiation requires a runtime and is not configured.

The sitemap, canonical URL, social metadata and structured data target `devlanes.run`. `robots.txt` allows crawlers. `astro-compress` optimizes the built HTML, scripts, styles and images. The Astro 7 peer allowance for `astro-slop` matches the reference `place` setup and is covered by generated-output tests.

Current SVG/PNG assets are in `public/assets/` and listed at `/assets/`. Keep source assets in these folders; compression only changes `dist/`. The root favicon and social banner are copies used by metadata. Plausible uses the supplied `metrics.arthur.one` script in `SiteLayout.astro`.

To reuse this setup, update the package metadata, Astro `site`, Wrangler project name, and custom domain. Commit `pnpm-lock.yaml`; CI requires a frozen lockfile. Dependabot checks npm packages and GitHub Actions weekly.
