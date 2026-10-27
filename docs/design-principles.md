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
| 2026-10-23 | ~~Menus and the calendar open only after the keyboard has finished closing~~ (replaced 2026-10-24) | They measured mid-slide and opened in the wrong place |
| 2026-10-23 | Every sheet opens at full height and never changes height | A shorter detent made the sheet drop whenever the keyboard closed |
| 2026-10-24 | Money is typed from the right like YNAB: 4 → $0.04, 4 3 5 7 → $43.57. Budget amounts (assigned, targets) stay whole dollars | User request |
| 2026-10-24 | The keyboard stays up in sheets: menus, the calendar, toggles and flags open over it and the cursor stays put; Save closes everything | Closing the keyboard first made menus lag and jump |
| 2026-10-24 | Assigning: only ✓ Done on the keyboard bar saves; Cancel or tapping away puts it back. The bar is just Cancel and Done, no status line | User wants to confirm the number |
| 2026-10-24 | Dictation is voice only: it shows what it understood as you talk ($10.27, not "1027") and has nothing to tap. It hears inflow/outflow, the account, "<name> envelope", "<color> flag", and "note …" | Dictating and tapping mixed together was confusing |
| 2026-10-24 | No "~" on bill amounts | Bills are exact; wrong ones get fixed when approving |
| 2026-10-24 | Home shows Recent (last 7 days of transactions) under Accounts | User request |
| 2026-10-24 | Reconciled transactions are grey everywhere; no lock icon. Saving one asks "Are you sure?" | The lock was too small to see |
| 2026-10-24 | Debt page = the account register with the payoff card and details on top: Monthly target (Minimum or Custom), one Activity list with slips in red, Make a payment and Reconcile bottom right. No Enter statement, no payment envelope row | Neater, and debts reconcile the same way accounts do |
| 2026-10-24 | Debt payment envelopes can't be edited; their name is the debt's and their target comes from the debt page | User request |
| 2026-10-24 | Recurring sheet: Save · Pause · Delete in one row | User request |
| 2026-10-24 | Sheet menus draw in a layer inside the sheet, not a Modal | A Modal took the keyboard away on iPhone |
| 2026-10-24 | Transaction rows: Envelope, Date, Account, Flag, Note, then Outflow/Inflow. Typed entries always start as Outflow | User request |
| 2026-10-24 | Reconciled rows get a grey background as well as grey text | Easier to tell apart |
| 2026-10-24 | Envelope names always end in "…" before reaching the Assigned column, with a gap before the chip | Long names ran into the numbers |
| 2026-10-24 | Dictation hears an envelope by its name alone ("Chipotle 14.50 eating out") | Requiring the word "envelope" missed it |
| 2026-10-24 | Bank accounts have Error adjustment: type the correct balance and the difference posts with no envelope | Fix a wrong balance without reconciling |
| 2026-10-24 | Menus and the calendar size themselves from the keyboard's height and the sheet's height, not window positions | Inside a sheet, window positions were off and menus ran under the keyboard |
| 2026-10-24 | Compact calendar: 30pt days, Today and Yesterday in the month row | So it fits above the keyboard |
| 2026-10-25 | Light mode only at the native level too (userInterfaceStyle light), splash in the app background color | iOS dark mode was tinting the keyboard and alerts |
| 2026-10-25 | The app is called Slip. Icon: a folded paper strip forming an S, purple on deep indigo, flat (no glass) | The point of the app is no slips; user picked option C |
| 2026-10-25 | Each Daily or Savings envelope has a target type: Spending (a monthly limit that refills up to the target, leftovers count) or Goal (the full amount every month, building over time). Defaults: Daily is spending, Savings is a goal | User request |
| 2026-10-25 | Starter envelope suggestions stay until you tap Done or add them all | They vanished after the first one |
| 2026-10-25 | Accounts can be renamed from the account page (Rename, next to Move up and Move down) | User request |
| 2026-10-25 | Envelopes with a target show funding on their bar: yellow while short (filled as far as the money goes), green once funded (shrinks as you spend), grey track when spent to zero, red when over. No target keeps the plain group-color bar | User request |
| 2026-10-25 | (Replaces the funding bar.) A target shows as the row's tint: yellow short, green funded, grey spent down, red over. The bar is the same for every envelope: money left this month, shrinking as you spend, red when a spending envelope hits zero or any envelope goes over (paid bills stay grey) | User wants targets visible at a glance and one meaning for the bar |
| 2026-10-25 | Auto-assign and Sort sit side by side under the left-to-assign card; Unassign all stays at the bottom | Easier to reach |
| 2026-10-25 | The Cancel / Done bar for assigning is drawn by the app on top of the keyboard (iPhone and Android), not iOS's accessory view | The accessory view sometimes didn't appear |
| 2026-10-26 | (Replaces row tints.) Rows stay white. An envelope with a target shows its Left amount in a pill: green funded, yellow short, grey at $0, red over. No target means a plain number. The bar is money left of this month's money, in the group color, red only when overspent | Tinted rows looked strange |
| 2026-10-26 | Budget columns are a fixed 72pt with even 6pt gaps; the Assigned chip and the Left pill are the same box in every row | Sections looked different from each other |
| 2026-10-26 | Every number is typed on Slip's own number pad (light, purple + − = and Done, ✕ clears, ⌫ deletes) with quick math. Money fills from the right; budget amounts are whole dollars. On the budget the pad offers Fill target and Details. The phone keyboard only appears for words | The system keyboard's Done bar was unreliable; same pad on iPhone and Android |
| 2026-10-26 | Progress bars color by money left: green over half, yellow half or less, grey at $0, red overspent. Never purple (purple means tappable). Pills keep their own target colors. Columns 64pt with 4pt gaps | User request; names were getting cut off at 72pt |
| 2026-10-26 | Tap the Left amount to move money back to Ready to assign: the pad opens on everything left (whole dollars), Done moves it or type less, "Move all" shortcut, toast with Undo. Not in past months | Envelopes build up month to month |
| 2026-10-26 | (Replaces typing in Left.) Tapping Left opens a menu: "Move all back" or "Move a custom amount". Custom opens the number pad, which shows the amount on itself; the Left column is never typed in | User: Left isn't an input |
| 2026-10-26 | Budget columns are three identical 64pt boxes with 6pt gaps (Assigned chip, Spent, Left pill), digits 6pt inside each box, headers right-aligned to the digits | The mix of boxes and loose text looked uneven |
| 2026-10-26 | The Left menu opens with how Left adds up, in exact cents: from earlier months (every past month rolls over), assigned this month, spent this month, other money in, Left | Make rollover visible so the math can be checked |
| 2026-10-26 | The website is the same app, built from the same code and hosted on EAS Hosting at slip-budget.expo.app; one script ships to both phones and the web | Changes and data stay identical everywhere |
| 2026-10-26 | On desktop, sheets open as centered cards (560 wide) over the dimmed page; click outside or Escape closes. The main screen's number pad floats as a 400-wide card; inside a sheet it docks to the card's bottom | Full-width sheets and a window-wide pad looked broken on a computer |
| 2026-10-26 | (Replaces the expo.app website.) The desktop version is the same app with its own screens in src/desktop: a sidebar with shortcuts, Budget as one table with a Target column and a details panel, Transactions as a spreadsheet with a typing row on top, Home as a grid. Hosted on Vercel from GitHub (slip-budget.vercel.app); slip-budget.expo.app forwards there | User approved the desktop mockup and asked for GitHub + Vercel on the same code and data |
| 2026-10-26 | Every desktop page uses the same frame: a header bar (back link, title, actions right), a table card on the left and a details column on the right. Debts and accounts share one register with reconcile checkboxes in the table; Recurring is a table with monthly totals; Settings lists keyboard shortcuts | Finish the desktop restyle in the approved style |
| 2026-10-27 | The Slip number pad is for phones only. On desktop every number is typed into a normal field (math still works: 560+40); Enter or Tab saves, Esc cancels. "Move a custom amount" opens a field in the Budget details panel. Desktop amounts read typed decimals ("43" is $43.00), not digits filling from the right | User: no custom keyboard on desktop |
| 2026-10-27 | (Amends the row above.) Desktop money with cents (New transaction, bills, transfers, balances, the Transactions entry row) fills in from the right like the phone and YNAB: 4357 is $43.57, math included. Whole-dollar budget amounts, rates and days are typed as they read | User: transaction and bill amounts should still do the decimal point thing |
| 2026-10-27 | (Replaces the progress bars.) No progress bars anywhere on envelopes, phone or desktop. The Left pill alone carries the status: with a target it follows the target (yellow short, green funded, grey spent to zero, red over); without one it's green with money to spend, red when overspent, grey at $0. Yellow always means a target needs money | User: bars are confusing; one color system |
| 2026-10-27 | Rename became Edit account: name, type (within bank accounts or within debts), starting balance and its as-of date (never after the account's first transaction), and a debt's rate, minimum and due day. The form says how the change moves Ready to assign or what's owed, and warns when a reconciled balance moves | User: edit the starting balance and info |
| 2026-10-27 | Spending and savings are budgeted separately once there's a savings account. Checking and cash fund Daily, Bills, Subscriptions and Debt payments; savings accounts fund the Savings envelopes. Ready to assign shows both (phone card halves, desktop pills, Home); transfers move money between them; a side that holds less than its envelopes turns red with "Move $X from checking/savings" (rounded up to whole dollars) and "Fix in envelopes". No savings account: one number, as before | User: the account matters; never overspend checking. Recommendation accepted for people without a savings account |
| 2026-10-27 | A bill's or subscription's emoji can be changed from its edit sheet (Recurring) as well as from its envelope (Budget). It's stored once, on the envelope, so both always match | User: edit the emoji from either place, kept in sync |
| 2026-10-27 | Budget goes up to 12 months ahead (MONTHS_AHEAD). Money assigned to a later month is dated that month and comes out of today's Ready to assign right away, so it can't be spent twice; that month shows it on top of what carries over. A future month has a "Planning ahead" banner (phone) or tag (desktop) and a Back to this month button. The month menu lists This month, then the months ahead with their year, then the past | User: assign months ahead |
| 2026-10-27 | Assigned, Spent and Left are centered in their columns, headers included, on phone and desktop | User request |
| 2026-10-27 | Credit cards can have a credit limit (optional field, set in New debt or Edit account). A "79% used" pill shows on the card's page (with what's left of the limit), the phone Debt list and a Limit used column on desktop: green under 30%, yellow from 30%, red from 90% or over | User: see how close cards are to their limits |
| 2026-10-27 | Home's Where you stand chart shows a year back (solid) and a year ahead (dashed, lightly shaded, "Projected" at today). Debt follows the payoff plan; cash moves by the average of the last 3 full months' cash flow (debt payments and balance fixes left out), less the plan's payments, which stay in cash once debts are gone. A note under the chart says what it assumed and when cash would run out. Colors re-validated with the dataviz checker | User: debt vs liquid wealth, actual solid, projected dashed |
| 2026-10-27 | Desktop Budget table drops the Target column (the details panel still shows the target) | User: not necessary |
| 2026-10-27 | Any envelope with its own target can be snoozed for one month (envelope screen; desktop details panel): that month it counts as no target (pill green/red/grey, Auto-assign skips it), a snooze icon shows by its name, and it returns the next month. The target itself is kept (editing reads targetSetFor). Debt payments can't be snoozed | User: snooze a target one month at a time |
| 2026-10-27 | Profiles: up to 3 completely separate budgets per account (accounts, envelopes, debts, recurring, settings). The first profile is the data that was always at users/{uid}/… (no migration); others live at users/{uid}/profiles/{id}/…; names, icons and colors are users/{uid}/profiles/{id}. Switch with Sheets-style tabs under the phone tab bar and along the bottom of the desktop window; add and edit them in Settings. Each profile has its own accent color (Purple, Blue, Teal, Magenta, Graphite: all pass 4.5:1 with white text and avoid the status colors). Reset clears only the open profile; Delete account erases every profile | User request |
