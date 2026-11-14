import type { Account, Cents, Transaction } from './types';
import type { MonthKey } from './months';

export type DayFlow = { inflow: Cents; outflow: Cents };

/**
 * Money in and out for each day of `month`, by day of the month: every transaction on
 * every account, inflow and outflow, so in minus out is what's left over. Transfers
 * between your own accounts and balance adjustments (starting balances, corrections)
 * aren't money coming or going, so they're left out.
 */
export function dailyFlow(_accounts: Account[], transactions: Transaction[], month: MonthKey): Map<number, DayFlow> {
  const days = new Map<number, DayFlow>();
  for (const t of transactions) {
    if (!t.date.startsWith(month) || !t.amount) continue;
    if (t.kind === 'transfer' || t.kind === 'adjustment') continue;
    const day = Number(t.date.slice(8, 10));
    const d = days.get(day) ?? { inflow: 0, outflow: 0 };
    if (t.amount > 0) d.inflow += t.amount;
    else d.outflow += -t.amount;
    days.set(day, d);
  }
  return days;
}

/** The month as weeks, Sunday first; null fills the days before the 1st and after the last. */
export function monthGrid(month: MonthKey): (number | null)[][] {
  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1).getDay();
  const days = new Date(y, m, 0).getDate();
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
