# Website design

## Copy

The headline is "Run every worktree at once, each on its own localhost." Use it in the hero, the `<title>`, the social image and the footer.

devlanes is an open source CLI and a per-user daemon. The "Free and open source" fold near the end says so in plain words (no account, nothing hosted, the licence and the platforms), because the page otherwise reads like a hosted product. It runs wherever the reader's shell runs, so do not call it "for your own machine". It runs the stack per Git worktree, not "once per": a worktree can hold several lanes. Infra is plural ("own databases"); heavy infra is shared with a database per lane, so never describe Postgres as the thing being shared.

The landing page teaches what devlanes is, not how to use it. Commands appear only inside terminal windows, as one real command with its real output; prose never lists commands, flags or keys. Each fold makes one point with one artefact and links to a page that goes deeper (`/lanes/`, `/remote/`, `/agents/`) or to the docs.

A lane is a running copy of the stack with its own ports, hostnames and data. "Worktree" is the noun in copy; "lane" is introduced once, in the first fold's line. Lane domains have no hyphen: `myapp.localhost` for lane 0, `myapp1.localhost` for lane 1. Use `myapp` and `my-vps` in examples; branches `main`, `feat/checkout`, `fix/login` and `agent/perf`. Lanes are not a sandbox and the page says so.

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

The sign: a full-width paint-yellow block 90vh tall (so the page shows it goes on) holding the header and the hero copy, centred, with the road scene behind it. Its foot fades into the page surface. Text selected on the sign is dark with yellow type, since the page's yellow selection would vanish there. The hero is the headline, one short lede (the first sentence is "Stop fighting over port 3000.", in the same weight as the rest, so the page has one title; no code literal in it) and the install control (`#install`, a system row, a method row and the command; no channel switch), so the first screen has the command; phones hide it, since a phone will not run a shell script, and keep the one at the end. The control appears again at the end of the page as `#install-again`.

Below the sign the page is a sequence of folds, each roughly a screen tall with 170px between them (96px on phones): three `devlanes start` windows side by side (`main`, `feat/checkout` and `agent/perf` on `my-vps`, the remote title in paint; two across under 1120px, a horizontal snap row on phones), the live monitor (copy above, terminal full width), lanes (copy left, the `devlanes.yaml` right), remote (terminal left), agents (copy left, a chat where the agent tails a lane you started), "Free and open source" (one column of copy with GitHub-styled star and sponsor buttons), then "Run your first lane" with the install control and the caveats. Each fold's heading links to the fold, with a hash shown on hover. The footer carries the brand, the tagline, two columns of links (product, docs) and the small print with the project links in a row. The brand assets page at `/assets/` shows every file on the ground it was drawn for, with its SVG and PNG under it; only the footer links to it. Folds alternate sides and stack on phones. The content width is 1200px with 40px side padding, 20px on phones.

Text blocks have opaque surfaces, so the road's centre stroke only shows in the gaps between them. On phones the live terminal runs edge to edge without side borders.

## Road

The sign's background is a three.js scene (`src/scripts/road-scene.ts`, bundled; models in `public/models/`, Kenney Car Kit, CC0, credited at the foot of the sign): four lanes with dashed dividers in the sign's yellow, charcoal toon-shaded cars, the hero car in lane 1 driving from the first frame with the camera behind and to its left, slower traffic in lane 0 and faster traffic in lane 3, fog in the sign's colour so nothing reaches the copy. The car's position follows the copy's bottom edge so it never sits under the text. Nothing is tied to scroll. Phones get the hero lane only, no antialiasing and a capped pixel ratio. Without WebGL the sign stays plain yellow; nothing stands in for the road.

Below the sign the only road element is the centre line: a single 8px dashed stroke (64px dashes, 48px gaps), fixed behind the page, drawn as a crisp SVG pattern so it stays even at fractional zoom.

The footer's pause button and the reduced-motion preference set `data-motion` on the root; the scene and the live terminal stop while it says `paused` and when the tab is hidden or they are off screen.

## The live terminal

The monitor fold runs the real devlanes TUI compiled to WebAssembly (`crates/tui-web` in the devlanes repository) against its fake daemon. `scripts/sync.mjs` unpacks the release asset `devlanes-tui-web.tar.gz` into `public/tui/`; it is optional, so a release without it leaves the window empty. `DEVLANES_TUI_DIR` points at a local build (the output of `packaging/scripts/tui-web.sh`).

