# Design principles and decision log

Every UI change gets checked against these principles. When we decide something new, it goes in the log at the bottom with the date, so we don't argue the same point twice.

## Core principles

1. **One system, every screen.** Cards, rows, buttons, dropdowns, and headers come from one component set with the same radius, border, padding, and type. No screen gets its own one-off style. If a screen needs something new, it becomes a shared component first.
2. **Every main screen opens the same way.** A centered title with one line of context above it, then content in the same bordered cards. A summary chart appears only where it means something (see 5b).
3. **Pills are only for sorts and filters** (1M / 3M / YTD, All / Not cleared). Anything you choose (account, envelope, type, group, month, date) is a dropdown: a labeled field with a ⇅ chevron that opens a clean menu.
4. **Small, quiet text, dense screens.** 13px body, 11px secondary, 10px uppercase column labels, SF Pro. Numbers are the only big type.
5. **Flat.** Cards have a hairline border, never a drop shadow. No liquid glass, blur, or frosted bars. Solid colors.
5a. **One-handed.** Search, add, and selectors (month, strategy) sit in the bottom right, just above quick-add. Screen titles are centered; a pushed screen gets a plain "‹ Back" link on the left and nothing else.
5b. **A chart only where it says something.** Home: cash vs debt over time. Budget: spent-of-assigned ring. Debt: each debt's projected balance to its payoff date. Transactions and Recurring have no summary.
6. **Color carries meaning.** One blue accent for actions and selection. Group hues for envelopes. Red only for money problems (overspent, slips, debt warnings). Green only for money in and money synced.
7. **Rectangular buttons.** Radius 8, filled for the main action, outlined for the rest. Round icon buttons only for icon-only actions.
8. **Follow `.claude/agents/product-designer.md`.** No em dashes, no marketing words, no emoji in the interface, real states for empty and loading.
9. **Approved images first.** UI gets mocked up and approved before it's built.

## Decision log

