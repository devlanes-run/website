# devlanes: Kinetic design

## Product and voice

The main phrase is "Sandboxes for your agents. localhost for you." Keep it fixed in the hero and use it for social previews.

A lane is a running stack with its own service configuration, ports and data. Lanes can use worktrees, separate checkouts or the same checkout. The host machine or container defines the security boundary; a lane alone does not promise isolation from untrusted code.

Explain remote execution through things people open locally: a browser, database client or desktop window. Examples use `myapp`, `my-vps` and generic agent conversations. Describe unfinished functionality as a planned workflow. The development notice and preview labels stay until the product is available; do not publish a placeholder install command.

## Colour and type

| Token | Light | Dark |
| --- | --- | --- |
| Surface | `#f2f2ef` | `#22211e` |
| Text | `#24231f` | `#f2f0ea` |
| Muted text | `#63615a` | `#b0ada3` |
| Border | `#d1cfc7` | `#4c4941` |
| Paint | `#f5c542` | `#f5c542` |

JetBrains Mono carries headings, navigation and terminal data. Overpass carries explanatory prose. Both are self-hosted through Fontsource. Use sentence case, tight headline tracking and ordinary text sizes for explanations. The hero scales from about 25px on narrow screens to 48px on desktop; section headings use 24–31px.

Terminal surfaces stay dark in both themes. Muted terminal text must remain readable. Green indicates ready services. Amber, blue, lavender and teal distinguish process groups, not service health.

## Layout

Use a centred hero with a full-width terminal preview, then alternate explanatory text with a concrete terminal example. The lane section is an open row of explanations with dashed separators. Avoid repeated feature cards, decorative badges and invented metrics.

Content has a 1200px outer width including 40px side padding. Mobile padding is 20px. Desktop section spacing is 128px, reducing to 80px on mobile. Dense terminal tables scroll inside their own labelled regions; the page itself must not overflow horizontally.

Headings and body copy have opaque page-colour backgrounds so the road never crosses through text. Terminal windows use a restrained border, 7px corners and a small paint-tinted surround. Buttons use 5px corners. Yellow identifies primary actions, the mark and centre road lines.

## Road and motion

The vertical road continues throughout the page. Grey dividers are 2px; both yellow centre strokes are 3px with an opaque 4px gap. Dividers and process groups share one lane-width token: 160px on desktop, 100px on small screens.

Groups contain `web`, `api` and `worker` symbols in a shared colour. Symbols are about 32px and sit halfway between dividers. Left-side traffic travels down; right-side traffic travels up. Traffic passes behind the content. Road markings move upward at 20% of scroll speed.

Keep the headline still and agent examples user-controlled. Provide a pause button. Honour reduced motion at startup and when the preference changes. Stop animation frames while paused or when the tab is hidden. The road remains visible without JavaScript.

## Mark and assets

The mark is three rounded bars staggered to the right. Its top bar is always yellow. Lower bars use a neutral appropriate to the surface. Keep the mark upright with its original proportions.

- The original dark-tile favicon is preferred for browser tabs.
- The transparent universal file icon uses mid-grey lower bars with thin charcoal outlines.
- The road-detail badge is for larger avatars and app icons.
- The square badge has a full-bleed dark background, no border and no rounded corners.
- Social banners use the approved headline and terminal preview. SVG typography is outlined for portability.

The landing repository includes only the assets it serves in `public/`. The original brand repository owns the generators and SVG/PNG master assets.

## Interaction and delivery

Use semantic HTML, visible keyboard focus, a skip link and meaningful button labels. Theme preference persists when browser storage is available. Agent example buttons expose their selected state and associated panel; examples never auto-advance.

Build static HTML with Astro. Add JavaScript only for theme controls, examples and road motion. Avoid a client-side UI framework or runtime syntax-highlighting dependency. Check light/dark desktop layouts, narrow mobile layouts, reduced motion, no-JavaScript content and internal navigation with Playwright before deployment.