`src/components/Tui.astro` and `src/scripts/tui.ts` size the terminal in cells of its own font, between 40 and 140 columns and a fixed number of rows (34, 26 on phones). When the width settles after a resize the element gets the new size and `demo.resize()` lays the TUI out again, keeping the open page, the selection and an open unit. One line sits above the window. A paint pill, "Click to interact", sits over the screen from the first paint until the pointer first reaches the live TUI; while the bundle loads the screen under it is empty, at the live grid's height, and the TUI appears in it with its history already drawn. Once it is live the title bar also shows a small green badge, "Live, click to interact". Keys go to the TUI while it has focus (Tab always leaves); clicks, taps and the wheel are handled by the bundle itself. Touch screens cycle through the monitor, the lanes view and the daemon page every few seconds until the first tap. Without JavaScript, without the bundle, and if the module throws twice, the window stays empty at that height; there is no hand-drawn copy of the screen to keep in step with the TUI. The bundle carries its own website scene (`myapp`, the four demo lanes, every check green), so the terminal shows the same names as the rest of the page.

## Feature pages

`/lanes/`, `/remote/` and `/agents/` use the same layout without the sign: a page title, a lede, folds with one artefact each, links into the docs and the install control. The header marks the current one. Everything about `devlanes mcp` stays on `/agents/`: its fold shows a chat window titled with the host (`Cursor`) where the `start` tool renders as an MCP App card (`McpChat.astro`), in the host's sans font, with the lane's services, a Ready badge and Stop lane and Open web buttons. The landing page mentions agents in one fold only.

## Docs

Starlight renders `/docs/` with the landing page's header, fonts, colours and theme preference. Headings are Overpass 900 at the landing sizes, body 18px/1.7 in a text column of at most 760px, sidebar and table of contents in Overpass 14px with the current page in a darker paint colour. Code blocks use the terminal window look. The road stays on the landing page.

