import { today } from './dates';
import type { Account, Cents } from './types';

export type Strategy = 'snowball' | 'avalanche';

export type DebtInput = {
  id: string;
  name: string;
  /** Amount owed, positive. */
  balance: Cents;
  /** Basis points: 24.99% = 2499. */
  apr: number;
  minPayment: Cents;
};

export type DebtResult = {
  id: string;
  /** Months from now until this debt hits zero. 1 = paid off next month. */
  payoffMonth: number | null;
  interest: Cents;
};

export type Projection = {
  /** Months until every debt is gone, or null if payments never catch up. */
  months: number | null;
  totalInterest: Cents;
  totalPaid: Cents;
  perDebt: DebtResult[];
  /** Total balance at the end of each month, starting with today. For charts. */
  balances: Cents[];
  /** Each debt's balance at the end of each month, starting with today. For charts. */
  perDebtBalances: Record<string, Cents[]>;
};

const MAX_MONTHS = 600;

/** Fallback when a debt has no minimum set: interest plus 1% of balance, at least $25. */
export function estimateMinPayment(balance: Cents, apr: number): Cents {
  const interest = Math.round((balance * apr) / 10000 / 12);
  return Math.max(2500, interest + Math.round(balance * 0.01));
}

export function orderDebts(debts: DebtInput[], strategy: Strategy): DebtInput[] {
  return [...debts].sort((a, b) =>
    strategy === 'snowball'
      ? a.balance - b.balance || b.apr - a.apr
      : b.apr - a.apr || a.balance - b.balance,
  );
}

/**
 * Month-by-month payoff. Interest accrues first, then every debt gets its minimum,
 * then whatever is left of `monthlyPayment` goes to the first unpaid debt in order.
 * When a debt is paid off its minimum rolls into the next one (the snowball).
 *
 * With `rollover: false` and `monthlyPayment` equal to the sum of minimums, this is
 * the "minimums only" baseline: freed-up minimums are not redirected.
 */
export function project(
  debts: DebtInput[],
  monthlyPayment: Cents,
  strategy: Strategy,
  opts: { rollover?: boolean } = {},
): Projection {
  const rollover = opts.rollover ?? true;
  const ordered = orderDebts(
    debts.filter((d) => d.balance > 0),
    strategy,
  );
  const bal = ordered.map((d) => d.balance);
  const interest = ordered.map(() => 0);
  const payoff: (number | null)[] = ordered.map(() => null);
  const balances: Cents[] = [bal.reduce((a, b) => a + b, 0)];
  const perDebtBalances: Record<string, Cents[]> = Object.fromEntries(ordered.map((d, i) => [d.id, [bal[i]]]));
  let totalPaid = 0;
  let month = 0;

  while (bal.some((b) => b > 0) && month < MAX_MONTHS) {
    month++;
    for (let i = 0; i < ordered.length; i++) {
      if (bal[i] <= 0) continue;
      const charge = Math.round((bal[i] * ordered[i].apr) / 10000 / 12);
      bal[i] += charge;
      interest[i] += charge;
    }

    let budget = monthlyPayment;
    for (let i = 0; i < ordered.length; i++) {
      if (bal[i] <= 0) continue;
      const pay = Math.min(ordered[i].minPayment, bal[i], Math.max(budget, 0));
      bal[i] -= pay;
      budget -= pay;
      totalPaid += pay;
    }

    if (rollover) {
      for (let i = 0; i < ordered.length && budget > 0; i++) {
        if (bal[i] <= 0) continue;
        const pay = Math.min(budget, bal[i]);
        bal[i] -= pay;
        budget -= pay;
        totalPaid += pay;
      }
    }

    for (let i = 0; i < ordered.length; i++) {
      if (bal[i] <= 0 && payoff[i] === null) payoff[i] = month;
    }
    balances.push(bal.reduce((a, b) => a + Math.max(b, 0), 0));
    ordered.forEach((d, i) => perDebtBalances[d.id].push(Math.max(bal[i], 0)));

    // Payments no longer cover interest: this plan never finishes.
    if (balances[balances.length - 1] >= balances[balances.length - 2] && month > 1) {
      return {
        months: null,
        totalInterest: interest.reduce((a, b) => a + b, 0),
        totalPaid,
        perDebt: ordered.map((d, i) => ({ id: d.id, payoffMonth: payoff[i], interest: interest[i] })),
        balances,
        perDebtBalances,
      };
    }
  }

  const done = bal.every((b) => b <= 0);
  return {
    months: done ? month : null,
    totalInterest: interest.reduce((a, b) => a + b, 0),
    totalPaid,
    perDebt: ordered.map((d, i) => ({ id: d.id, payoffMonth: payoff[i], interest: interest[i] })),
    balances,
    perDebtBalances,
  };
}

