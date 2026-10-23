# Zero Budget

A personal, debt-first, zero-based budgeting app. Expo SDK 58, Expo Router, iPhone first, with web for desktop. One owner, meant to be used for years.

## Always use

- **Expo skills** in `.claude/skills/expo-*` and `eas-*`. Start with `expo-overview` for any Expo task. Use `expo-native-ui`, `expo-ui`, and `expo-design-system` for UI work, and `expo-router` for navigation.
- **Product designer** (`.claude/agents/product-designer.md`) for any screen, component, style, or UI copy. `DESIGN.md` is the design system, and `src/theme/index.ts` holds the tokens.
- **Humanizer** (`.claude/skills/humanizer`) for UI copy, docs, commit messages, and PR descriptions.

## Product rules (don't break these)

1. Every transaction is entered by hand. No bank sync, ever.
2. Credit cards are debt. Spending on a card is allowed but recorded as a **slip**: it still comes out of an envelope, the same amount moves into that card's payment envelope, and it's marked red everywhere.
3. Envelopes always add up to real cash: `readyToAssign + sum(envelopes) === cash in checking/savings/cash`. This holds by construction in `src/domain/ledger.ts`. Never store a balance; always derive it.
4. Every debt gets a payment envelope automatically. Paying a debt is a transfer from cash out of that envelope.
5. Interest comes from statements: the user types the statement balance and the difference is posted as interest. No AI.
6. Recurring bills and subscriptions wait on Home for a one-tap approve. They never post silently.

## Code map

- `src/domain/`: pure TypeScript money logic with colocated tests (ledger, debt payoff, quick-add parser, recurring, dates). All money is integer cents. Dates are local `YYYY-MM-DD`.
- `src/store/`: the Zustand store, persisted to `localStorage` (the expo-sqlite polyfill on native). `sample-data.ts` is dev-only.
- `src/app/`: routes only. `(tabs)` holds Home, Transactions, Budget, Debt, and Recurring. Root-level routes are form sheets.
- `src/screens/`: screen bodies. `src/components/`: shared UI.
- `components/app-tabs.tsx` uses native tabs with the quick-add bottom accessory. `app-tabs.web.tsx` shows bottom tabs on narrow web and a sidebar on desktop.

## Commands

- `npm test`: domain tests
- `npx tsc --noEmit` and `npx eslint src`
- `npx expo start --web`: desktop and web preview
- `npx expo start`: Expo Go on the phone

## Not built yet

Firebase sync and auth (Apple and email), the EAS dev build and TestFlight, notifications (evening check-in, weekly reconcile, bill due), the iOS widget and Siri shortcut for quick-add, and the AI fallback for messy quick-add text.
