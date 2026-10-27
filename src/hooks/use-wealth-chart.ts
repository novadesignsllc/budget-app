import { useMemo } from 'react';

import type { ChartSeries } from '@/components/line-chart';
import { today } from '@/domain/dates';
import { balanceHistory, monthlyCashFlow, projectBalances } from '@/domain/history';
import { formatMoney } from '@/domain/money';
import { addMonthKey } from '@/domain/months';
import { useDebtPlan } from '@/hooks/use-ledger';
import { useStore } from '@/store';
import { chartCash, chartDebt } from '@/theme';

/** A year back and a year ahead, so today sits in the middle of the chart. */
const BACK = 12;
const AHEAD = 12;

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
export function useWealthChart() {
  const accounts = useStore((s) => s.accounts);
  const transactions = useStore((s) => s.transactions);
  const { monthly, comparison } = useDebtPlan();

  return useMemo(() => {
    const day = today();
    // BACK months before this one, plus this month (which ends today).
    const history = balanceHistory({ accounts, transactions }, BACK + 1, day);
    if (history.length === 0) return null;
    const latest = history[history.length - 1];
    const cashFlow = monthlyCashFlow({ accounts, transactions }, day);
    const plan = comparison?.plan;
    const projected = projectBalances({
      cash: latest.cash,
      debtBalances: plan ? plan.balances : latest.debt > 0 ? [latest.debt] : [],
      monthlyPayment: monthly,
      cashFlow,
      months: AHEAD,
    });
    const months = [...history.map((h) => h.month), ...projected.map((_, i) => addMonthKey(latest.month, i + 1))];
    // The chart's floor is $0; a projection that runs out of cash stops there (and the note says when).
    const series: ChartSeries[] = [
      { id: 'debt', label: 'Debt', color: chartDebt, values: [...history.map((h) => h.debt), ...projected.map((p) => p.debt)] },
      {
        id: 'cash',
        label: 'Cash',
        color: chartCash,
        values: [...history.map((h) => h.cash), ...projected.map((p) => Math.max(0, p.cash))],
      },
    ];
    const projectFrom = history.length;
    const now = projectFrom - 1;

    // Five evenly spaced labels; today reads "Now".
    const thisYear = Number(latest.month.slice(0, 4));
    const tickLabel = (i: number) => {
      if (i === now) return 'Now';
      const key = months[i];
      const year = Number(key.slice(0, 4));
      return year === thisYear ? monthShort.format(asDate(key)) : `${monthShort.format(asDate(key))} ’${key.slice(2, 4)}`;
    };
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => tickLabel(Math.round(f * (months.length - 1))));

    const runsOut = projected.findIndex((p) => p.cash < 0);
    const end = projected[projected.length - 1];
    const usual =
      cashFlow === 0 ? 'stays about where it is' : `moves ${formatMoney(cashFlow, { whole: true, signed: true })} a month (your last 3 months)`;
    const note =
      projectFrom === 1 && cashFlow === 0
        ? 'Dashed lines are the next year. Cash stays flat until there’s a full month of history to project from.'
        : `Dashed lines are the next year: cash ${usual}${
            plan ? `, less debt payments; debt follows your ${formatMoney(monthly, { whole: true })}-a-month plan` : ''
          }.${runsOut >= 0 ? ` At this pace, cash runs out in ${monthLong.format(asDate(months[projectFrom + runsOut]))}.` : ''}`;

    return {
      history,
      latest,
      series,
      projectFrom,
      ticks,
      note,
      pointLabel: (i: number) => (i > now ? `Projected · ${monthLong.format(asDate(months[i]))}` : monthLong.format(asDate(months[i]))),
      accessibilityLabel: `Cash is ${formatMoney(latest.cash, { whole: true })} and debt ${formatMoney(latest.debt, { whole: true })} today. In a year, projected cash is ${formatMoney(Math.max(0, end.cash), { whole: true })} and debt ${formatMoney(end.debt, { whole: true })}.`,
    };
  }, [accounts, transactions, monthly, comparison]);
}
