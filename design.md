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

## Road

The vertical road covers the page. Grey dividers are 2px wide. Each yellow centre stroke is 3px, with an opaque 4px gap. Dividers and process groups share a lane-width token: 160px on desktop and 100px on small screens.

Each process group contains matching `web`, `api` and `worker` symbols. Symbols are about 32px and sit midway between dividers. Left-side groups move down; right-side groups move up. They pass behind page content. Markings move upward at 20% of the scroll speed.

The footer contains a pause button. Honour reduced-motion preferences and stop animation frames while paused or when the tab is hidden. Agent examples change only when selected.

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