Config examples fenced as ` ```yaml devlanes ` (a project file) or ` ```yaml devlanes-user ` (`~/.devlanes/config.yaml`) render as an editor tab with the file icon, the file name (the block's file name comment, else the default for its kind) and a paint underline. Hovering a key, or tapping it on a touch screen, shows its description from the JSON Schema with its path as written in the config reference and a link to that section; the tooltip stays dark like the code. A key the schema does not allow fails the build. Untagged YAML (Compose files, partial snippets) renders as plain code. `integrations/config-docs.mjs` holds the plugin.

The Markdown comes from the source repositories listed in `scripts/sync.mjs` and is not committed here. Each build checks out the latest stable release tag of every source once, and takes the docs, the JSON Schemas served at `/v1/`, `/install.sh`, `/install.ps1` and the TUI bundle from that same tag. A file marked optional in `scripts/sync.mjs` is skipped when the tag predates it. A source repository triggers the build after a release with a `source-release` dispatch carrying its `repository` and `tag`; the build refuses a tag that is no longer the latest release. The importer turns the first heading into the page title, links other pages to their routes and other files to GitHub at the built commit. For previews, `DEVLANES_REF` builds another branch or tag, and `DEVLANES_DIR` uses a local checkout of the repository.

Each page shows when it last changed, from the newest commit that touched its source file. A source file with `publish: false` in its frontmatter stays on GitHub only. Other Starlight frontmatter passes through. Images inside the source directory referenced with Markdown image syntax are optimized by Astro; others load from GitHub at the built commit.

The docs own their sidebar: `docs/nav.yaml` in the source lists the groups, their pages and one level of subgroups, and `src/lib/docs-nav.mjs` reads it for the sidebar and for `llms.txt`. A path that names no page fails the build (and only warns in `astro dev`); a page it does not name lands in the last group with a warning. Pages of a `sequence: true` group, such as Learn, link their neighbours and show their position; other pages have no previous or next link.

The config reference under `/docs/reference/config/` is generated at sync time from the two JSON Schemas by `integrations/config-reference.mjs`: one page per top-level key of each file, an entry per key with its dotted path as the heading and anchor, and no tables. The pages are ordinary entries of the docs collection, so they have Markdown twins, are searched and can be named in `nav.yaml`. The hovers link to the same entries.

Pages stay plain Markdown and use directives (`integrations/directives.mjs`): `::::tabs{sync="os"}` with `:::tab[Label]` children switch together across pages and remember the choice, and show every tab under its label without JavaScript; `:::steps` numbers an ordered list; `::::compare` with `:::side[Title]` children draws the two columns of the ledger on `/remote/`; `::tui{view="monitor"}` embeds the live TUI, or nothing without the bundle or JavaScript. An SVG next to the page placed with image syntax is inlined, so it follows the theme through `currentColor` and `--dl-diagram-line`, `--dl-diagram-fill` and `--dl-diagram-accent`; it needs alt text. A ` ```mermaid ` fence is rendered at build time to the same kind of inline SVG (`integrations/mermaid.mjs`, with beautiful-mermaid: no browser in the build and no script in the page), so it reads without JavaScript; its colours are the `--dl-mermaid-*` variables, mapped to the site's tokens so one render follows both themes. It takes flowcharts, state, sequence, class, ER and XY chart diagrams, needs an `accTitle:` line as its label, and any other kind fails the build; the Markdown twin keeps the fence. ` ```console ` blocks render as a terminal where `$ ` and `PS> ` lines are commands, and copying takes the commands only. The Markdown twins keep the content of each directive without its syntax (`src/lib/docs-twin.mjs`).

Pagefind indexes the docs at build time. Every page has a Markdown twin at its URL plus `.md` (`/index.md` for the landing page). Docs twins come from the source Markdown; the landing and feature pages' twins are converted from their built HTML with Defuddle, without the live terminal. `llms.txt` lists the docs twins under the sidebar's groups, with absolute URLs and each page's description, then the examples, and the other pages under Optional; `llms-full.txt` holds every docs twin in the same order, without the examples. Both are built in `src/lib/llms.ts`.

## Examples

`/examples/` lists the runnable projects of devlanes-run/examples. `scripts/sync-examples.mjs` clones that repository's `main` on every build (examples are not versioned, so they do not wait for a release), writes the `ready` entries of its `catalog.json` to `src/data/examples.json` and turns each example's README into a Starlight page at `/examples/<slug>/`. Neither is committed. `EXAMPLES_DIR` points the sync at a local checkout. A push to the examples repository's `main` sends the website a `source-release` dispatch, which rebuilds and deploys.

The index opens like a feature page: the title and a two-sentence lede on the left, a terminal with the clone commands on the right. Under it sit the search field and three rows of filters (Category, Built with, Teaches), then a section per category with a heading, one line of copy and its examples. The filters and each category are separate blocks with dissolving edges, so the road's centre line shows between them down the whole page. No cards and no badges: an example is a full-width line between dashed rules, with the icon that stands for it in a tinted square, the title, the catalogue's description, the config keys it teaches as small paint-coloured code (the darker paint on the light theme), and on the right the icons of everything it is built with and what it needs. A filter is plain text with its icon and a count; a chosen one gets a paint marker, and one that would leave nothing dims. On phones the filters open from a "Filters" link.

`src/lib/example-taxonomy.mjs` decides how the catalogue is read: the categories' order and copy, which `frameworks` values are a tool with an icon and a filter, and how the hundred-odd `features` fold into a dozen groups. Icons are the brands' own logos in their own colours; a logo that is black is drawn in the text colour so it reads in both themes, and its unfilled shapes follow the text colour too. Search is a weighted word match over the title, the folder name, the tools, the features and the description, done in the page (`src/scripts/examples.ts`); filters and the query live in the URL, so a filtered list can be linked.

An example's page is its README under the docs layout, with the Examples link current in the header and its own sidebar: the examples by category, without the docs (`src/lib/route-data.ts`). Above the README, `ExampleFacts.astro` shows the clone and start commands in a terminal block with a link to the code, then what the example is built with, what it needs and what it teaches, each feature group linking back to the index filtered by it. GitHub links in a README to the devlanes docs or to another example become site links; links to an example's files go to GitHub at the built commit. The index's Markdown twin, `/examples.md`, is written from the catalogue instead of converted from HTML.

The docs page of commented config files (`/docs/examples/`) is "Config files" in the sidebar and the footer, so "Examples" means one thing.

## Assets

The mark has three rounded bars staggered right. The top bar is yellow; the lower bars are neutral. On the yellow sign the top bar turns dark. Preserve its proportions.

Every file in `public/assets/`, the favicon and `public/social.png` come from the brand repository (`brand/build.mjs` in the root repository): the favicon and the badge are the sign, a yellow tile with the dark mark; the file icon for editors keeps the yellow bar on a transparent ground so a tab and a file read differently. `banner.svg` is the README banner (1280 by 560) and `og.svg` the social card (1200 by 630, copied to `social.png` at 2x); both draw the sign with the headline, the lede and the status table, with the copy well inside the edges that previews crop. Rebuild there after changing the headline or the lede and copy the output over.

`public/assets/chrome-web-store/` is the exception: the Chrome Web Store listing of the browser extension, drawn here because it uses the site's fonts and marks. `scripts/store-images/slides.html` holds one section per image and `pnpm store-images` renders them with Playwright at the sizes the store checks, without alpha except on the icon. The popup images next to it are copied from `pnpm -C packages/extension screenshots` in devlanes-run/browser; copy them again when the popup changes. The copy claims only what the extension does today.

## Interaction

Provide visible keyboard focus and a skip link, except inside the live terminal, where the badge is the focus indicator. Theme selection persists when storage is available. The page remains readable without JavaScript.
