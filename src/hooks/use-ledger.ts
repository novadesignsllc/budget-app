import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { comparePlan, estimateMinPayment, type DebtInput, type Strategy } from '@/domain/debt';
import { computeLedger, type Ledger, type LedgerInput } from '@/domain/ledger';
import { isCashAccount, isDebtAccount, type Account } from '@/domain/types';
import { useStore } from '@/store';

/**
 * One ledger shared by every screen: Home, Budget, Debt and the sheets all ask for it,
 * and tabs stay mounted, so without this each one recomputed it on every change.
 */
let lastLedger: { input: LedgerInput; ledger: Ledger } | null = null;
function sharedLedger(input: LedgerInput): Ledger {
  const last = lastLedger?.input;
  if (
    last &&
    last.accounts === input.accounts &&
    last.envelopes === input.envelopes &&
    last.transactions === input.transactions &&
    last.allocations === input.allocations
  ) {
    return lastLedger!.ledger;
  }
  const ledger = computeLedger(input);
  lastLedger = { input, ledger };
  return ledger;
}

export function useLedger() {
  const input = useStore(
    useShallow((s) => ({
      accounts: s.accounts,
      envelopes: s.envelopes,
      transactions: s.transactions,
      allocations: s.allocations,
    })),
  );
  return useMemo(() => sharedLedger(input), [input]);
}

export function useAccounts() {
  const accounts = useStore((s) => s.accounts);
  return useMemo(() => {
    const open = accounts.filter((a) => !a.closed).sort((a, b) => a.order - b.order);
    return {
      all: open,
      cash: open.filter(isCashAccount),
      debts: open.filter(isDebtAccount),
    };
  }, [accounts]);
}

export function toDebtInput(account: Account, owed: number): DebtInput {
  return {
    id: account.id,
    name: account.name,
    balance: owed,
    apr: account.apr ?? 0,
    minPayment: account.minPayment || estimateMinPayment(owed, account.apr ?? 0),
  };
}

/** The last plan, reused while the debts, the monthly amount and the strategy are the same. */
let lastPlan: { key: string; comparison: ReturnType<typeof comparePlan> | null } | null = null;
function sharedPlan(inputs: DebtInput[], monthly: number, strategy: Strategy) {
  // Projections run up to 600 months per debt; assigning money elsewhere shouldn't redo them.
  const key = JSON.stringify([inputs, monthly, strategy]);
  if (lastPlan?.key !== key) {
    lastPlan = { key, comparison: inputs.length ? comparePlan(inputs, monthly, strategy) : null };
  }
  return lastPlan.comparison;
}

/** The payoff plan for every open debt, using the user's strategy and monthly amount. */
export function useDebtPlan() {
  const ledger = useLedger();
  const { debts } = useAccounts();
  const settings = useStore((s) => s.settings);
  return useMemo(() => {
    const inputs = debts
      .map((a) => toDebtInput(a, -(ledger.balance.get(a.id) ?? 0)))
      .filter((d) => d.balance > 0);
    const minimums = inputs.reduce((a, d) => a + d.minPayment, 0);
    const monthly = Math.max(settings.monthlyDebtPayment, minimums);
    return { inputs, minimums, monthly, comparison: sharedPlan(inputs, monthly, settings.debtStrategy) };
  }, [debts, ledger, settings]);
}
