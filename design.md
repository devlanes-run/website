# Website design

## Copy

The headline is "Run every worktree at once, each on its own localhost." Use it in the hero, the `<title>`, the social image and the footer.

devlanes is an open source CLI and a per-user daemon. The first screen says so in plain words at the foot of the sign (nothing to sign up for, nothing hosted), because the page otherwise reads like a hosted product; the licence and the platforms go in the small print at the end. It runs wherever the reader's shell runs, so do not call it "for your own machine". It runs the stack per Git worktree, not "once per": a worktree can hold several lanes. Infra is plural ("own databases"); heavy infra is shared with a database per lane, so never describe Postgres as the thing being shared.

The landing page teaches what devlanes is, not how to use it. Commands appear only inside terminal windows, as one real command with its real output; prose never lists commands, flags or keys. Each fold makes one point with one artefact and links to a page that goes deeper (`/lanes/`, `/remote/`, `/agents/`) or to the docs.

A lane is a running copy of the stack with its own ports, hostnames and data. "Worktree" is the noun in copy; "lane" is introduced once under the status table. Lane domains have no hyphen: `myapp.localhost` for lane 0, `myapp1.localhost` for lane 1. Use `myapp` and `my-vps` in examples; branches `main`, `feat/checkout`, `fix/login` and `agent/perf`. Lanes are not a sandbox and the page says so.

Sentence case everywhere. No em dashes, no "A · B · C" strings, no arrows in links, no tracked uppercase labels, no numbered card grids, no headings that start with What, Why or How. Reuse the sentences a person wrote before inventing new ones.

## Colour and typography

| Token       | Light     | Dark      |
| ----------- | --------- | --------- |
| Surface     | `#f2f2ef` | `#22211e` |
| Text        | `#24231f` | `#f2f0ea` |
| Muted text  | `#63615a` | `#b0ada3` |
| Border      | `#d1cfc7` | `#4c4941` |
| Paint       | `#f5c542` | `#f5c542` |
| Road centre | `#d2ae43` | `#79672f` |

Overpass for everything that is not code: headings in weight 900 with tight letter-spacing (hero `clamp(38px, 5vw, 64px)`, section headings `clamp(28px, 2.9vw, 40px)`), prose 18px/1.6, navigation 600 14px. JetBrains Mono only for code, terminals and the brand. Fonts are self-hosted through Fontsource.

Terminal windows stay dark in both themes: a macOS-style title bar (three dots, the first in paint yellow, centred title), a translucent surface over a blur, 12px corners and a soft shadow. Commands are bold white, raw output muted, ready states green, hostnames yellow.

## Layout

The sign: a full-width paint-yellow block at least 90vh tall holding the header and the hero copy, centred, with the road scene behind it. Its foot fades into the page surface. The hero is the headline, one short lede (the first sentence is "Stop fighting over port 3000.", in the same weight as the rest, so the page has one title) and the install control (`#install`), so the first screen has the command. The control appears again at the end of the page as `#install-again`.

Below the sign the page is a sequence of folds, each roughly a screen tall with 170px between them (96px on phones): the status table, lanes (copy left, terminal right), the live monitor (copy above, terminal full width), remote (terminal left), agents (copy left), then "Run your first lane" with the install control and the small print. Folds alternate sides and stack on phones. The content width is 1200px with 40px side padding, 20px on phones.

Text blocks have opaque surfaces, so the road's centre stroke only shows in the gaps between them. On phones the live terminal runs edge to edge without side borders.

## Road

The sign's background is a three.js scene (`src/scripts/road-scene.ts`, bundled; models in `public/models/`, Kenney Car Kit, CC0, credited at the foot of the sign): four lanes with dashed dividers in the sign's yellow, charcoal toon-shaded cars, the hero car in lane 1 driving from the first frame with the camera behind and to its left, slower traffic in lane 0 and faster traffic in lane 3, fog in the sign's colour so nothing reaches the copy. The car's position follows the copy's bottom edge so it never sits under the text. Nothing is tied to scroll. Phones get the hero lane only, no antialiasing and a capped pixel ratio. Without WebGL the sign stays plain yellow; nothing stands in for the road.

Below the sign the only road element is the double centre stroke: two 3px strokes with a 4px gap, fixed behind the page.

The footer's pause button and the reduced-motion preference set `data-motion` on the root; the scene and the live terminal stop while it says `paused` and when the tab is hidden or they are off screen.

## The live terminal

