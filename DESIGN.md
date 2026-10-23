# Design system

This file is the source of truth for how the app looks. The tokens live in `src/theme/index.ts`. If the two disagree, fix whichever one is wrong. Don't add a second token file. Every screen also follows `.claude/agents/product-designer.md` and the principles in `docs/design-principles.md`.

## Brand

- Product: a personal budgeting app built around paying off debt. Every dollar of cash gets a job, credit cards only exist as debt, and every transaction is entered by hand.
- Audience: one person (the owner), every day, mostly on an iPhone, often one-handed.
- Tone: plain and direct, a little firm about debt.
- References: Copilot (dense tables, the bottom text tab strip, quiet cards) and Tripsy (grouped rows, clean sheets).
- Approved mockup (v2, light): https://claude.ai/artifact/P2wZyZDtBkgBFBV1LarLyU

## Color

Light only for now. `useColors()` stays a hook so dark can come back later.

| Token | Value | Used for |
| --- | --- | --- |
| background | #F3F5F9 | behind everything, sheets |
| surface | #FFFFFF | cards |
| tableHeader | #FAFBFD | column label strip inside a card |
| control | #F1F4F9 | inputs, dropdown fields, pressed rows |
| border / borderStrong | rgba(20,40,80,.09) / .12 | card outline / control outline |
| separator / hairline | rgba(20,40,80,.08) / .06 | under a card header / between rows |
| text / textSecondary / textTertiary | #0B1220 / #5D6B82 / #8B97AA | copy |
| ink / onInk | #0B1220 / #FFF | primary and add buttons |
| accent | #2F6FEB | links, selection, Reconcile |
| orange | #C2560F | due, flags, needs attention |
| positive | #13803F | inflow, saved, synced |
| negative / negativeStrong | #B42318 / #D92D20 | slips, overspent, urgent |
| negativeTint | #FFF6F5 | slip row background |

Group hues: Bills #2a78d6, Everyday #5B4CF0, Savings #1baf7a, Debt payments #8B97AA. Other groups get teal, pink, or amber. Red is never a group color.

Chart series (`chartColors`) go in fixed order and are never cycled: #2a78d6, #eb6834, #1baf7a, #eda100, then more. A debt keeps its color by its place in the accounts list, not by payoff rank. Slots 3 and 4 are low contrast, so every chart has direct labels and a legend.

Card faces (`cardFaces`) show only as mini cards next to accounts and debts.

## Type

SF Pro. Small and dense; numbers are the only big type.

| Style | Size / weight | Use |
| --- | --- | --- |
| number | 22 / 600, tabular | the one big number on a card |
| title | 17 / 700 | centered screen title |
| section | 14 / 600 | card headings |
| body | 13 / 400 | rows, fields |
| row | 12 / 400 | dense table cells |
| footnote | 11 / 400 | row details, hints |
| caption | 10 / 400 | chart ticks, tiny stats |
| label | 10 / 600 caps, +0.7 | column labels |

## Spacing and shape

- Spacing: 2 / 4 / 8 / 12 / 16 / 24 / 32 / 48. Screen gutter is 16.
- Radius: buttons 8, controls 10, menus 14, cards 16.
- Heights: buttons 28 / 34 / 44, fields 40.
- No shadows, no blur, no glass.

## Components

Screens build only from these (`src/components/`):

- `Card`, `CardHeader`, `CardFooterLink`, `TableHeader`, `IconTile` (card.tsx)
- `TransactionRow` with `TXN_COLUMNS` (one dense line; slips red; checkbox in reconcile mode)
- `Dropdown` (field, row, compact, inline, title variants) for every selector
- `FilterPills` for sorts and filters only
- `Button` (primary, ink, secondary, destructive, ghost, tinted), `Field`, `FieldLabel`, `Text`, `Money`
- `ScreenTitle` (centered title plus context line), `Screen`, `SheetScreen`
- `ScreenActions` and `ActionButton` (bottom right, above quick-add)
- `LineChart`, `ChartLegend`, `ProgressRing`, `MiniCard`
- The dock (quick-add bar plus scrolling tab strip with the Settings gear pinned right) and the sync pill are global.

## Rules for this app

- Every main screen: centered title with one line of context, then bordered cards. Titles carry no buttons.
- Search, add, and selectors live in `ScreenActions` at the bottom right. The sync pill sits at the bottom left.
- Charts: Home cash vs debt, Budget ring, Debt payoff lines. Nothing on Transactions or Recurring.
- Swipe actions are flat, square, full height, like Mail. Swipe right fills, swipe left edits.
- Progress bars are 3px in the group's hue, red when overspent.
- Card slips are red everywhere: quick-add, rows, recurring, debt.
- Copy: no em dashes, no marketing words, no emoji. Button labels say what happens.
