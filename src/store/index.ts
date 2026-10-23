import { create } from 'zustand';

import { today } from '@/domain/dates';
import type { Strategy } from '@/domain/debt';
import { normalizePayee } from '@/domain/quick-add';
import { advance } from '@/domain/recurring';
import type {
  Account,
  AccountKind,
  Allocation,
  Cents,
  Envelope,
  ISODate,
  Recurring,
  Transaction,
  TransactionKind,
} from '@/domain/types';
import { isCashAccount } from '@/domain/types';

export const DEBT_GROUP = 'Debt payments';

export type Settings = {
  debtStrategy: Strategy;
  /** Total the user plans to put toward debt each month, minimums included. */
  monthlyDebtPayment: Cents;
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
  merchantMemory: Record<string, string>;
  settings: Settings;
};

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

  addEnvelope: (input: { name: string; group: string; monthlyTarget?: Cents }) => string;
  updateEnvelope: (
    id: string,
    patch: Partial<Pick<Envelope, 'name' | 'group' | 'monthlyTarget' | 'hidden'>>,
  ) => void;
  assign: (envelopeId: string, amount: Cents) => void;
  moveMoney: (fromEnvelopeId: string, toEnvelopeId: string, amount: Cents) => void;

  addTransaction: (t: NewTransaction) => string;
  updateTransaction: (
    id: string,
    patch: Partial<Pick<Transaction, 'date' | 'payee' | 'envelopeId' | 'memo' | 'cleared'>> & {
      amount?: Cents;
    },
  ) => void;
  deleteTransaction: (id: string) => void;
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
  merchantMemory: {},
  settings: defaultSettings,
};

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
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

  addEnvelope: ({ name, group, monthlyTarget }) => {
    const id = newId();
    set((s) => ({
      envelopes: [
        ...s.envelopes,
        {
          id,
          name: name.trim(),
          group: group.trim() || 'Everyday',
          order: s.envelopes.length,
          monthlyTarget,
        },
      ],
    }));
    return id;
  },

  updateEnvelope: (id, patch) =>
    set((s) => ({ envelopes: s.envelopes.map((e) => (e.id === id ? { ...e, ...patch } : e)) })),

  assign: (envelopeId, amount) => {
    if (!amount) return;
    set((s) => ({
      allocations: [
        ...s.allocations,
        { id: newId(), date: today(), envelopeId, amount, createdAt: Date.now() },
      ],
    }));
  },

  moveMoney: (fromEnvelopeId, toEnvelopeId, amount) => {
    if (!amount || fromEnvelopeId === toEnvelopeId) return;
    const now = Date.now();
    set((s) => ({
      allocations: [
        ...s.allocations,
        { id: newId(), date: today(), envelopeId: fromEnvelopeId, amount: -amount, createdAt: now },
        { id: newId(), date: today(), envelopeId: toEnvelopeId, amount, createdAt: now },
      ],
    }));
  },

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
      merchantMemory:
        row.envelopeId && row.payee
          ? { ...s.merchantMemory, [normalizePayee(row.payee)]: row.envelopeId }
          : s.merchantMemory,
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
      const transactions = s.transactions.map((t) => {
        if (t.id === id) {
          const { amount: _ignored, ...rest } = patch;
          return applyAmount({ ...t, ...rest });
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
        merchantMemory:
          patch.envelopeId && updated.payee
            ? { ...s.merchantMemory, [normalizePayee(updated.payee)]: patch.envelopeId }
            : s.merchantMemory,
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
        t.accountId === accountId && t.date <= day && !pendingIds.includes(t.id)
          ? { ...t, cleared: true }
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
    set((s) => ({ recurring: [...s.recurring, { ...r, id, active: true }] }));
    return id;
  },

  updateRecurring: (id, patch) =>
    set((s) => ({ recurring: s.recurring.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),

  deleteRecurring: (id) => set((s) => ({ recurring: s.recurring.filter((r) => r.id !== id) })),

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

  updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

  replaceAll: (state) => set(state),
}));

export function resetStore() {
  useStore.setState(initialState);
}