The monitor fold runs the real devlanes TUI compiled to WebAssembly (`crates/tui-web` in the devlanes repository) against its fake daemon. `scripts/sync.mjs` unpacks the release asset `devlanes-tui-web.tar.gz` into `public/tui/`; it is optional, so a release without it keeps the static screen. `DEVLANES_TUI_DIR` points at a local build (the output of `packaging/scripts/tui-web.sh`).

`src/components/Tui.astro` and `src/scripts/tui.ts` size the terminal in cells of its own font, between 40 and 140 columns and a fixed number of rows (34, 26 on phones). When the width settles after a resize the element gets the new size and `demo.resize()` lays the TUI out again, keeping the open page, the selection and an open unit. The window's title bar shows a green badge, "Live terminal, click to interact", once it is live. Keys go to the TUI while it has focus (Tab always leaves); clicks, taps and the wheel are handled by the bundle itself. Touch screens cycle through the monitor, the lanes view and the daemon page every few seconds until the first tap. The static monitor table built from `src/data/demo.ts` stays without JavaScript, without the bundle, and if the module throws twice. The bundle carries its own website scene (`myapp`, the four demo lanes, every check green), so the terminal shows the same names as the rest of the page.

## Feature pages

`/lanes/`, `/remote/` and `/agents/` use the same layout without the sign: a page title, a lede, folds with one artefact each, links into the docs and the install control. The header marks the current one.

## Docs

Starlight renders `/docs/` with the landing page's header, fonts, colours and theme preference. Headings are Overpass 900 at the landing sizes, body 18px/1.7 in a text column of at most 760px, sidebar and table of contents in Overpass 14px with the current page in a darker paint colour. Code blocks use the terminal window look. The road stays on the landing page.

Config examples fenced as ` ```yaml devlanes ` (a project file) or ` ```yaml devlanes-user ` (`~/.devlanes/config.yaml`) render as an editor tab with the file icon, the file name (the block's file name comment, else the default for its kind) and a paint underline. Hovering a key, or tapping it on a touch screen, shows its description from the JSON Schema with its path as written in the config reference and a link to that section; the tooltip stays dark like the code. A key the schema does not allow fails the build. Untagged YAML (Compose files, partial snippets) renders as plain code. `integrations/config-docs.mjs` holds the plugin.

The Markdown comes from the source repositories listed in `scripts/sync.mjs` and is not committed here. Each build checks out the latest stable release tag of every source once, and takes the docs, the JSON Schemas served at `/v1/`, `/install.sh`, `/install.ps1` and the TUI bundle from that same tag. A file marked optional in `scripts/sync.mjs` is skipped when the tag predates it. A source repository triggers the build after a release with a `source-release` dispatch carrying its `repository` and `tag`; the build refuses a tag that is no longer the latest release. The importer turns the first heading into the page title, links other pages to their routes and other files to GitHub at the built commit. For previews, `DEVLANES_REF` builds another branch or tag, and `DEVLANES_DIR` uses a local checkout of the repository.

Each page shows when it last changed, from the newest commit that touched its source file. A source file with `publish: false` in its frontmatter stays on GitHub only. Other Starlight frontmatter passes through. Images inside the source directory referenced with Markdown image syntax are optimized by Astro; others load from GitHub at the built commit.

The sidebar groups the pages by what a reader is doing, not by the source repository's folders. `src/lib/docs-nav.mjs` holds the groups and their order; a page it does not name lands in the last group, with a build warning, until it is filed.

Pagefind indexes the docs at build time. Every page has a Markdown twin at its URL plus `.md` (`/index.md` for the landing page). Docs twins come from the source Markdown; the landing and feature pages' twins are converted from their built HTML with Defuddle, without the live terminal. `llms.txt` lists the docs twins under the sidebar's groups, with absolute URLs and each page's description, and the other pages under Optional; `llms-full.txt` holds every docs twin in the same order. Both are built in `src/lib/llms.ts`.

## Assets

The mark has three rounded bars staggered right. The top bar is yellow; the lower bars are neutral. On the yellow sign the top bar turns dark. Preserve its proportions.

Every file in `public/assets/`, the favicon and `public/social.png` come from the brand repository (`brand/build.mjs` in the root repository): the favicon and the badge are the sign, a yellow tile with the dark mark; the file icon for editors keeps the yellow bar on a transparent ground so a tab and a file read differently. `banner.svg` is the README banner (1280 by 560) and `og.svg` the social card (1200 by 630, copied to `social.png` at 2x); both draw the sign with the headline, the lede and the status table, with the copy well inside the edges that previews crop. Rebuild there after changing the headline or the lede and copy the output over.

## Interaction

Provide visible keyboard focus and a skip link, except inside the live terminal, where the badge is the focus indicator. Theme selection persists when storage is available. The page remains readable without JavaScript.
