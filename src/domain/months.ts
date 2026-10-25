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
};

export type BudgetMonth = {
  month: MonthKey;
  envelopes: Map<string, EnvelopeMonth>;
  /** Cash in checking/savings/cash at the end of this month. */
  cash: Cents;
  /** Cash without a job as of this month: cash minus envelopes minus money set aside for later months. */
  readyToAssign: Cents;
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
  let assignedLater = 0;
  for (const al of input.allocations) {
    if (al.date > end) {
      if (al.createdAt <= endTime) assignedLater += al.amount;
      continue;
    }
    const r = row(al.envelopeId);
    if (al.date < start) r.carriedIn += al.amount;
    else r.assigned += al.amount;
  }

  let cash = 0;
  for (const a of input.accounts) {
    if (isCashAccount(a) && a.openedOn <= end) cash += a.openingBalance;
  }

  const touch = (id: string, amount: Cents, date: ISODate) => {
    const r = row(id);
    if (date < start) r.carriedIn += amount;
    else {
      r.activity += amount;
      if (amount < 0) r.spent += -amount;
    }
  };

  for (const t of input.transactions) {
    if (t.date > end) continue;
    const account = accountById.get(t.accountId);
    if (!account) continue;
    if (isCashAccount(account)) cash += t.amount;
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
  for (const r of rows.values()) {
    r.available = r.carriedIn + r.assigned + r.activity;
    total += r.available;
  }

  return { month, envelopes: rows, cash, readyToAssign: cash - total - assignedLater };
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
      const row = budget.envelopes.get(e.id) ?? { assigned: 0, carriedIn: 0 };
      // Debt payments always want the full amount this month.
      const need = e.debtAccountId ? target! - row.assigned : targetNeed(e, target!, row);
      return { envelopeId: e.id, need };
    })
    .filter((g) => g.need > 0);
}

/** You can always look back, but not ahead of the current calendar month. */
export function canGoToMonth(month: MonthKey, today: ISODate): boolean {
  return month <= monthOf(today);
}