export type PlanComparison = {
  plan: Projection;
  minimumsOnly: Projection;
  /** Interest avoided by following the plan instead of paying minimums. */
  interestSaved: Cents;
  monthsSaved: number | null;
};

export function comparePlan(
  debts: DebtInput[],
  monthlyPayment: Cents,
  strategy: Strategy,
): PlanComparison {
  const minimums = debts.reduce((a, d) => a + (d.balance > 0 ? d.minPayment : 0), 0);
  const plan = project(debts, Math.max(monthlyPayment, minimums), strategy);
  const minimumsOnly = project(debts, minimums, strategy, { rollover: false });
  return {
    plan,
    minimumsOnly,
    interestSaved: Math.max(0, minimumsOnly.totalInterest - plan.totalInterest),
    monthsSaved:
      plan.months !== null && minimumsOnly.months !== null ? minimumsOnly.months - plan.months : null,
  };
}

/**
 * When a statement arrives: whatever the statement says beyond what the app already
 * knows about (opening balance, slips, payments) must be interest or fees.
 * Both values are positive amounts owed.
 */
export function interestFromStatement(statementOwed: Cents, trackedOwed: Cents): Cents {
  return statementOwed - trackedOwed;
}

/** What one month of interest should roughly be, to sanity-check a statement. */
export function expectedMonthlyInterest(owed: Cents, apr: number): Cents {
  return Math.round((owed * apr) / 10000 / 12);
}

/**
 * What a debt's payment envelope should get each month: what it takes to pay it off by
 * `payoffBy` if that's set, else the custom target, else the minimum (or an estimate when
 * there's no minimum). Never less than the minimum, never more than is owed.
 */
export function debtTarget(
  account: Pick<Account, 'paymentTarget' | 'minPayment' | 'apr' | 'payoffBy'>,
  owed: Cents,
  month: string = today().slice(0, 7),
): Cents {
  if (owed <= 0) return 0;
  const minimum = account.minPayment || estimateMinPayment(owed, account.apr ?? 0);
  const target = account.payoffBy
    ? Math.max(minimum, payoffPayment(owed, account.apr ?? 0, monthsUntil(month, account.payoffBy)))
    : (account.paymentTarget ?? minimum);
  return Math.min(target, owed);
}

/** Months from `from` through `to`, counting both (at least 1). */
function monthsUntil(from: string, to: string): number {
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  return Math.max(1, (ty - fy) * 12 + (tm - fm) + 1);
}

/**
 * The level monthly payment that clears `owed` in `months` payments at `apr` (basis
 * points), rounded up to whole dollars so it never falls short.
 */
export function payoffPayment(owed: Cents, apr: number, months: number): Cents {
  const r = apr / 10000 / 12;
  const payment = r > 0 ? (owed * r) / (1 - Math.pow(1 + r, -months)) : owed / months;
  return Math.ceil(payment / 100) * 100;
}

/**
 * How much of a card's limit is used: green under 30% (where it helps your credit), yellow
 * from 30%, red from 90% or over the limit. Null when the card has no limit set.
 */
export type CreditUse = { used: number; available: Cents; level: 'good' | 'high' | 'max' };
export function creditUse(owed: Cents, limit: Cents | undefined): CreditUse | null {
  if (!limit || limit <= 0) return null;
  const used = Math.max(0, owed) / limit;
  return { used, available: limit - Math.max(0, owed), level: used >= 0.9 ? 'max' : used >= 0.3 ? 'high' : 'good' };
}
