import { create } from 'zustand';

import { today } from '@/domain/dates';
import type { Strategy } from '@/domain/debt';
import type { MonthKey } from '@/domain/months';
import { findPayee } from '@/domain/payees';
import { canReconcile, isLocked } from '@/domain/reconcile';
import { withTarget } from '@/domain/targets';
import { normalizePayee } from '@/domain/quick-add';
import { ceilDollars } from '@/domain/money';
import { advance, monthlyCost } from '@/domain/recurring';
import type {
  Account,
  AccountKind,
  Allocation,
  Cents,
  Envelope,
  ISODate,
  Payee,
  Recurring,
  Transaction,
  TransactionKind,
} from '@/domain/types';
import { GROUPS, isCashAccount } from '@/domain/types';

export const DEBT_GROUP = 'Debt payments';

/** "Everyday" was Daily's old name; any group that isn't one of the fixed ones becomes Daily. */
export function fixGroup(group: string): string {
  if (group === DEBT_GROUP || (GROUPS as readonly string[]).includes(group)) return group;
  return 'Daily';
}

/** What a recurring item costs a month, rounded up to whole dollars, as its envelope's target. */
function monthlyBudget(r: Pick<Recurring, 'amount' | 'frequency'>): Cents {
  return ceilDollars(monthlyCost(r));
}

export type Settings = {
  debtStrategy: Strategy;
  /** Total the user plans to put toward debt each month, minimums included. */
  monthlyDebtPayment: Cents;
  /** Budget groups top to bottom, as sorted by the user. Groups not listed follow. */
  groupOrder?: string[];
};

export type NewTransaction = {
  date: ISODate;
  accountId: string;
  /** Positive cents. Direction comes from `kind`. */
  amount: Cents;
  kind: Extract<TransactionKind, 'spend' | 'income' | 'slip'>;
  payee: string;
  envelopeId?: string;
  memo?: string;
  recurringId?: string;
};

/** Everything that syncs to Firebase. */
export type State = {
  accounts: Account[];
  envelopes: Envelope[];
  transactions: Transaction[];
  allocations: Allocation[];
  recurring: Recurring[];
  /** Merchants with their default envelopes. Replaces `merchantMemory`. */
  payees: Payee[];
  /** Legacy payee memory, read only for migrating into `payees`. */
  merchantMemory: Record<string, string>;
  settings: Settings;
};

export { isLocked };

