import { useMemo } from 'react';

import type { ChartSeries } from '@/components/line-chart';
import { today } from '@/domain/dates';
import { balanceHistory, monthlyCashFlow, projectBalances } from '@/domain/history';
import { formatMoney } from '@/domain/money';
import { addMonthKey } from '@/domain/months';
import { useDebtPlan } from '@/hooks/use-ledger';
import { useStore } from '@/store';
import { chartCash, chartDebt } from '@/theme';

/** How far ahead the chart projects, and how much history it shows with it. */
export type WealthRange = 3 | 6 | 12;
const BACK: Record<WealthRange, number> = { 3: 2, 6: 4, 12: 6 };

const monthShort = new Intl.DateTimeFormat('en-US', { month: 'short' });
const monthLong = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
const asDate = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1);
};

/**
 * Cash against debt for Home's chart: the last year as it happened (solid), then the next
 * year projected (dashed). Debt follows the payoff plan; cash moves by the usual monthly
 * cash flow (last three full months) minus the plan's payments.
 */
export function useWealthChart(range: WealthRange = 3) {
  const accounts = useStore((s) => s.accounts);
  const transactions = useStore((s) => s.transactions);
  const { monthly, comparison } = useDebtPlan();

  return useMemo(() => {
    const day = today();
    // BACK months before this one, plus this month (which ends today).
    const history = balanceHistory({ accounts, transactions }, BACK[range] + 1, day);
    if (history.length === 0) return null;
    const latest = history[history.length - 1];
    const cashFlow = monthlyCashFlow({ accounts, transactions }, day);
    const plan = comparison?.plan;
    const projected = projectBalances({
      cash: latest.cash,
      debtBalances: plan ? plan.balances : latest.debt > 0 ? [latest.debt] : [],
      monthlyPayment: monthly,
      cashFlow,
      months: range,
    });
    const months = [...history.map((h) => h.month), ...projected.map((_, i) => addMonthKey(latest.month, i + 1))];
    // The chart's floor is $0; a projection that runs out of cash stops there.
    const series: ChartSeries[] = [
      {
        id: 'debt',
        label: 'Debt',
        color: chartDebt,
        values: [...history.map((h) => h.debt), ...projected.map((p) => p.debt)],
      },
      {
        id: 'cash',
        label: 'Cash',
        color: chartCash,
        values: [...history.map((h) => h.cash), ...projected.map((p) => Math.max(0, p.cash))],
      },
    ];
    const projectFrom = history.length;
    const now = projectFrom - 1;

    // Today reads "Now".
    const thisYear = Number(latest.month.slice(0, 4));
    const tickLabel = (i: number) => {
      if (i === now) return 'Now';
      const key = months[i];
      const year = Number(key.slice(0, 4));
      return year === thisYear
        ? monthShort.format(asDate(key))
        : `${monthShort.format(asDate(key))} ’${key.slice(2, 4)}`;
    };
    // Every month when there are few (so today is always labeled); otherwise five spread evenly.
    const ticks =
      months.length <= 7
        ? months.map((_, i) => tickLabel(i))
        : [0, 0.25, 0.5, 0.75, 1].map((f) => tickLabel(Math.round(f * (months.length - 1))));

    const end = projected[projected.length - 1];
    return {
      history,
      latest,
      series,
      projectFrom,
      ticks,
      pointLabel: (i: number) =>
        i > now ? `Projected · ${monthLong.format(asDate(months[i]))}` : monthLong.format(asDate(months[i])),
      accessibilityLabel: `Cash is ${formatMoney(latest.cash, { whole: true })} and debt ${formatMoney(latest.debt, { whole: true })} today. In a year, projected cash is ${formatMoney(Math.max(0, end.cash), { whole: true })} and debt ${formatMoney(end.debt, { whole: true })}.`,
    };
  }, [accounts, transactions, monthly, comparison, range]);
}
