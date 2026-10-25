# Website design

## Copy

The headline is "Sandboxes for your agents. localhost for you." Use it in the hero and social previews.

A lane is a running stack with its own ports and data. It may use a worktree, another checkout or the same checkout. The host machine or container defines its security boundary.

Use `myapp` and `my-vps` in examples. Agent conversations use a generic agent and model. Describe operations in the present tense. The team-only landing page uses the intended product experience, including installation, without development notices or mockup labels.

## Colour and typography

| Token | Light | Dark |
| --- | --- | --- |
| Surface | `#f2f2ef` | `#22211e` |
| Text | `#24231f` | `#f2f0ea` |
| Muted text | `#63615a` | `#b0ada3` |
| Border | `#d1cfc7` | `#4c4941` |
| Paint | `#f5c542` | `#f5c542` |

Use JetBrains Mono for headings, navigation and terminal text; Overpass for prose. Fonts are self-hosted through Fontsource. Headings use sentence case. Hero text scales from 25px to 48px; section headings use 24px to 31px.

Terminals remain dark in both themes. Green indicates ready services. Process groups use amber, blue, lavender or teal.

## Layout

Centre the hero above the terminal preview. Follow it with text and terminal examples in two columns, stacked on mobile. Lane explanations use dashed separators.

The content width is 1200px, including 40px side padding. Mobile padding is 20px. Section spacing is 128px on desktop and 80px on mobile. Wide tables scroll within labelled, keyboard-accessible regions.

Text backgrounds are opaque so road markings cannot cross the copy. Terminal windows have a border, 7px corners and a narrow yellow-tinted surround. Buttons have 5px corners.

Terminal examples show real devlanes commands and output, taken from the CLI snapshots (`crates/cli/tests/it/snapshots/`) and TUI screens (`crates/tui/screens/`) of the devlanes repository with the demo names substituted: project `myapp`, box `my-vps`, branches `main`, `feat/checkout`, `fix/login` and `agent/perf`. Examples may leave out lines and columns, but never show a command, flag, key or field that devlanes does not have. `src/data/demo.ts` holds the lanes and resource figures shared by the status table and the monitor. The agent examples are switched by buttons above the terminal, on the page background, so they read as page controls rather than agent output; without JavaScript the buttons are hidden and the first example shows.

## Road

The vertical road covers the page. Grey dividers are 2px wide. Each yellow centre stroke is 3px, with an opaque 4px gap. Dividers and process groups share a lane-width token: 160px on desktop and 100px on small screens.

Each process group contains matching `web`, `api` and `worker` symbols. Symbols are about 32px and sit midway between dividers. Left-side groups move down; right-side groups move up. They pass behind page content. Markings move upward at 20% of the scroll speed.

The footer contains a pause button. Honour reduced-motion preferences and stop animation frames while paused or when the tab is hidden. Agent examples change only when selected.

## Docs

Starlight renders `/docs/` with the landing page's header, fonts, colours and theme preference. The header component, theme script, fonts and Plausible snippet are shared, so a change applies to both. Page titles use the section heading size; body text is 18px Overpass; navigation, sidebars and the table of contents use 13px JetBrains Mono. The current page is highlighted in paint yellow. Code blocks use the dark terminal style in both themes. The road stays on the landing page so long pages remain readable.

The Markdown comes from the source repositories listed in `scripts/sync.mjs` and is not committed here. Each build checks out the latest stable release tag of every source once, and takes the docs, the JSON Schemas served at `/v1/`, `/install.sh` and `/install.ps1` from that same tag. A file marked optional in `scripts/sync.mjs` is skipped when the tag predates it. A source repository triggers the build after a release with a `source-release` dispatch carrying its `repository` and `tag`; the build refuses a tag that is no longer the latest release. The importer turns the first heading into the page title, links other pages to their routes and other files to GitHub at the built commit. For previews, `DEVLANES_REF` builds another branch or tag, and `DEVLANES_DIR` uses a local checkout of the repository.

Each page shows when it last changed, from the newest commit that touched its source file. The import clones the source history without file contents, so the dates match the repository rather than the build.

A source file with `publish: false` in its frontmatter stays on GitHub only; links to it open the file there. Other Starlight frontmatter, such as `sidebar.order`, `sidebar.hidden` or `pagefind: false`, passes through. Images inside the source directory referenced with Markdown image syntax are optimized by Astro. Images in raw HTML or outside the directory load from GitHub at the built commit.

Pagefind indexes the docs at build time. Every docs page has a Markdown twin at its URL plus `.md`, which `astro-slop` lists in `llms.txt` and `llms-full.txt` beside the landing page.

## Assets

The mark has three rounded bars staggered right. The top bar is yellow; the lower bars are neutral. Preserve its proportions.

- Use the dark-tile favicon for browser tabs.
- Universal file icons have mid-grey bars with charcoal outlines.
- Use the road-detail badge for large avatars.
- The square badge has an edge-to-edge dark background without a border or rounded corners.
- Banner SVGs use outlined text so rendering does not depend on installed fonts.

Served assets are in `public/assets/`. Source generators remain in the brand repository.

## Interaction

Provide visible keyboard focus and a skip link. Theme selection persists when storage is available. Example buttons expose their selected state and associated panel. The page remains readable without JavaScript.
