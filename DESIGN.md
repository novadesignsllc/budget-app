# Design system

This file is the source of truth for how the app looks. The tokens live in `src/theme/index.ts`. If the two disagree, fix whichever one is wrong. Don't add a second token file.

## Brand

- Product: a personal budgeting app built around paying off debt. Every dollar of cash gets a job, credit cards only exist as debt, and every transaction is entered by hand.
- Audience: one person (the owner), every day, mostly on an iPhone.
- Tone: plain and direct, a little firm about debt. Say what happens, not how great it is.
- References: the two inspiration shots in the planning chat. From the light one we took the soft lavender-to-pink wash, big confident numbers, and pill buttons in ink. From the dark one we took the near-black background, raised dark surfaces, and white figures.

## Color

Light and dark are declared as pairs in `src/theme/index.ts` and follow the system setting.

| Token | Light | Dark | Used for |
| --- | --- | --- | --- |
| background | #F4F4F6 | #000000 | screen behind everything |
| surface | #FFFFFF | #141416 | grouped sections, sheets |
| fill | #EBEBEF | #232327 | inputs, chips, secondary buttons |
| text | #0B0B0F | #F5F5F7 | body and numbers |
| textSecondary | #5C5C66 | #A1A1AB | subtitles, labels |
| ink / onInk | #0B0B0F / #FFF | #F5F5F7 / #0B0B0F | primary buttons, selected chips |
| accent | #6248F0 | #A796FF | links and the occasional highlight |
| positive | #13803F | #3DD68C | income only |
| negative | #D42B1E | #FF6B61 | overspending, card slips, debt problems |
| warning | #A85A00 | #F5B83D | unusual statement interest |
| heroFrom → heroTo | #E8E2FF → #FCE6F2 | #2A2148 → #3B1D35 | the hero card wash |

Red always means a money problem. Don't use it for decoration.

## Type

SF Pro (the iOS system font; on web it's requested by name with a system fallback). One family.

| Style | Size / weight | Use |
| --- | --- | --- |
| display | 44 / 700, tabular | the one big number per screen |
| largeTitle | 34 / 700 | sheet headline numbers |
| title | 22 / 600 | sheet titles |
| headline | 17 / 600 | buttons, emphasis |
| body | 17 / 400 | rows |
| callout | 15 / 400 | supporting lines, section labels (600) |
| footnote | 13 / 400 | row subtitles, hints |
| caption | 12 / 500 | tab labels |

All money uses `fontVariant: tabular-nums` through the `Money` component.

## Spacing and shape

- Spacing: 2 / 4 / 8 / 12 / 16 / 24 / 32 / 48. Screen gutter is 16. Rows sit closer together than groups, and groups sit closer than sections.
- Radius: 10 (small), 14 (inputs), 22 (sections, hero), full (buttons, chips). Corners use `borderCurve: 'continuous'`.
- Shadows: almost none. Only the selected segment and the floating web quick-add bar have one.
- Icons: SF Symbols on iOS, Material Symbols on Android and web, through `components/icon.tsx`.

## Rules for this app

- The gradient hero card appears at most once per screen, behind that screen's most important number. It's the only decorative surface. This is a deliberate exception to the product-designer "no gradients" rule because the inspiration images asked for it.
- Content is grouped in `Section` (one surface, hairline separators). Rows are never individual cards.
- Card slips are red everywhere they appear: quick-add, transaction rows, recurring rows, debt detail.
- Quick-add is reachable from every tab: the bottom accessory above the iOS tab bar, a floating bar on phone-width web, and a button in the desktop sidebar.
- Copy: no em dashes, no marketing words, no emoji. Button labels say what happens ("Add $10.99 from Eating Out", "Save with adjustment").
