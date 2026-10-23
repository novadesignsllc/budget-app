import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { comparePlan, estimateMinPayment, type DebtInput } from '@/domain/debt';
import { computeLedger } from '@/domain/ledger';
import { isCashAccount, isDebtAccount, type Account } from '@/domain/types';
import { useStore } from '@/store';

export function useLedger() {
  const input = useStore(
    useShallow((s) => ({
      accounts: s.accounts,
      envelopes: s.envelopes,
      transactions: s.transactions,
      allocations: s.allocations,
    })),
  );
  return useMemo(() => computeLedger(input), [input]);
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
    return {
      inputs,
      minimums,
      monthly,
      comparison: inputs.length ? comparePlan(inputs, monthly, settings.debtStrategy) : null,
    };
  }, [debts, ledger, settings]);
}
