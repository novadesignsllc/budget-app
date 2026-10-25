import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { today } from '@/domain/dates';
import { computeMonth, monthOf, type BudgetMonth, type MonthKey } from '@/domain/months';
import { useStore } from '@/store';

type Input = Parameters<typeof computeMonth>[0];

/** Months already worked out for the current data, shared by Home, Budget and envelope pages. */
let cache: { input: Input; months: Map<MonthKey, BudgetMonth> } | null = null;
function sharedMonth(input: Input, month: MonthKey): BudgetMonth {
  const c = cache?.input;
  const same =
    c &&
    c.accounts === input.accounts &&
    c.envelopes === input.envelopes &&
    c.transactions === input.transactions &&
    c.allocations === input.allocations;
  if (!same) cache = { input, months: new Map() };
  let result = cache!.months.get(month);
  if (!result) {
    result = computeMonth(input, month);
    cache!.months.set(month, result);
  }
  return result;
}

export function useBudgetMonth(month: MonthKey) {
  const input = useStore(
    useShallow((s) => ({
      accounts: s.accounts,
      envelopes: s.envelopes,
      transactions: s.transactions,
      allocations: s.allocations,
    })),
  );
  return useMemo(() => sharedMonth(input, month), [input, month]);
}

export function currentMonth(): MonthKey {
  return monthOf(today());
}