type Actions = {
  addAccount: (input: {
    name: string;
    kind: AccountKind;
    balance: Cents;
    apr?: number;
    minPayment?: Cents;
    dueDay?: number;
  }) => string;
  updateAccount: (
    id: string,
    patch: Partial<Pick<Account, 'name' | 'apr' | 'minPayment' | 'dueDay' | 'closed'>>,
  ) => void;
  moveAccount: (id: string, direction: -1 | 1) => void;

  /** `month` is when the target starts; it defaults to the current month. */
  addEnvelope: (input: { name: string; group: string; monthlyTarget?: Cents; month?: MonthKey }) => string;
  /** Sets the target from `month` on. Earlier months keep the target they had. */
  setTarget: (envelopeId: string, month: MonthKey, amount: Cents | null) => void;
  updateEnvelope: (
    id: string,
    patch: Partial<Pick<Envelope, 'name' | 'group' | 'monthlyTarget' | 'hidden' | 'recurringId'>>,
  ) => void;
  /**
   * Saves a new order from sort mode: groups top to bottom, each with its envelopes in
   * order. An envelope listed under a different group moves to it. Applies to every month.
   */
  reorderEnvelopes: (groups: { name: string; ids: string[] }[]) => void;
  /** `date` defaults to today; pass a month's date to assign in a past or future month. */
  assign: (envelopeId: string, amount: Cents, date?: ISODate) => void;
  moveMoney: (fromEnvelopeId: string, toEnvelopeId: string, amount: Cents, date?: ISODate) => void;
  /** Several assignments at once (filling targets). Returns their ids so they can be undone. */
  assignMany: (entries: { envelopeId: string; amount: Cents; date: ISODate }[]) => string[];
  removeAllocations: (ids: string[]) => void;

  addTransaction: (t: NewTransaction) => string;
  updateTransaction: (
    id: string,
    patch: Partial<Pick<Transaction, 'date' | 'payee' | 'envelopeId' | 'memo' | 'cleared'>> & {
      amount?: Cents;
      /** Spending only. Moving to a card makes it a slip, moving to cash makes it spending. */
      accountId?: string;
    },
  ) => void;
  deleteTransaction: (id: string) => void;
  setFlag: (id: string, flagged: boolean) => void;
  /**
   * Marks these transactions reconciled (and cleared), which locks them. Flagged ones are
   * skipped and returned, since a flagged transaction can't be reconciled.
   */
  reconcileTransactions: (accountId: string, ids: string[]) => string[];
  /** Posts a leftover difference found while reconciling, already reconciled. */
  addAdjustment: (accountId: string, amount: Cents) => void;
  transfer: (input: {
    fromAccountId: string;
    toAccountId: string;
    amount: Cents;
    date: ISODate;
    envelopeId?: string;
    payee?: string;
  }) => void;

  /** Marks everything except `pendingIds` cleared and posts any difference as an adjustment. */
  reconcile: (accountId: string, bankBalance: Cents, pendingIds: string[]) => void;
  recordStatement: (debtAccountId: string, statementOwed: Cents, trackedOwed: Cents) => void;

  addRecurring: (r: Omit<Recurring, 'id' | 'active'>) => string;
  updateRecurring: (id: string, patch: Partial<Omit<Recurring, 'id'>>) => void;
  deleteRecurring: (id: string) => void;
  approveRecurring: (id: string, amount?: Cents) => void;
  skipRecurring: (id: string) => void;

  addPayee: (name: string, envelopeId?: string) => string;
  renamePayee: (id: string, name: string) => void;
  deletePayee: (id: string) => void;
  setPayeeEnvelope: (id: string, envelopeId: string | undefined) => void;
  /** One-time move of the old merchant memory into `payees`. Does nothing once payees exist. */
  migrateMerchantMemory: () => void;
  /**
   * Puts every envelope in one of the fixed groups: "Everyday" (the old name) and any
   * custom group become Daily. Debt payment envelopes are left alone. Does nothing when
   * everything is already valid.
   */
  normalizeGroups: () => void;

  updateSettings: (patch: Partial<Settings>) => void;
  replaceAll: (state: State) => void;
};

export type Store = State & Actions;

export const defaultSettings: Settings = { debtStrategy: 'snowball', monthlyDebtPayment: 0 };

export const initialState: State = {
  accounts: [],
  envelopes: [],
  transactions: [],
  allocations: [],
  recurring: [],
  payees: [],
  merchantMemory: {},
  settings: defaultSettings,
};

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Adds the payee if it's new and remembers its envelope. */
function learnPayee(payees: Payee[], name: string, envelopeId?: string): Payee[] {
  const clean = name.trim();
  if (!clean || !normalizePayee(clean)) return payees;
  const existing = findPayee(payees, clean);
  if (!existing) return [...payees, { id: newId(), name: clean, envelopeId }];
  if (!envelopeId || existing.envelopeId === envelopeId) return payees;
  return payees.map((p) => (p.id === existing.id ? { ...p, envelopeId } : p));
}

function signed(kind: NewTransaction['kind'], amount: Cents): Cents {
  return kind === 'income' ? Math.abs(amount) : -Math.abs(amount);
}

/**
 * App data. Firebase is the source of truth and its on-device cache is the persistence;
 * `src/sync/engine.ts` keeps this store and Firestore in step.
 */
