import { ceilDollars } from './money';
import { accountPool, envelopePool, type Pool } from './pools';
import { targetFor, targetNeed } from './targets';
import { isCashAccount, type Account, type Allocation, type Cents, type Envelope, type ISODate, type Transaction } from './types';

/** `YYYY-MM` */
export type MonthKey = string;

export function monthOf(date: ISODate): MonthKey {
  return date.slice(0, 7);
}

export function addMonthKey(month: MonthKey, n: number): MonthKey {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthStart(month: MonthKey): ISODate {
  return `${month}-01`;
}

export function monthEnd(month: MonthKey): ISODate {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${month}-${String(last).padStart(2, '0')}`;
}

const monthName = new Intl.DateTimeFormat('en-US', { month: 'long' });
const monthNameYear = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });

/** "October", or "October 2025" when it's not this year. */
export function formatMonth(month: MonthKey, currentYear = new Date().getFullYear()): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  return y === currentYear ? monthName.format(d) : monthNameYear.format(d);
}

/**
 * The date an assignment made while looking at `month` should carry: today when it's
 * the current month, the last day for a past month, the first day for a future one.
 */
export function assignDateFor(month: MonthKey, today: ISODate): ISODate {
  const current = monthOf(today);
  if (month === current) return today;
  return month < current ? monthEnd(month) : monthStart(month);
}

export type EnvelopeMonth = {
  /** Assigned during this month (can be negative if money was taken back). */
  assigned: Cents;
  /** Money in and out during this month. Spending is negative. */
  activity: Cents;
  /** Spending only, as a positive number. */
  spent: Cents;
  /** What was left from earlier months. */
  carriedIn: Cents;
  /** What's in the envelope at the end of the month. */
  available: Cents;
  /** All income that came in this month, for percent-of-income targets. */
  monthIncome?: Cents;
};

export type BudgetMonth = {
  month: MonthKey;
  envelopes: Map<string, EnvelopeMonth>;
  /** Cash in checking/savings/cash at the end of this month. */
  cash: Cents;
  /** Cash without a job as of this month: cash minus envelopes minus money set aside for later months. */
  readyToAssign: Cents;
  /**
   * The same split by pool once there's a savings account: checking and cash against
   * every envelope but Savings, savings accounts against the Savings envelopes. The two
   * add up to the totals above. Null means one pool (no savings account yet).
   */
  pools: Record<Pool, { cash: Cents; readyToAssign: Cents }> | null;
  /** All income that came in during this month. */
  income?: Cents;
};

/**
 * The budget as it stood for one month. Envelopes carry over, so `available` at the
 * end of a month is everything assigned and spent up to then. The core rule still
 * holds: readyToAssign + sum(available) + assigned-ahead-for-later-months = cash.
 */
export function computeMonth(
  input: { accounts: Account[]; envelopes: Envelope[]; transactions: Transaction[]; allocations: Allocation[] },
  month: MonthKey,
): BudgetMonth {
  const start = monthStart(month);
  const end = monthEnd(month);
  const accountById = new Map(input.accounts.map((a) => [a.id, a]));
  const paymentEnvelopeByDebt = new Map<string, string>();
  for (const e of input.envelopes) if (e.debtAccountId) paymentEnvelopeByDebt.set(e.debtAccountId, e.id);

  const rows = new Map<string, EnvelopeMonth>();
  for (const e of input.envelopes) {
    rows.set(e.id, { assigned: 0, activity: 0, spent: 0, carriedIn: 0, available: 0 });
  }
  const row = (id: string) => {
    let r = rows.get(id);
    if (!r) rows.set(id, (r = { assigned: 0, activity: 0, spent: 0, carriedIn: 0, available: 0 }));
    return r;
  };

  // Money assigned to a later month only counts against this one if it had already been
  // assigned by the time this month ended (budgeting ahead). Assignments made later, from
  // later paychecks, didn't exist yet.
  const [ey, em] = month.split('-').map(Number);
  const endTime = new Date(ey, em, 0, 23, 59, 59, 999).getTime();
  const savingsEnvelopes = new Set(input.envelopes.filter((e) => envelopePool(e) === 'savings').map((e) => e.id));
  let assignedLater = 0;
  let savingsLater = 0;
  for (const al of input.allocations) {
    if (al.date > end) {
      if (al.createdAt <= endTime) {
        assignedLater += al.amount;
        if (savingsEnvelopes.has(al.envelopeId)) savingsLater += al.amount;
      }
      continue;
    }
    const r = row(al.envelopeId);
    if (al.date < start) r.carriedIn += al.amount;
    else r.assigned += al.amount;
  }

  let cash = 0;
  let savingsCash = 0;
  let split = false;
  for (const a of input.accounts) {
    if (isCashAccount(a) && a.openedOn <= end) {
      cash += a.openingBalance;
      if (accountPool(a) === 'savings') savingsCash += a.openingBalance;
    }
    if (accountPool(a) === 'savings' && !a.closed && a.openedOn <= end) split = true;
  }

  const touch = (id: string, amount: Cents, date: ISODate) => {
    const r = row(id);
    if (date < start) r.carriedIn += amount;
    else {
      r.activity += amount;
      if (amount < 0) r.spent += -amount;
    }
  };

  let income = 0;
  for (const t of input.transactions) {
    if (t.date > end) continue;
    const account = accountById.get(t.accountId);
    if (!account) continue;
    if (isCashAccount(account)) {
      if (t.kind === 'income' && t.amount > 0 && t.date >= start) income += t.amount;
      cash += t.amount;
      if (accountPool(account) === 'savings') savingsCash += t.amount;
    }
    if (!t.envelopeId) continue;
    touch(t.envelopeId, t.amount, t.date);
    if (!isCashAccount(account)) {
      const pay = paymentEnvelopeByDebt.get(account.id);
      // The payment envelope receiving money isn't spending, so it never counts as "spent".
      if (pay) {
        const r = row(pay);
        if (t.date < start) r.carriedIn -= t.amount;
        else r.activity -= t.amount;
      }
    }
  }

  let total = 0;
  let savingsTotal = 0;
  for (const [id, r] of rows) {
    r.available = r.carriedIn + r.assigned + r.activity;
    r.monthIncome = income;
    total += r.available;
    if (savingsEnvelopes.has(id)) savingsTotal += r.available;
  }

  const readyToAssign = cash - total - assignedLater;
  const savingsReady = savingsCash - savingsTotal - savingsLater;
  const pools = split
    ? {
        spending: { cash: cash - savingsCash, readyToAssign: readyToAssign - savingsReady },
        savings: { cash: savingsCash, readyToAssign: savingsReady },
      }
    : null;
  return { month, envelopes: rows, cash, readyToAssign, pools, income };
}

/**
 * How much each envelope still needs this month to reach that month's target. Debt
 * payment envelopes use `debtTargets` (by envelope id), which come from their debt.
 */
export function targetGaps(
  envelopes: Envelope[],
  budget: BudgetMonth,
  debtTargets: Map<string, Cents> = new Map(),
): { envelopeId: string; need: Cents }[] {
  return envelopes
    .filter((e) => !e.hidden && (!e.debtAccountId || debtTargets.has(e.id)))
    .sort((a, b) => a.order - b.order)
    .map((e) => ({ e, target: e.debtAccountId ? (debtTargets.get(e.id) ?? null) : targetFor(e, budget.month) }))
    .filter(({ target }) => target !== null && target > 0)
    .map(({ e, target }) => {
      const row = budget.envelopes.get(e.id) ?? { assigned: 0, carriedIn: 0, available: 0 };
      // Debt payments always want the full amount this month.
      const need = e.debtAccountId ? target! - row.assigned : targetNeed(e, target!, row, budget.month);
      // Whole dollars, rounded up: Auto-assign never leaves a target a few cents short.
      return { envelopeId: e.id, need: ceilDollars(need) };
    })
    .filter((g) => g.need > 0);
}

/** How far ahead you can budget: a year of months after this one. */
export const MONTHS_AHEAD = 12;

/** You can always look back, and plan up to MONTHS_AHEAD months ahead. */
export function canGoToMonth(month: MonthKey, today: ISODate): boolean {
  return month <= addMonthKey(monthOf(today), MONTHS_AHEAD);
}

/** Money already given to months after `month` (budgeting ahead), and which months. */
export function assignedAhead(allocations: Allocation[], month: MonthKey): { total: Cents; months: MonthKey[] } {
  const end = monthEnd(month);
  const months = new Set<MonthKey>();
  let total = 0;
  for (const a of allocations) {
    if (a.date <= end) continue;
    total += a.amount;
    months.add(monthOf(a.date));
  }
  return { total, months: [...months].sort() };
}