| Date | Decision | Why |
| --- | --- | --- |
| 2026-10-22 | Light and dark mode, SF Pro to start | First brief |
| 2026-10-23 | Swipe actions are flat and square like Mail, no rounded card or shadow behind them | Rounded and shadowed swipes looked AI-generated |
| 2026-10-23 | Settings has System / Light / Dark | User request |
| 2026-10-23 | Pills only for sorts and filters; selectors are custom dropdowns | User rule |
| 2026-10-23 | Redesign from Copilot and Tripsy references: navy dark theme, bordered flat cards, same summary card on every tab | v1 felt like each page was its own app |
| 2026-10-23 | No liquid glass. The iOS tab bar is replaced by a Copilot-style scrolling text tab strip at the bottom | User finds glass gimmicky |
| 2026-10-23 | Smaller type across the app; free to experiment with fonts and colors | User request |
| 2026-10-23 | A demo account full of realistic data, for trying features and verifying them | User request |
| 2026-10-23 | Light mode only for now; SF Pro instead of Figtree | User prefers it |
| 2026-10-23 | Settings becomes a tab, pinned at the far right of the tab strip | User request |
| 2026-10-23 | Centered titles; actions move to the bottom right above quick-add | One-handed use |
| 2026-10-23 | Charts per tab: Home cash vs debt, Debt payoff projection per debt; no summary on Transactions or Recurring | Same ring on every tab didn't mean anything |
| 2026-10-23 | Transactions show date, payee, envelope, note, outflow/inflow and flags on one dense row | See everything without opening it |
| 2026-10-23 | Reconcile inside an account: select posted transactions, tap Reconcile, they lock; editing a locked one warns first; flagged ones can't be reconciled | User workflow |
| 2026-10-23 | Urgent alert when cash is less than what's assigned; slips alone never trigger it | Budget must stay real |
| 2026-10-23 | Can't move past the current month; targets are per month and never change earlier months | User rule |
| 2026-10-23 | Payee list in Settings with default envelopes, replacing learned merchant memory | User request |
| 2026-10-23 | Classic bottom tab bar with icons and labels, Settings included; quick-add sits above it | The scrolling strip cut off tabs; user prefers the classic bar |
| 2026-10-23 | Purple accent (#5B4CF0) instead of blue | User request: less blue |
| 2026-10-23 | Own flat header with a text back link | iOS 26 wraps native back buttons in liquid glass |
| 2026-10-23 | Budget in whole dollars: to assign and left round down, spent rounds up | Rounding down keeps a little money aside, and the screen drops the .00s |
| 2026-10-23 | Budget columns Assigned · Spent · Left, equal width; names truncate first | Columns must always line up |
| 2026-10-23 | Tap Assigned to edit in place; no Assign / Take back form | Too many taps |
| 2026-10-23 | Custom calendar for every date instead of the iOS date pill | The native pill looked out of place |
| 2026-10-23 | Month controls at the bottom of Budget: Auto-assign, Sort envelopes, Unassign all (tap twice, with Undo) | User request |
| 2026-10-23 | Sort mode: press and hold to drag groups or envelopes (across groups too); Cancel and Confirm bottom right; the order applies to every month | User request; Confirm on the right per user |
| 2026-10-23 | Past months are drawn in greys with a banner and a way back to this month | Make it obvious you're not in the current month |
| 2026-10-23 | Five tabs: Recurring, Transactions, Home (middle), Budget, Debt; Settings is a row at the bottom of Home | User request |
| 2026-10-23 | Every envelope has an emoji (custom picker, ~1,300 emojis); transaction rows show it in its own column | Clearer than envelope names; user prefers emojis to icons |
| 2026-10-23 | Transaction rows: fixed height, payee centered, note only when there is one; outflow red with a minus, inflow green with a plus | User request |
| 2026-10-23 | Transactions filters move to the bottom bar next to the month and search | One-handed use |
| 2026-10-23 | Budget top card is one message: green "left to assign", red "assigned more than you have", grey check "All money assigned" | Every dollar needs a job; targets don't matter there |
| 2026-10-23 | Groups are fixed: Daily, Savings, Bills, Debt payments. Recurring items get their own Bills envelope | Simpler; bills never go over |
| 2026-10-23 | Type one point larger across the app | User request |
| 2026-10-23 | Titles stand alone: no context line above them. Budget reads "Budget · October 2026"; Home's title is today's date | Clean; the month and day are the useful part |
| 2026-10-23 | No helper tips on screens; empty states and real warnings (a slip, money short) stay | User wants it really clean |
| 2026-10-23 | Bills, Subscriptions and Debt payments are app-managed groups: one envelope per bill, subscription or debt; reorder inside, never move out; deleting the item hides its envelope | Keeps bills and their money in sync |
| 2026-10-23 | Plus buttons are black and icon-only, bottom right; quick-add has no plus | One add pattern everywhere |
| 2026-10-23 | Motion is a fade: quick-add examples and tab switches cross-fade, nothing slides or bounces | The lift read as a bounce |
| 2026-10-23 | Transactions table runs a size smaller (12pt cells, 46pt rows) | Money columns felt cramped |
| 2026-10-23 | Tab bar items don't scale on press; sheets and menus keep their pop-in | The press scale read as a bounce |
| 2026-10-23 | Dropdown options are labels only, no description lines; no notes beside field labels | Menus felt cluttered with tooltip text |
| 2026-10-23 | Home has one Upcoming card: items waiting for approval plus the next 7 days of bills and subscriptions | Replaces the separate To approve card |
| 2026-10-23 | Every sheet uses one layout: big amount on top, one card of label/value rows (46pt), Save, then secondary actions in one card | Menus each looked different |
| 2026-10-23 | Flags pick a color (none plus red, orange, yellow, green, blue, purple) from a custom row, not a switch | User asked for a custom flag color selector |
| 2026-10-23 | New transaction is two fields (Name, Amount on the right) plus an Outflow/Inflow toggle; no mic in the sheet, voice starts from the quick-add bar | Typing one line and re-showing the name was redundant |
| 2026-10-23 | Dictated bare numbers of 3+ digits are dollars and cents ("two twenty-seven" → $2.27); "$", "dollars", a decimal, or a comma keeps whole dollars | Speech turns "two twenty-seven" into "227" |
| 2026-10-23 | Menus and the calendar open only after the keyboard has finished closing | They measured mid-slide and opened in the wrong place |
| 2026-10-23 | Every sheet opens at full height and never changes height | A shorter detent made the sheet drop whenever the keyboard closed |