export const useStore = create<Store>()((set, get) => ({
  ...initialState,

  addAccount: ({ name, kind, balance, apr, minPayment, dueDay }) => {
    const id = newId();
    const isCash = isCashAccount({ kind });
    const account: Account = {
      id,
      name: name.trim(),
      kind,
      // Debts are entered as "amount owed" and stored negative.
      openingBalance: isCash ? balance : -Math.abs(balance),
      openedOn: today(),
      order: get().accounts.length,
      ...(isCash ? { lastReconciledOn: today() } : { apr, minPayment, dueDay }),
    };
    set((s) => {
      const envelopes = isCash
        ? s.envelopes
        : [
            ...s.envelopes,
            {
              id: newId(),
              name: account.name,
              group: DEBT_GROUP,
              order: s.envelopes.filter((e) => e.group === DEBT_GROUP).length,
              debtAccountId: id,
            },
          ];
      return { accounts: [...s.accounts, account], envelopes };
    });
    return id;
  },

  updateAccount: (id, patch) =>
    set((s) => ({
      accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)),
      envelopes:
        patch.name !== undefined
          ? s.envelopes.map((e) => (e.debtAccountId === id ? { ...e, name: patch.name! } : e))
          : s.envelopes,
    })),

  moveAccount: (id, direction) =>
    set((s) => {
      const sorted = [...s.accounts].sort((a, b) => a.order - b.order);
      const i = sorted.findIndex((a) => a.id === id);
      const j = i + direction;
      if (i < 0 || j < 0 || j >= sorted.length) return s;
      [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
      return { accounts: sorted.map((a, order) => ({ ...a, order })) };
    }),

  addEnvelope: ({ name, group, monthlyTarget, month }) => {
    const id = newId();
    const from = month ?? today().slice(0, 7);
    set((s) => ({
      envelopes: [
        ...s.envelopes,
        {
          id,
          name: name.trim(),
          group: group.trim() || 'Daily',
          order: s.envelopes.length,
          ...(monthlyTarget ? { targets: { [from]: monthlyTarget } } : {}),
        },
      ],
    }));
    return id;
  },

  setTarget: (envelopeId, month, amount) =>
    set((s) => ({
      envelopes: s.envelopes.map((e) => (e.id === envelopeId ? { ...e, targets: withTarget(e, month, amount) } : e)),
    })),

  updateEnvelope: (id, patch) =>
    set((s) => ({ envelopes: s.envelopes.map((e) => (e.id === id ? { ...e, ...patch } : e)) })),

  reorderEnvelopes: (groups) =>
    set((s) => {
      const place = new Map<string, { group: string; order: number }>();
      groups.forEach((g) => g.ids.forEach((id, order) => place.set(id, { group: g.name, order })));
      return {
        settings: { ...s.settings, groupOrder: groups.map((g) => g.name) },
        // Only envelopes that actually moved change, so sync writes just those.
        envelopes: s.envelopes.map((e) => {
          const p = place.get(e.id);
          return p && (p.group !== e.group || p.order !== e.order) ? { ...e, ...p } : e;
        }),
      };
    }),

  assign: (envelopeId, amount, date) => {
    if (!amount) return;
    set((s) => ({
      allocations: [
        ...s.allocations,
        { id: newId(), date: date ?? today(), envelopeId, amount, createdAt: Date.now() },
      ],
    }));
  },

  moveMoney: (fromEnvelopeId, toEnvelopeId, amount, date) => {
    if (!amount || fromEnvelopeId === toEnvelopeId) return;
    const now = Date.now();
    set((s) => ({
      allocations: [
        ...s.allocations,
        { id: newId(), date: date ?? today(), envelopeId: fromEnvelopeId, amount: -amount, createdAt: now },
        { id: newId(), date: date ?? today(), envelopeId: toEnvelopeId, amount, createdAt: now },
      ],
    }));
  },

  assignMany: (entries) => {
    const now = Date.now();
    const rows = entries
      .filter((e) => e.amount)
      .map((e) => ({ id: newId(), date: e.date, envelopeId: e.envelopeId, amount: e.amount, createdAt: now }));
    set((s) => ({ allocations: [...s.allocations, ...rows] }));
    return rows.map((r) => r.id);
  },

  removeAllocations: (ids) => set((s) => ({ allocations: s.allocations.filter((a) => !ids.includes(a.id)) })),

  addTransaction: (t) => {
    const id = newId();
    const row: Transaction = {
      id,
      date: t.date,
      accountId: t.accountId,
      amount: signed(t.kind, t.amount),
      kind: t.kind,
      payee: t.payee.trim(),
      envelopeId: t.kind === 'income' ? undefined : t.envelopeId,
      memo: t.memo,
      cleared: false,
      recurringId: t.recurringId,
      createdAt: Date.now(),
    };
    set((s) => ({
      transactions: [...s.transactions, row],
      payees: row.kind === 'income' ? learnPayee(s.payees, row.payee) : learnPayee(s.payees, row.payee, row.envelopeId),
    }));
    return id;
  },

  updateTransaction: (id, patch) =>
    set((s) => {
      const target = s.transactions.find((t) => t.id === id);
      if (!target) return s;
      const applyAmount = (t: Transaction): Transaction => {
        if (patch.amount === undefined) return t;
        const magnitude = Math.abs(patch.amount);
        return { ...t, amount: t.amount < 0 ? -magnitude : magnitude };
      };
      const moveTo =
        patch.accountId && patch.accountId !== target.accountId && (target.kind === 'spend' || target.kind === 'slip')
          ? s.accounts.find((a) => a.id === patch.accountId)
          : undefined;
      const transactions = s.transactions.map((t) => {
        if (t.id === id) {
          const { amount: _ignored, accountId: _account, ...rest } = patch;
          const next = applyAmount({ ...t, ...rest });
          // A different account means a different statement, so it's no longer reconciled.
          return moveTo
            ? { ...next, accountId: moveTo.id, kind: isCashAccount(moveTo) ? ('spend' as const) : ('slip' as const), reconciled: false, cleared: false }
            : next;
        }
        // Keep the other half of a transfer in sync.
        if (target.transferPairId && t.transferPairId === target.transferPairId) {
          return applyAmount({ ...t, date: patch.date ?? t.date });
        }
        return t;
      });
      const updated = transactions.find((t) => t.id === id)!;
      return {
        transactions,
        payees: patch.envelopeId || patch.payee ? learnPayee(s.payees, updated.payee, patch.envelopeId) : s.payees,
      };
    }),

  deleteTransaction: (id) =>
    set((s) => {
      const target = s.transactions.find((t) => t.id === id);
      if (!target) return s;
      return {
        transactions: s.transactions.filter(
          (t) => t.id !== id && !(target.transferPairId && t.transferPairId === target.transferPairId),
        ),
      };
    }),

  setFlag: (id, flagged) =>
    set((s) => ({ transactions: s.transactions.map((t) => (t.id === id ? { ...t, flagged } : t)) })),

  reconcileTransactions: (accountId, ids) => {
    const skipped: string[] = [];
    set((s) => ({
      transactions: s.transactions.map((t) => {
        if (t.accountId !== accountId || !ids.includes(t.id)) return t;
        if (!canReconcile(t)) {
          skipped.push(t.id);
          return t;
        }
        return { ...t, cleared: true, reconciled: true };
      }),
      accounts: s.accounts.map((a) => (a.id === accountId ? { ...a, lastReconciledOn: today() } : a)),
    }));
    return skipped;
  },

  addAdjustment: (accountId, amount) => {
    if (!amount) return;
    set((s) => ({
      transactions: [
        ...s.transactions,
        {
          id: newId(),
          date: today(),
          accountId,
          amount,
          kind: 'adjustment',
          payee: 'Balance adjustment',
          cleared: true,
          reconciled: true,
          createdAt: Date.now(),
        },
      ],
    }));
  },

  transfer: ({ fromAccountId, toAccountId, amount, date, envelopeId, payee }) => {
    const pair = newId();
    const accounts = get().accounts;
    const from = accounts.find((a) => a.id === fromAccountId);
    const to = accounts.find((a) => a.id === toAccountId);
    if (!from || !to) return;
    const now = Date.now();
    // Paying a debt from cash always comes out of that debt's payment envelope.
    const paymentEnvelope =
      !isCashAccount(to) && isCashAccount(from)
        ? (envelopeId ?? get().envelopes.find((e) => e.debtAccountId === to.id)?.id)
        : undefined;
    set((s) => ({
      transactions: [
        ...s.transactions,
        {
          id: newId(),
          date,
          accountId: from.id,
          amount: -Math.abs(amount),
          kind: 'transfer',
          payee: payee ?? `To ${to.name}`,
          envelopeId: paymentEnvelope,
          transferAccountId: to.id,
          transferPairId: pair,
          cleared: false,
          createdAt: now,
        },
        {
          id: newId(),
          date,
          accountId: to.id,
          amount: Math.abs(amount),
          kind: 'transfer',
          payee: payee ?? `From ${from.name}`,
          transferAccountId: from.id,
          transferPairId: pair,
          cleared: false,
          createdAt: now,
        },
      ],
    }));
  },

  reconcile: (accountId, bankBalance, pendingIds) => {
    const day = today();
    set((s) => {
      const account = s.accounts.find((a) => a.id === accountId);
      if (!account) return s;
      // Everything up to today that isn't still pending is now confirmed against the bank.
      let transactions = s.transactions.map((t) =>
        t.accountId === accountId && t.date <= day && !pendingIds.includes(t.id) && canReconcile(t)
          ? { ...t, cleared: true, reconciled: true }
          : t,
      );
      const cleared = transactions
        .filter((t) => t.accountId === accountId && t.cleared)
        .reduce((a, t) => a + t.amount, account.openingBalance);
      const diff = bankBalance - cleared;
      if (diff !== 0) {
        transactions = [
          ...transactions,
          {
            id: newId(),
            date: day,
            accountId,
            amount: diff,
            kind: 'adjustment',
            payee: 'Balance adjustment',
            cleared: true,
            reconciled: true,
            createdAt: Date.now(),
          },
        ];
      }
      return {
        transactions,
        accounts: s.accounts.map((a) => (a.id === accountId ? { ...a, lastReconciledOn: day } : a)),
      };
    });
  },

  recordStatement: (debtAccountId, statementOwed, trackedOwed) => {
    const diff = statementOwed - trackedOwed;
    set((s) => ({
      accounts: s.accounts.map((a) => (a.id === debtAccountId ? { ...a, lastReconciledOn: today() } : a)),
      transactions:
        diff === 0
          ? s.transactions
          : [
              ...s.transactions,
              {
                id: newId(),
                date: today(),
                accountId: debtAccountId,
                // More owed means the balance goes further negative.
                amount: -diff,
                kind: diff > 0 ? 'interest' : 'adjustment',
                payee: diff > 0 ? 'Interest and fees' : 'Statement correction',
                cleared: true,
                createdAt: Date.now(),
              },
            ],
    }));
  },

  addRecurring: (r) => {
    const id = newId();
    let envelopeId = r.envelopeId;
    if (!envelopeId) {
      // Every bill and subscription gets its own Bills envelope, budgeted to what it costs a
      // month, so approving it always spends money that was set aside for it.
      const existing = get().envelopes.find(
        (e) => !e.hidden && !e.debtAccountId && e.name.trim().toLowerCase() === r.name.trim().toLowerCase(),
      );
      if (existing) envelopeId = existing.id;
      else {
        envelopeId = get().addEnvelope({ name: r.name, group: 'Bills', monthlyTarget: monthlyBudget(r) });
        get().updateEnvelope(envelopeId, { recurringId: id });
      }
    }
    set((s) => ({ recurring: [...s.recurring, { ...r, envelopeId, id, active: true }] }));
    return id;
  },

  updateRecurring: (id, patch) => {
    const before = get().recurring.find((r) => r.id === id);
    set((s) => ({ recurring: s.recurring.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
    const after = get().recurring.find((r) => r.id === id);
    if (!before || !after?.envelopeId) return;
    // Keep the envelope that was made for this item in step with it.
    const envelope = get().envelopes.find((e) => e.id === after.envelopeId && e.recurringId === id);
    if (!envelope) return;
    if (after.name.trim() && after.name !== before.name) get().updateEnvelope(envelope.id, { name: after.name.trim() });
    if (after.amount !== before.amount || after.frequency !== before.frequency) {
      get().setTarget(envelope.id, today().slice(0, 7), monthlyBudget(after));
    }
  },

  // The envelope stays (it may hold money); it just stops following the deleted item.
  deleteRecurring: (id) =>
    set((s) => ({
      recurring: s.recurring.filter((r) => r.id !== id),
      envelopes: s.envelopes.map((e) => {
        if (e.recurringId !== id) return e;
        const { recurringId: _gone, ...rest } = e;
        return rest;
      }),
    })),

  approveRecurring: (id, amount) => {
    const r = get().recurring.find((x) => x.id === id);
    if (!r) return;
    const account = get().accounts.find((a) => a.id === r.accountId);
    get().addTransaction({
      date: r.nextDue,
      accountId: r.accountId,
      amount: amount ?? r.amount,
      kind: account && !isCashAccount(account) ? 'slip' : 'spend',
      payee: r.name,
      envelopeId: r.envelopeId,
      recurringId: r.id,
    });
    get().updateRecurring(id, { nextDue: advance(r) });
  },

  skipRecurring: (id) => {
    const r = get().recurring.find((x) => x.id === id);
    if (r) get().updateRecurring(id, { nextDue: advance(r) });
  },

  addPayee: (name, envelopeId) => {
    const existing = findPayee(get().payees, name);
    if (existing) {
      if (envelopeId) get().setPayeeEnvelope(existing.id, envelopeId);
      return existing.id;
    }
    const id = newId();
    set((s) => ({ payees: [...s.payees, { id, name: name.trim(), envelopeId }] }));
    return id;
  },

  renamePayee: (id, name) =>
    set((s) => ({ payees: s.payees.map((p) => (p.id === id && name.trim() ? { ...p, name: name.trim() } : p)) })),

  deletePayee: (id) => set((s) => ({ payees: s.payees.filter((p) => p.id !== id) })),

  setPayeeEnvelope: (id, envelopeId) =>
    set((s) => ({ payees: s.payees.map((p) => (p.id === id ? { ...p, envelopeId } : p)) })),

  normalizeGroups: () =>
    set((s) => {
      const changed = s.envelopes.some((e) => !e.debtAccountId && fixGroup(e.group) !== e.group);
      const order = s.settings.groupOrder;
      const fixedOrder = order && [...new Set(order.map((g) => (g === DEBT_GROUP ? g : fixGroup(g))))];
      const orderChanged = !!order && JSON.stringify(order) !== JSON.stringify(fixedOrder);
      if (!changed && !orderChanged) return s;
      return {
        envelopes: changed
          ? s.envelopes.map((e) => (e.debtAccountId || fixGroup(e.group) === e.group ? e : { ...e, group: fixGroup(e.group) }))
          : s.envelopes,
        settings: orderChanged ? { ...s.settings, groupOrder: fixedOrder } : s.settings,
      };
    }),

  migrateMerchantMemory: () =>
    set((s) => {
      const entries = Object.entries(s.merchantMemory);
      if (s.payees.length || !entries.length) return s;
      // The memory only kept normalized keys, so recover display names from transactions.
      const names = new Map<string, string>();
      for (const t of s.transactions) names.set(normalizePayee(t.payee), t.payee);
      return {
        payees: entries.map(([key, envelopeId]) => ({ id: newId(), name: names.get(key) ?? key, envelopeId })),
      };
    }),

  updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

  replaceAll: (state) => set(state),
}));

export function resetStore() {
  useStore.setState(initialState);
}
