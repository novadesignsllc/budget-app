import { useMemo } from 'react';

import { today } from '@/domain/dates';
import { averageMonthlyIncome } from '@/domain/history';
import { incomeByMonth, incomeByPayee, incomeTransactions } from '@/domain/income';
import { addMonthKey, monthStart } from '@/domain/months';
import { useStore } from '@/store';
import { newestFirst } from '@/screens/transactions';

import { currentMonth } from './use-budget-month';

export type IncomeRange = 6 | 12;

/** Everything the Income page shows, for the last `range` months. */
export function useIncome(range: IncomeRange) {
  const accounts = useStore((s) => s.accounts);
  const transactions = useStore((s) => s.transactions);
  return useMemo(() => {
    const current = currentMonth();
    const income = incomeTransactions(accounts, transactions);
    const months = incomeByMonth(income, current, range);
    const from = monthStart(addMonthKey(current, 1 - range));
    const year = current.slice(0, 4);
    return {
      any: income.length > 0,
      months,
      average: averageMonthlyIncome({ accounts, transactions }, today()),
      thisMonth: months[months.length - 1]?.total ?? 0,
      lastMonth: months[months.length - 2]?.total ?? 0,
      thisYear: income.filter((t) => t.date.startsWith(year)).reduce((a, t) => a + t.amount, 0),
      payees: incomeByPayee(income, from),
      deposits: income.filter((t) => t.date >= from).sort(newestFirst),
    };
  }, [accounts, transactions, range]);
}

export const INCOME_RANGES: { value: IncomeRange; label: string }[] = [
  { value: 6, label: '6 months' },
  { value: 12, label: '1 year' },
];
