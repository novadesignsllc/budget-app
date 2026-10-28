import { isCashAccount, type Account, type Cents, type Transaction } from './types';
import type { MonthKey } from './months';

export type DayFlow = { income: Cents; spending: Cents };

/**
 * Money in and out for each day of `month`, by day of the month. Income is money into a
 * bank account that went to Ready to assign. Spending is money out of an envelope, on a
 * bank account or a card. Transfers, refunds and debt payments are neither.
 */
export function dailyFlow(accounts: Account[], transactions: Transaction[], month: MonthKey): Map<number, DayFlow> {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const days = new Map<number, DayFlow>();
  for (const t of transactions) {
    if (!t.date.startsWith(month)) continue;
    const income = t.kind === 'income' && t.amount > 0 && isCashAccount(byId.get(t.accountId) ?? ({} as Account));
    const spending = (t.kind === 'spend' || t.kind === 'slip') && t.amount < 0;
    if (!income && !spending) continue;
    const day = Number(t.date.slice(8, 10));
    const d = days.get(day) ?? { income: 0, spending: 0 };
    if (income) d.income += t.amount;
    else d.spending += -t.amount;
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
