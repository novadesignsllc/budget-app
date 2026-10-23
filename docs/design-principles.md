# Design principles and decision log

Every UI change gets checked against these principles. When we decide something new, it goes in the log at the bottom with the date, so we don't argue the same point twice.

## Core principles

1. **One system, every screen.** Cards, rows, buttons, dropdowns, and headers come from one component set with the same radius, border, padding, and type. No screen gets its own one-off style. If a screen needs something new, it becomes a shared component first.
2. **Every main screen opens the same way.** First the screen title, then a summary card (two numbers and a visual in the middle), then sections. You always know where you are and where to look.
3. **Pills are only for sorts and filters** (1M / 3M / YTD, All / Not cleared). Anything you choose (account, envelope, type, group, month, date) is a dropdown: a labeled field with a ⇅ chevron that opens a clean menu.
4. **Small, quiet text.** 14px body, 12px secondary, 11px uppercase column labels. Numbers are the only big type.
5. **Flat.** Cards have a hairline border, never a drop shadow. No liquid glass, blur, or frosted bars. Solid colors.
6. **Color carries meaning.** One blue accent for actions and selection. Group hues for envelopes. Red only for money problems (overspent, slips, debt warnings). Green only for money in and money synced.
7. **Rectangular buttons.** Radius 10, filled for the main action, outlined for the rest. Round icon buttons only for icon-only actions.
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
