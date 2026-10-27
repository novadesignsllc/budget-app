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
- `src/store/`: the Zustand store. It isn't persisted itself; Firestore's on-device cache is the persistence. `sample-data.ts` is dev-only.
- `src/backend/`: Firebase behind one interface. `index.ts` is React Native Firebase (iPhone), `index.web.ts` is the JS SDK with the IndexedDB cache (desktop), and `fake.ts` is an in-memory stand-in for tests and `EXPO_PUBLIC_FAKE_BACKEND=1`.
- `src/sync/`: `engine.ts` diffs the store against Firestore and writes only what changed, applies snapshots from other devices, and holds writes back until everything has loaded once. `status.ts` drives the bottom-left sync pill. `session.ts` follows auth.
- `src/app/`: routes only. `(tabs)` holds Home, Transactions, Budget, Debt, Recurring, and Settings. Root-level routes are form sheets.
- `src/screens/`: screen bodies. `src/components/`: shared UI.
- `components/app-tabs.tsx` is one headless tab layout for every platform: on phones a bottom dock (quick-add bar plus a scrolling text tab strip with the Settings gear pinned right), and on desktop web (900px and wider) the sidebar in `desktop/sidebar.tsx`.
- `src/desktop/` holds the desktop screens (Home, Transactions, Budget), chosen in each tab's `index.tsx` with `useIsDesktop()`. They reuse the domain, store, hooks and shared pieces (LeftCell, LeftMath, InlineAmount, the number pad); only layout lives there. Approved mockup: https://claude.ai/artifact/C4As4Qujw8RrGKWLkTHUp4. Shortcuts: N new transaction, 1–5 sections, / search, arrows in Budget.
- Screen actions (search, add, month, strategy) sit bottom right in `ScreenActions` on the phone screens.

## Sync rules

- Data lives at `users/{uid}/{accounts|envelopes|transactions|allocations|recurring|payees}/{id}`, plus `users/{uid}/meta/state` (settings, plus the legacy merchant memory that migrates into payees). `firestore.rules` allows only the owner.
- Offline writes land in Firestore's local cache right away and upload on reconnect. On iPhone the queue is on disk, so it survives the app closing.
- Never write to Firestore directly from a screen. Change the store; the engine syncs it.
- Firestore bills a full re-read when a listener has been gone for more than 30 minutes. When the transaction count gets into the thousands, listen to recent months only and load older ones on demand.

## Commands

- `npm test`: domain tests
- `npx tsc --noEmit` and `npx eslint src`
- `npx expo start --web`: desktop and web preview against the real Firebase
- `EXPO_PUBLIC_FAKE_BACKEND=1 npx expo start --web`: same, with the fake backend (any email and password signs in; `window.__fakeBackend.setOnline(false)` simulates no signal)
- `npx expo start`: the iPhone dev build connects to this. Expo Go doesn't work: native Firebase needs a dev build.
- `./scripts/ship.sh "What changed"`: the normal way to ship, after committing. Runs the checks, sends an over-the-air update to both phones, and pushes to GitHub; Vercel rebuilds the website (https://slip-budget.vercel.app, project `slip`) from every push to main. It stops if the native fingerprint no longer matches the installed builds. `./scripts/ship.sh --web` only pushes.
- Don't edit package.json `scripts` or `.gitignore`: both count toward the native fingerprint, so changing them breaks updates to the installed apps. Local-only ignores go in `.git/info/exclude`.
- `eas build -p ios --profile production --auto-submit`: build and send to TestFlight
- `eas build -p ios --profile development`: dev build for live reloading. Register the phone first with `eas device:create`.

## Not built yet

Notifications (evening check-in, weekly reconcile, bill due), the iOS widget and Siri shortcut for quick-add, the AI fallback for messy quick-add text, and Apple and email account linking.
