# Design system

This file is the source of truth for how the app looks. The tokens live in `src/theme/index.ts`. If the two disagree, fix whichever one is wrong. Don't add a second token file. Every screen also follows `.claude/agents/product-designer.md`.

## Brand

- Product: a personal budgeting app built around paying off debt. Every dollar of cash gets a job, credit cards only exist as debt, and every transaction is entered by hand.
- Audience: one person (the owner), every day, mostly on an iPhone.
- Tone: plain and direct, a little firm about debt.
- References: the two inspiration shots from planning. From the light one we took the soft wash behind the main number, the pill buttons, and the horizontal "due soon" cards. From the dark one we took accounts and debts drawn as cards you swipe through, big white figures, and colored tiles.
- Approved mockup: https://claude.ai/artifact/1rWx6w843w3AufYSNtpiW9

## Color

Light and dark come in pairs. The user picks System, Light, or Dark in Settings (`src/theme/preference.ts`).

| Token | Light | Dark | Used for |
| --- | --- | --- | --- |
| background | #F4F4F6 | #000000 | behind everything |
| surface | #FFFFFF | #141416 | grouped sections, sheets |
| fill | #EDEDF1 | #232327 | inputs, chips, progress tracks |
| text / textSecondary | #0B0B0F / #5C5C66 | #F5F5F7 / #A1A1AB | copy |
| placeholder | #A3A3AD | #5E5E68 | the cycling quick-add examples |
| ink / onInk | #0B0B0F / #FFF | #F5F5F7 / #0B0B0F | primary buttons, selected chips |
| accent (purple) | #6248F0 | #A796FF | links, Everyday, targets to fill |
| blue | #2F6BEA | #6EA8FF | Bills, Edit swipe action |
| positive | #13803F | #3DD68C | income, Savings, Fill swipe action, sync |
| negative | #D42B1E | #FF6B61 | overspending, card slips, debt problems |
| hero wash | #E6E0FF → #FCE6F0 | #2A2148 → #1D2A52 | behind the main number |

Group hues: Bills are blue, Everyday is purple, Savings is green, and Debt payments are slate. Any other group gets teal, pink, or amber. Red is never a group color; it only ever means a money problem.

Card faces (`cardFaces`) stay within one hue family each: indigo, blue, ink, lime, silver, violet. Accounts and debts keep the face for their position.

## Type

SF Pro (the iOS system font; on web it's requested by name). One family, smaller than iOS defaults so screens stay dense.

| Style | Size / weight | Use |
| --- | --- | --- |
| display | 36 / 700, tabular | the one big number per screen |
| largeTitle | 30 / 700 | stack titles |
| title | 20 / 600 | sheet titles, quick-add input |
| headline | 15 / 600 | section titles, buttons |
| body | 15 / 400–500 | rows |
| callout | 13 / 400 | supporting lines, chips |
| footnote | 12 / 400 | row subtitles, hints, labels |
| caption | 11 / 500 | small stats, tab labels |

## Spacing and shape

- Spacing: 2 / 4 / 8 / 12 / 16 / 24 / 32 / 48. Screen gutter is 20.
- Radius: 8, 12 (inputs), 16 (sections), 22 (card faces, hero), full (buttons, chips, pills). Corners use `borderCurve: 'continuous'`.
- Heights: buttons 32 / 40 / 48, inputs 44, chips 30, rows at least 56.
- Shadows: one token, `float`, used only for things that hover over content (the web quick-add bar, the sync pill). Everything else is flat.

## Rules for this app

- Rows live in a `Section`: one flat surface, hairline separators that start at the text (`ICON_INSET`). Never one card per row, never a shadow on a row.
- Swipe actions are flat, square, full height, and clipped by the section's corners, like Mail. Swipe right fills, swipe left edits.
- Each row starts with a rounded-square icon tile in its group's hue. Envelope icons come from the name (`utils/envelope-icon.ts`).
- Progress bars are 4px, in the group's hue, and red when overspent.
- The gradient wash appears at most once per screen. Card faces are the other decorative element, and they only appear for accounts and debts.
- A screen's add action floats bottom right above the quick-add bar (`FloatingAction`). The sync pill sits on the same row at the left.
- Card slips are red everywhere: quick-add, rows, recurring, debt cards.
- Copy: no em dashes, no marketing words, no emoji. Button labels say what happens.
