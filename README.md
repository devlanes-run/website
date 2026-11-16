<p align="center">
   <b>Using devlanes?</b> Please consider <a href="https://github.com/sponsors/arthurfiorette" target="_blank">donating</a> to support my open source work ❤️
  <br />
  <sup>
   Help devlanes grow! Star and share this amazing repository with your friends and co-workers!
  </sup>
</p>

<br />

<p align="center" title="devlanes">
  <a href="https://devlanes.run" target="_blank" rel="noopener noreferrer">
    <img src="https://devlanes.run/assets/banner.png" alt="devlanes: Sandboxes for your agents. localhost for you." />
  </a>
</p>

<br />

<p align="center">
  <a title="MIT license" target="_blank" href="https://github.com/devlanes-run/website/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/github/license/devlanes-run/website"></a>
  <a title="devlanes.run" target="_blank" href="https://devlanes.run"><img alt="Website" src="https://img.shields.io/website?url=https%3A%2F%2Fdevlanes.run&label=devlanes.run"></a>
  <a title="CI" target="_blank" href="https://github.com/devlanes-run/website/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/devlanes-run/website/ci.yml?branch=main&label=ci"></a>
  <a title="Last commit" target="_blank" href="https://github.com/devlanes-run/website/commits/main"><img alt="Last commit" src="https://img.shields.io/github/last-commit/devlanes-run/website"></a>
</p>

<br />
<br />

# devlanes website

> The source of devlanes.run.

<br />

This repository builds [devlanes.run](https://devlanes.run): the landing page, the feature pages, the docs and the examples index. It is an [Astro](https://astro.build) site with [Starlight](https://starlight.astro.build) for the docs, deployed to Cloudflare.

The docs are not written here. Each build takes them from the latest release of [devlanes](https://github.com/devlanes-run/devlanes), so to change a docs page, edit it in that repository's `docs/` folder.

<br />

- [Open devlanes.run.](https://devlanes.run)
- [Go to the devlanes repository.](https://github.com/devlanes-run/devlanes)

<br />

## Content sources

`pnpm sync` runs before every build and brings in what this repository does not hold. Nothing it writes is committed.

| Source | Taken from | Becomes |
| --- | --- | --- |
| [devlanes-run/devlanes](https://github.com/devlanes-run/devlanes) | The latest stable release tag | `docs/` at `/docs/`, the config reference generated from the two JSON Schemas, the schemas at `/v1/`, `/install.sh` and `/install.ps1`, and the TUI built for the browser |
| [devlanes-run/examples](https://github.com/devlanes-run/examples) | The `main` branch | `catalog.json` and each example's README at `/examples/` |
| This repository | | The landing page, `/lanes/`, `/remote/`, `/agents/`, the layout, the styles and the Markdown plugins the docs render with |

A docs change reaches the site with the next devlanes release, and an example with the next push to the examples' `main`. Both repositories send this one a `source-release` dispatch, which rebuilds and deploys.

## Develop

You need Node 24.16 or later and pnpm 12.

```sh
pnpm install
pnpm dev
```

`pnpm dev` syncs the content, then serves the site at `http://localhost:4321`. The sync reads GitHub, so it needs a network connection; set `GH_TOKEN` when the anonymous rate limit gets in the way.

To build with content that is not released yet, point the sync somewhere else:

| Variable | Use |
| --- | --- |
| `DEVLANES_REF` | A branch or tag of devlanes to build instead of the latest release |
| `DEVLANES_DIR` | A local checkout of devlanes |
| `DEVLANES_TUI_DIR` | A local build of the browser TUI, the output of `packaging/scripts/tui-web.sh` in devlanes |
| `EXAMPLES_DIR` | A local checkout of the examples |

```sh
DEVLANES_DIR=../devlanes pnpm dev
```

## Check

```sh
pnpm lint
pnpm test-types
pnpm build
pnpm test
```

`pnpm test` runs the unit tests of the sync and the Markdown plugins, then the Playwright tests against the built site, so build first. Playwright needs its browser once: `pnpm exec playwright install chromium`. `pnpm lint-fix` and `pnpm format` fix what the linters report.

A docs page fails the build when a `yaml devlanes` block uses a key the schema does not have, when a Mermaid diagram does not render or has no `accTitle`, or when `docs/nav.yaml` names a page that does not exist.

## Deploy

CI runs the checks on every pull request and comments a preview URL on pull requests from this repository. A push to `main` builds the site and deploys it to Cloudflare with Wrangler.

## Layout

| Path | Holds |
| --- | --- |
| `src/pages/` | The landing page, the feature pages, `llms.txt` and the Markdown twin of every page |
| `src/components/`, `src/layouts/`, `src/styles/` | The parts the pages and the docs share |
| `src/scripts/` | Code that runs in the browser: the road scene, the live TUI, synced tabs, the install control |
| `integrations/` | The Markdown plugins of the docs: directives, config blocks with hovers, the config reference, Mermaid and terminal blocks |
| `scripts/` | The sync of the docs and the examples |
| `test/` | Playwright tests |
| [`design.md`](https://github.com/devlanes-run/website/blob/main/design.md) | The copy rules, colours, layout and how each part of the site works |

## Contributing

Read [`design.md`](https://github.com/devlanes-run/website/blob/main/design.md) before changing copy or layout: it has the wording, the colours and the reason behind each part. For a docs page, open the pull request in [devlanes](https://github.com/devlanes-run/devlanes) instead.

## License

Licensed under the **MIT License**. See [`LICENSE`](https://github.com/devlanes-run/website/blob/main/LICENSE) for more information.
