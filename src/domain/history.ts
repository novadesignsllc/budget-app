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

/**
 * How cash usually changes in a month: the average over the last `months` full months of
 * money in and out of checking, savings and cash, leaving out payments to debts (the debt
 * plan accounts for those) and balance fixes. Moves between your own accounts cancel out.
 */
export function monthlyCashFlow(
  input: { accounts: Account[]; transactions: Transaction[] },
  today: ISODate,
  months = 3,
): Cents {
  const current = monthOf(today);
  const byId = new Map(input.accounts.map((a) => [a.id, a]));
  const first = firstFullMonth(input.accounts);
  if (!first) return 0;
  // Only full months the accounts existed for; a month you joined partway through would skew it.
  let start = addMonthKey(current, -months);
  while (start < first && start < current) start = addMonthKey(start, 1);
  const count = (Number(current.slice(0, 4)) - Number(start.slice(0, 4))) * 12 + Number(current.slice(5)) - Number(start.slice(5));
  if (count <= 0) return 0;
  const from = `${start}-01`;
  const to = monthEnd(addMonthKey(current, -1));
  let total = 0;
  for (const t of input.transactions) {
    if (t.date < from || t.date > to) continue;
    const a = byId.get(t.accountId);
    if (!a || !isCashAccount(a) || t.kind === 'adjustment') continue;
    const other = t.transferAccountId ? byId.get(t.transferAccountId) : undefined;
    if (t.kind === 'transfer' && other && !isCashAccount(other)) continue;
    total += t.amount;
  }
  return Math.round(total / count);
}

/**
 * Cash and debt for the next `months` months: debt follows the payoff plan (its monthly
 * balances), and cash grows by the usual monthly cash flow minus that month's debt payment.
 * Once the debts are paid off, their payment stays in cash.
 */
export function projectBalances({
  cash,
  debtBalances,
  monthlyPayment,
  cashFlow,
  months,
}: {
  cash: Cents;
  /** Total owed at the end of each month, starting now (the plan's `balances`). */
  debtBalances: Cents[];
  monthlyPayment: Cents;
  cashFlow: Cents;
  months: number;
}): { cash: Cents; debt: Cents }[] {
  const owed = (m: number) => (m < debtBalances.length ? debtBalances[m] : 0);
  const out: { cash: Cents; debt: Cents }[] = [];
  let c = cash;
  for (let m = 1; m <= months; m++) {
    const before = owed(m - 1);
    const after = owed(m);
    // The plan pays the monthly amount while debt remains; the last month pays what's left.
    const paid = before <= 0 ? 0 : after > 0 ? monthlyPayment : before;
    c += cashFlow - paid;
    out.push({ cash: c, debt: after });
  }
  return out;
}

/**
 * Average income a month: money that came in as income to checking, savings or cash, over
 * the last `months` full months you've had accounts (this month isn't over, so it's left
 * out). Zero until there's a full month.
 */
export function averageMonthlyIncome(
  input: { accounts: Account[]; transactions: Transaction[] },
  today: ISODate,
  months = 12,
): Cents {
  const current = monthOf(today);
  const first = firstFullMonth(input.accounts);
  if (!first) return 0;
  let start = addMonthKey(current, -months);
  while (start < first && start < current) start = addMonthKey(start, 1);
  const count = (Number(current.slice(0, 4)) - Number(start.slice(0, 4))) * 12 + Number(current.slice(5)) - Number(start.slice(5));
  if (count <= 0) return 0;
  const byId = new Map(input.accounts.map((a) => [a.id, a]));
  const from = `${start}-01`;
  const to = monthEnd(addMonthKey(current, -1));
  let total = 0;
  for (const t of input.transactions) {
    if (t.kind !== 'income' || t.amount <= 0 || t.date < from || t.date > to) continue;
    const a = byId.get(t.accountId);
    if (a && isCashAccount(a)) total += t.amount;
  }
  return Math.round(total / count);
}

/** The first month the cash accounts were open for all of: the opening month if opened on the 1st, else the next. */
function firstFullMonth(accounts: Account[]): string | null {
  const opened = accounts.filter(isCashAccount).map((a) => a.openedOn).sort()[0];
  if (!opened) return null;
  return opened.endsWith('-01') ? monthOf(opened) : addMonthKey(monthOf(opened), 1);
}
