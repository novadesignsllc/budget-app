import { addMonthKey, monthOf, type MonthKey } from './months';
import { normalizePayee } from './quick-add';
import { isCashAccount, type Account, type Cents, type ISODate, type Transaction } from './types';

/** Money that came in: income into a bank account (transfers and card refunds don't count). */
export function incomeTransactions(accounts: Account[], transactions: Transaction[]): Transaction[] {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  return transactions.filter((t) => {
    if (t.kind !== 'income' || t.amount <= 0) return false;
    const a = byId.get(t.accountId);
    return !!a && isCashAccount(a);
  });
}

/** Income per month for the `count` months ending with `current`, oldest first. */
export function incomeByMonth(income: Transaction[], current: MonthKey, count: number): { month: MonthKey; total: Cents }[] {
  const totals = new Map<MonthKey, Cents>();
  for (const t of income) {
    const m = monthOf(t.date);
    totals.set(m, (totals.get(m) ?? 0) + t.amount);
  }
  return Array.from({ length: count }, (_, i) => {
    const month = addMonthKey(current, i - count + 1);
    return { month, total: totals.get(month) ?? 0 };
  });
}

export type PayeeIncome = { payee: string; total: Cents; count: number; last: ISODate };

/** Who pays you, most first, from `from` on. Names that differ only in case or punctuation are one payee. */
export function incomeByPayee(income: Transaction[], from: ISODate): PayeeIncome[] {
  const byKey = new Map<string, PayeeIncome>();
  for (const t of income) {
    if (t.date < from) continue;
    const key = normalizePayee(t.payee) || t.payee;
    const p = byKey.get(key);
    if (!p) byKey.set(key, { payee: t.payee, total: t.amount, count: 1, last: t.date });
    else {
      p.total += t.amount;
      p.count += 1;
      if (t.date > p.last) {
        p.last = t.date;
        p.payee = t.payee;
      }
    }
  }
  return [...byKey.values()].sort((a, b) => b.total - a.total || a.payee.localeCompare(b.payee));
}
