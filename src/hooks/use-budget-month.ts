import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { today } from '@/domain/dates';
import { computeMonth, monthOf, type MonthKey } from '@/domain/months';
import { useStore } from '@/store';

export function useBudgetMonth(month: MonthKey) {
  const input = useStore(
    useShallow((s) => ({
      accounts: s.accounts,
      envelopes: s.envelopes,
      transactions: s.transactions,
      allocations: s.allocations,
    })),
  );
  return useMemo(() => computeMonth(input, month), [input, month]);
}

export function currentMonth(): MonthKey {
  return monthOf(today());
}
