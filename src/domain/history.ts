import { addMonthKey, monthEnd, monthOf, type MonthKey } from './months';
import { isCashAccount, type Account, type Cents, type ISODate, type Transaction } from './types';

export type BalancePoint = { month: MonthKey; cash: Cents; debt: Cents };

/**
 * Cash and debt at the end of each of the last `months` months (the current month ends
 * today). Debt is the total owed, as a positive number. Months before the first account
 * was added are left out.
 */
export function balanceHistory(
  input: { accounts: Account[]; transactions: Transaction[] },
  months = 12,
  today: ISODate,
): BalancePoint[] {
  if (!input.accounts.length) return [];
  const earliest = input.accounts.reduce((a, x) => (x.openedOn < a ? x.openedOn : a), input.accounts[0].openedOn);
  const current = monthOf(today);
  const byId = new Map(input.accounts.map((a) => [a.id, a]));
  const points: BalancePoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const month = addMonthKey(current, -i);
    const end = month === current ? today : monthEnd(month);
    if (end < earliest) continue;
    let cash = 0;
    let debt = 0;
    for (const a of input.accounts) {
      if (a.openedOn > end) continue;
      if (isCashAccount(a)) cash += a.openingBalance;
      else debt += -a.openingBalance;
    }
    for (const t of input.transactions) {
      if (t.date > end) continue;
      const a = byId.get(t.accountId);
      if (!a || a.openedOn > end) continue;
      if (isCashAccount(a)) cash += t.amount;
      else debt += -t.amount;
    }
    points.push({ month, cash, debt });
  }
  return points;
}
