/**
 * Audit of the budget math and month rollover (2026-11-14).
 *
 * Two kinds of tests live here:
 * - "pins": scenarios that check the core rule in every month and both pools, rollover,
 *   and Home-vs-Budget agreement. These pass today and should keep passing.
 * - "bugs": each one FAILS today and asserts what the app should do. The comment above
 *   each says why. Delete the `BUG` prefix once fixed.
 */
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';

import { useStore, resetStore } from '@/store';

import { budgetHealth } from './health';
import { balanceHistory } from './history';
import { computeLedger, overspentEnvelopes } from './ledger';
import { floorDollars, formatDollars } from './money';
import { addMonthKey, assignedAhead, computeMonth, monthEnd, type BudgetMonth, type MonthKey } from './months';
import { envelopePool } from './pools';
import { isCashAccount, type Account, type Allocation, type Envelope, type Transaction } from './types';

type Input = { accounts: Account[]; envelopes: Envelope[]; transactions: Transaction[]; allocations: Allocation[] };

const endTime = (month: MonthKey) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 0, 23, 59, 59, 999).getTime();
};

/** Money assigned to months after `month` that already existed when `month` ended. */
function laterFor(input: Input, month: MonthKey, pool?: 'spending' | 'savings') {
  const byId = new Map(input.envelopes.map((e) => [e.id, e]));
  return input.allocations
    .filter((a) => a.date > monthEnd(month) && a.createdAt <= endTime(month))
    .filter((a) => !pool || envelopePool(byId.get(a.envelopeId) ?? { group: 'Daily' }) === pool)
    .reduce((s, a) => s + a.amount, 0);
}

/**
 * An independent recomputation of "the budget at the end of `month`": run the all-time
 * ledger over only what was dated by then. Accounts not yet opened are left out.
 */
function ledgerAsOf(input: Input, month: MonthKey) {
  const end = monthEnd(month);
  return computeLedger({
    accounts: input.accounts.filter((a) => a.openedOn <= end),
    envelopes: input.envelopes,
    transactions: input.transactions.filter((t) => t.date <= end),
    allocations: input.allocations.filter((a) => a.date <= end),
  });
}

/** Checks the core rule for one month, both pools, and that it agrees with the as-of ledger. */
function checkMonth(input: Input, month: MonthKey): BudgetMonth {
  const b = computeMonth(input, month);
  const avail = (pool?: 'spending' | 'savings') => {
    let s = 0;
    for (const [id, r] of b.envelopes) {
      const e = input.envelopes.find((x) => x.id === id);
      if (!pool || envelopePool(e ?? { group: 'Daily' }) === pool) s += r.available;
    }
    return s;
  };
  // Core rule: readyToAssign + envelopes + assigned-ahead = cash.
  expect(b.readyToAssign + avail() + laterFor(input, month)).toBe(b.cash);
  if (b.pools) {
    expect(b.pools.spending.cash + b.pools.savings.cash).toBe(b.cash);
    expect(b.pools.spending.readyToAssign + b.pools.savings.readyToAssign).toBe(b.readyToAssign);
    expect(b.pools.savings.readyToAssign + avail('savings') + laterFor(input, month, 'savings')).toBe(b.pools.savings.cash);
    expect(b.pools.spending.readyToAssign + avail('spending') + laterFor(input, month, 'spending')).toBe(
      b.pools.spending.cash,
    );
    // Savings cash is the savings accounts' real balances at month end.
    const asOf = ledgerAsOf(input, month);
    const savingsBalances = input.accounts
      .filter((a) => a.kind === 'savings' && a.openedOn <= monthEnd(month))
      .reduce((s, a) => s + (asOf.balance.get(a.id) ?? 0), 0);
    expect(b.pools.savings.cash).toBe(savingsBalances);
  }
  // Every envelope's month-end balance equals the ledger run up to that date.
  const asOf = ledgerAsOf(input, month);
  for (const e of input.envelopes) expect(b.envelopes.get(e.id)!.available).toBe(asOf.available.get(e.id) ?? 0);
  expect(b.cash).toBe(asOf.cashTotal);
  return b;
}

function checkRollover(input: Input, months: MonthKey[]) {
  for (let i = 1; i < months.length; i++) {
    const before = computeMonth(input, months[i - 1]);
    const now = computeMonth(input, months[i]);
    for (const e of input.envelopes) {
      expect(now.envelopes.get(e.id)!.carriedIn).toBe(before.envelopes.get(e.id)!.available);
    }
  }
}

const at = (y: number, m: number, d: number, h = 12) => jest.setSystemTime(new Date(y, m - 1, d, h));
const state = (): Input => {
  const s = useStore.getState();
  return { accounts: s.accounts, envelopes: s.envelopes, transactions: s.transactions, allocations: s.allocations };
};
const envId = (name: string) => useStore.getState().envelopes.find((e) => e.name === name)!.id;

// ---------------------------------------------------------------------------------------
// Pins: a four-month life lived through the store, checked month by month.
// ---------------------------------------------------------------------------------------

describe('pins: the core rule through four months of real store actions', () => {
  const MONTHS = ['2026-08', '2026-09', '2026-10', '2026-11', '2026-12', '2027-01'];
  let chk = '';
  let visa = '';
  let sav = '';

  beforeAll(() => {
    jest.useFakeTimers({ now: new Date(2026, 8, 1, 9) });
    resetStore();
    const s = useStore.getState();
    chk = s.addAccount({ name: 'Checking', kind: 'checking', balance: 100000 });
    visa = s.addAccount({ name: 'Visa', kind: 'credit_card', balance: 50000, apr: 2499, minPayment: 3500 });
    for (const [name, group] of [
      ['Groceries', 'Daily'],
      ['Rent', 'Daily'],
      ['Fun', 'Daily'],
      ['Emergency', 'Savings'],
    ] as const)
      s.addEnvelope({ name, group });
    const st = () => useStore.getState();

    // September: paycheck, assign, spend, refund, slip that overspends, card payment.
    st().addTransaction({ date: '2026-09-01', accountId: chk, amount: 300000, kind: 'income', payee: 'Job' });
    st().assign(envId('Rent'), 150000);
    st().assign(envId('Groceries'), 50000);
    st().assign(envId('Emergency'), 20000);
    st().assign(envId('Fun'), 10000);
    at(2026, 9, 10);
    st().addTransaction({ date: '2026-09-10', accountId: chk, amount: 30000, kind: 'spend', payee: 'Kroger', envelopeId: envId('Groceries') });
    st().addTransaction({ date: '2026-09-10', accountId: visa, amount: 15000, kind: 'slip', payee: 'Concert', envelopeId: envId('Fun') });
    const refund = st().addTransaction({ date: '2026-09-11', accountId: chk, amount: 4000, kind: 'spend', payee: 'Kroger', envelopeId: envId('Groceries') });
    st().editTransaction(refund, { date: '2026-09-11', payee: 'Kroger', memo: '', amount: 4000, envelope: envId('Groceries') });
    st().addTransaction({ date: '2026-09-12', accountId: chk, amount: 150000, kind: 'spend', payee: 'Landlord', envelopeId: envId('Rent') });
    at(2026, 9, 20);
    st().transfer({ fromAccountId: chk, toAccountId: visa, amount: 20000, date: '2026-09-20' });
    at(2026, 9, 25);
    st().assign(envId('Rent'), 150000, '2026-10-01'); // budgeting ahead

    // October: paycheck, open savings mid-month, move money to it, interest, card refund,
    // cash overspending, assign in a past month, assign ahead two months and take some back.
    at(2026, 10, 3);
    st().addTransaction({ date: '2026-10-03', accountId: chk, amount: 300000, kind: 'income', payee: 'Job' });
    st().assign(envId('Groceries'), 50000);
    at(2026, 10, 15);
    sav = st().addAccount({ name: 'Savings', kind: 'savings', balance: 0 });
    st().transfer({ fromAccountId: chk, toAccountId: sav, amount: 20000, date: '2026-10-15' });
    at(2026, 10, 16);
    const owed = -(computeLedger(state()).balance.get(visa) ?? 0);
    st().recordStatement(visa, owed + 1234, owed);
    at(2026, 10, 18);
    const cardRefund = st().addTransaction({ date: '2026-10-18', accountId: visa, amount: 2500, kind: 'slip', payee: 'Concert', envelopeId: envId('Fun') });
    st().editTransaction(cardRefund, { date: '2026-10-18', payee: 'Concert', memo: '', amount: 2500, envelope: envId('Fun') });
    at(2026, 10, 20);
    st().addTransaction({ date: '2026-10-20', accountId: chk, amount: 90000, kind: 'spend', payee: 'Costco', envelopeId: envId('Groceries') });
    at(2026, 10, 22);
    st().assign(envId('Groceries'), 5000, '2026-09-30'); // assigning in a past month
    at(2026, 10, 25);
    st().assign(envId('Fun'), 10000, '2026-12-01');
    st().assign(envId('Fun'), -4000, '2026-12-01'); // moving some back
    at(2026, 10, 28);
    st().addAdjustment(chk, -1500, { fix: true });

    // November: a bill approved, paycheck, a slip from a Savings envelope, card paid from savings.
    at(2026, 11, 1);
    st().addRecurring({ name: 'Phone', kind: 'bill', amount: 6000, accountId: chk, frequency: 'monthly', nextDue: '2026-11-05' });
    st().assign(envId('Phone'), 6000);
    at(2026, 11, 5);
    st().approveRecurring(st().recurring[0].id);
    st().addTransaction({ date: '2026-11-05', accountId: chk, amount: 300000, kind: 'income', payee: 'Job' });
    st().addTransaction({ date: '2026-11-06', accountId: visa, amount: 3000, kind: 'slip', payee: 'Tires', envelopeId: envId('Emergency') });
    st().transfer({ fromAccountId: sav, toAccountId: visa, amount: 3000, date: '2026-11-07' });
    at(2026, 11, 14);
  });

  afterAll(() => {
    jest.useRealTimers();
    resetStore();
  });

  it('posted what the scenario meant to (refund, card refund, interest, adjustment, bill)', () => {
    const t = state().transactions;
    expect(t.some((x) => x.accountId === chk && x.kind === 'spend' && x.amount === 4000)).toBe(true);
    expect(t.some((x) => x.accountId === visa && x.kind === 'slip' && x.amount === 2500)).toBe(true);
    expect(t.some((x) => x.kind === 'interest' && x.amount === -1234 && x.date === '2026-10-16')).toBe(true);
    expect(t.some((x) => x.kind === 'adjustment' && x.amount === -1500 && x.date === '2026-10-28')).toBe(true);
    expect(t.some((x) => x.recurringId && x.date === '2026-11-05' && x.amount === -6000)).toBe(true);
    expect(state().accounts.find((a) => a.id === sav)!.openedOn).toBe('2026-10-15');
  });

  it('holds readyToAssign + envelopes + assigned-ahead = cash in every month and both pools', () => {
    const input = state();
    for (const m of MONTHS) checkMonth(input, m);
  });

  it('carries every envelope’s end-of-month balance into the next month, negatives included', () => {
    const input = state();
    checkRollover(input, MONTHS);
    // Groceries was overspent in cash in October; the minus carries into November.
    const oct = computeMonth(input, '2026-10');
    const nov = computeMonth(input, '2026-11');
    expect(oct.envelopes.get(envId('Groceries'))!.available).toBeLessThan(0);
    expect(nov.envelopes.get(envId('Groceries'))!.carriedIn).toBe(oct.envelopes.get(envId('Groceries'))!.available);
  });

  it('Home (ledger) and Budget (this month) agree on Ready to assign, cash and every envelope here', () => {
    const input = state();
    const l = computeLedger(input);
    const nov = computeMonth(input, '2026-11');
    expect(nov.readyToAssign).toBe(l.readyToAssign);
    expect(nov.cash).toBe(l.cashTotal);
    // December's Fun money (assigned ahead) is the only difference per envelope.
    for (const e of input.envelopes) {
      const ahead = input.allocations.filter((a) => a.envelopeId === e.id && a.date > monthEnd('2026-11')).reduce((s, a) => s + a.amount, 0);
      expect(nov.envelopes.get(e.id)!.available + ahead).toBe(l.available.get(e.id));
    }
  });

  it('budget cash matches the balance chart at each month end', () => {
    const input = state();
    const points = balanceHistory(input, 4, '2026-11-14');
    for (const p of points) expect(computeMonth(input, p.month).cash).toBe(p.cash);
  });

  it('September counts the money assigned ahead to October (made Sep 25), not later assignments', () => {
    const input = state();
    const sep = computeMonth(input, '2026-09');
    // Rent for October was set aside in September, so September can't spend it again.
    expect(laterFor(input, '2026-09')).toBe(150000);
    // December's Fun money was assigned in October, so September never saw it.
    expect(input.allocations.some((a) => a.date === '2026-12-01')).toBe(true);
    expect(sep.readyToAssign).toBe(sep.cash - [...sep.envelopes.values()].reduce((s, r) => s + r.available, 0) - 150000);
  });

  it('the card payment envelope follows slips, card refunds and payments', () => {
    const input = state();
    const pay = input.envelopes.find((e) => e.debtAccountId === visa)!.id;
    const l = computeLedger(input);
    // +150 slip, -200 paid, -25 card refund, +30 slip, -30 paid from savings.
    expect(l.available.get(pay)).toBe(15000 - 20000 - 2500 + 3000 - 3000);
    const nov = computeMonth(input, '2026-11');
    expect(nov.envelopes.get(pay)!.spent).toBe(3000); // card payments count as "spent" here
  });

  it('splits into pools only from the month the savings account opened', () => {
    const input = state();
    expect(computeMonth(input, '2026-09').pools).toBeNull();
    expect(computeMonth(input, '2026-10').pools).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------------------
// Pins: correct by the rules, but surprising. Each documents behavior a user could misread.
// ---------------------------------------------------------------------------------------

const acct = (p: Partial<Account> & Pick<Account, 'id' | 'kind' | 'openingBalance'>): Account => ({
  name: p.id,
  openedOn: '2026-09-01',
  order: 0,
  ...p,
});
const env = (id: string, group = 'Daily', extra: Partial<Envelope> = {}): Envelope => ({ id, name: id, group, order: 0, ...extra });
let seq = 0;
const al = (envelopeId: string, amount: number, date: string, createdAt = new Date(date).getTime()): Allocation => ({
  id: `al${seq++}`,
  envelopeId,
  amount,
  date,
  createdAt,
});
const tx = (p: Partial<Transaction> & Pick<Transaction, 'accountId' | 'amount' | 'kind' | 'date'>): Transaction => ({
  id: `t${seq++}`,
  payee: 'x',
  cleared: false,
  createdAt: 0,
  ...p,
});

describe('pins: correct but surprising', () => {
  it('an overspent envelope quietly un-funds the others; the health check never shouts', () => {
    // $1,000 in, Rent $800 and Food $200 assigned, Food overspent by $500 in cash.
    const input: Input = {
      accounts: [acct({ id: 'chk', kind: 'checking', openingBalance: 100000 })],
      envelopes: [env('rent'), env('food')],
      allocations: [al('rent', 80000, '2026-11-01'), al('food', 20000, '2026-11-01')],
      transactions: [tx({ accountId: 'chk', amount: -70000, kind: 'spend', envelopeId: 'food', date: '2026-11-03' })],
    };
    const l = computeLedger(input);
    expect(l.cashTotal).toBe(30000);
    expect(l.available.get('rent')).toBe(80000); // Rent still says $800...
    expect(l.readyToAssign).toBe(0);
    // ...with only $300 in the bank, and nothing flags it: the -$500 nets it out.
    expect(budgetHealth(l).short).toBe(0);
    // And the minus carries into December untouched (YNAB would reset it and hit RTA).
    const dec = computeMonth(input, '2026-12');
    expect(dec.envelopes.get('food')!.carriedIn).toBe(-50000);
    expect(dec.readyToAssign).toBe(0);
  });

  it('card overspending leaves the payment envelope looking fully funded', () => {
    // Food has $100; a $300 slip. The card envelope says $300 is set aside, but only $100 was.
    const input: Input = {
      accounts: [acct({ id: 'chk', kind: 'checking', openingBalance: 10000 }), acct({ id: 'visa', kind: 'credit_card', openingBalance: 0 })],
      envelopes: [env('food'), env('vpay', 'Debt payments', { debtAccountId: 'visa' })],
      allocations: [al('food', 10000, '2026-11-01')],
      transactions: [tx({ accountId: 'visa', amount: -30000, kind: 'slip', envelopeId: 'food', date: '2026-11-03' })],
    };
    const l = computeLedger(input);
    expect(l.available.get('vpay')).toBe(30000);
    expect(l.available.get('food')).toBe(-20000);
    expect(l.cashTotal).toBe(10000);
    expect(budgetHealth(l).short).toBe(0);
  });

  it('opening a savings account makes existing Savings envelopes "short" and spending jumps', () => {
    const base: Input = {
      accounts: [acct({ id: 'chk', kind: 'checking', openingBalance: 100000 })],
      envelopes: [env('food'), env('emerg', 'Savings')],
      allocations: [al('food', 20000, '2026-09-02'), al('emerg', 50000, '2026-09-02')],
      transactions: [],
    };
    expect(computeMonth(base, '2026-10').pools).toBeNull();
    const opened: Input = { ...base, accounts: [...base.accounts, acct({ id: 'sav', kind: 'savings', openingBalance: 0, openedOn: '2026-10-10' })] };
    const oct = computeMonth(opened, '2026-10');
    expect(oct.pools!.savings.readyToAssign).toBe(-50000);
    expect(oct.pools!.spending.readyToAssign).toBe(80000); // was 30000 total a moment ago
  });

  it('spending from a Savings envelope, or paying a card from savings, moves RTA between pools', () => {
    const input: Input = {
      accounts: [
        acct({ id: 'chk', kind: 'checking', openingBalance: 100000 }),
        acct({ id: 'sav', kind: 'savings', openingBalance: 50000 }),
        acct({ id: 'visa', kind: 'credit_card', openingBalance: 0 }),
      ],
      envelopes: [env('emerg', 'Savings'), env('vpay', 'Debt payments', { debtAccountId: 'visa' })],
      allocations: [al('emerg', 50000, '2026-11-01')],
      transactions: [tx({ accountId: 'visa', amount: -20000, kind: 'slip', envelopeId: 'emerg', date: '2026-11-02' })],
    };
    const nov = computeMonth(input, '2026-11');
    // No money moved, yet savings shows $200 free and spending $200 less.
    expect(nov.pools!.savings.readyToAssign).toBe(20000);
    expect(nov.pools!.spending.readyToAssign).toBe(100000 - 20000);
  });

  it('a cash advance (card to checking) lands in Ready to assign with nothing set aside to repay it', () => {
    const input: Input = {
      accounts: [acct({ id: 'chk', kind: 'checking', openingBalance: 0 }), acct({ id: 'visa', kind: 'credit_card', openingBalance: 0 })],
      envelopes: [env('vpay', 'Debt payments', { debtAccountId: 'visa' })],
      allocations: [],
      transactions: [
        tx({ accountId: 'visa', amount: -50000, kind: 'transfer', transferAccountId: 'chk', transferPairId: 'p', date: '2026-11-02' }),
        tx({ accountId: 'chk', amount: 50000, kind: 'transfer', transferAccountId: 'visa', transferPairId: 'p', date: '2026-11-02' }),
      ],
    };
    const l = computeLedger(input);
    expect(l.readyToAssign).toBe(50000);
    expect(l.available.get('vpay')).toBe(0);
    expect(l.debtTotal).toBe(50000);
  });

  it('interest never reaches the payment envelope, so paying the statement drives it negative', () => {
    const input: Input = {
      accounts: [acct({ id: 'chk', kind: 'checking', openingBalance: 100000 }), acct({ id: 'visa', kind: 'credit_card', openingBalance: 0 })],
      envelopes: [env('food'), env('vpay', 'Debt payments', { debtAccountId: 'visa' })],
      allocations: [al('food', 10000, '2026-11-01')],
      transactions: [
        tx({ accountId: 'visa', amount: -10000, kind: 'slip', envelopeId: 'food', date: '2026-11-02' }),
        tx({ accountId: 'visa', amount: -250, kind: 'interest', date: '2026-11-20' }),
        tx({ accountId: 'chk', amount: -10250, kind: 'transfer', envelopeId: 'vpay', transferAccountId: 'visa', transferPairId: 'p', date: '2026-11-25' }),
        tx({ accountId: 'visa', amount: 10250, kind: 'transfer', transferAccountId: 'chk', transferPairId: 'p', date: '2026-11-25' }),
      ],
    };
    expect(computeLedger(input).available.get('vpay')).toBe(-250);
  });

  it('assigning into a past month rewrites that month’s Ready to assign after the fact', () => {
    const input: Input = {
      accounts: [acct({ id: 'chk', kind: 'checking', openingBalance: 0 })],
      envelopes: [env('food')],
      allocations: [al('food', 30000, '2026-09-30', new Date(2026, 10, 14).getTime())],
      transactions: [tx({ accountId: 'chk', amount: 30000, kind: 'income', date: '2026-11-01' })],
    };
    // September now shows -$300 to assign: the money came from November's paycheck.
    expect(computeMonth(input, '2026-09').readyToAssign).toBe(-30000);
    checkRollover(input, ['2026-09', '2026-10', '2026-11']);
  });

  it('a closed savings account with money in it still counts as cash, but the pools disappear', () => {
    const input: Input = {
      accounts: [
        acct({ id: 'chk', kind: 'checking', openingBalance: 10000 }),
        acct({ id: 'sav', kind: 'savings', openingBalance: 40000, closed: true }),
      ],
      envelopes: [env('emerg', 'Savings')],
      allocations: [],
      transactions: [],
    };
    const nov = computeMonth(input, '2026-11');
    expect(nov.cash).toBe(50000);
    expect(nov.pools).toBeNull();
    // Closing it today also erases the split from every past month it was open.
    expect(computeMonth(input, '2026-09').pools).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------
// Bugs: each of these fails today.
// ---------------------------------------------------------------------------------------

describe('bugs', () => {
  // Today is 2026-11-14 in these fixtures.
  const assignedAheadInput: Input = {
    accounts: [acct({ id: 'chk', kind: 'checking', openingBalance: 100000, openedOn: '2026-10-01' })],
    envelopes: [env('rent'), env('food')],
    allocations: [
      al('food', 10000, '2026-11-02'),
      // Budgeting ahead on Nov 10: December's rent and food.
      al('rent', 30000, '2026-12-01', new Date(2026, 10, 10).getTime()),
      al('food', 20000, '2026-12-01', new Date(2026, 10, 10).getTime()),
    ],
    transactions: [tx({ accountId: 'chk', amount: -15000, kind: 'spend', envelopeId: 'food', date: '2026-11-08' })],
  };

  /*
   * BUG 1: src/domain/ledger.ts:56 adds EVERY allocation to `available`, including money
   * assigned to later months. computeMonth (months.ts:115) keeps that money out of this
   * month. Screens that read `ledger.available` (quick-add and edit-transaction envelope
   * pickers via use-entry-options.ts:30 and edit-transaction.tsx:68, envelope-settings,
   * edit-recurring, transfer.tsx:29) show December's rent as "$300 left" today, while the
   * Budget tab shows $0. Spending it in November silently overspends the envelope.
   */
  it('the envelope balance shown in pickers (ledger) leaves out money assigned to later months', () => {
    const l = computeLedger({ ...assignedAheadInput, asOf: '2026-11-14' });
    const nov = computeMonth(assignedAheadInput, '2026-11');
    expect(nov.envelopes.get('rent')!.available).toBe(0);
    expect(l.available.get('rent')).toBe(nov.envelopes.get('rent')!.available);
  });

  /*
   * Same root cause: overspentEnvelopes (ledger.ts:110) misses Food, which is $50 overspent
   * this month, because next month's $200 masks it.
   */
  it('an envelope overspent this month is reported overspent even with money assigned ahead', () => {
    const l = computeLedger({ ...assignedAheadInput, asOf: '2026-11-14' });
    expect(computeMonth(assignedAheadInput, '2026-11').envelopes.get('food')!.available).toBe(-5000);
    expect(overspentEnvelopes(l, assignedAheadInput.envelopes).map((e) => e.id)).toContain('food');
  });

  /*
   * BUG 2: computeLedger counts transactions dated after this month; computeMonth doesn't.
   * Reachable: the desktop register's date dropdown (src/desktop/edit-row.tsx:59) offers
   * up to 30 days AFTER the transaction's date with no cap at today. Then Home's Ready to
   * assign (screens/home.tsx:236 and desktop/home.tsx:67 use ledger.readyToAssign) differs
   * from the Budget tab's (computeMonth). Fix: give computeLedger an as-of date (or month)
   * and ignore later transactions, and cap the edit-row dates at today.
   */
  it('Home and Budget show the same Ready to assign when a transaction is dated next month', () => {
    const input: Input = {
      accounts: [acct({ id: 'chk', kind: 'checking', openingBalance: 100000, openedOn: '2026-10-01' })],
      envelopes: [env('food')],
      allocations: [],
      transactions: [tx({ accountId: 'chk', amount: 50000, kind: 'income', date: '2026-12-03' })],
    };
    const home = computeLedger({ ...input, asOf: '2026-11-14' }).readyToAssign;
    const budget = computeMonth(input, '2026-11').readyToAssign;
    expect(home).toBe(budget);
  });

  /*
   * BUG 3: computeMonth (months.ts:131) adds an account's opening balance only from
   * `openedOn`, but adds its transactions from any date (months.ts:148). balanceHistory
   * (history.ts:35) skips those same transactions. Reachable: add an account today, then
   * log a purchase from last month (addTransaction never checks openedOn, though
   * edit-account.tsx:56 says the starting balance comes before everything). October then
   * shows the account at -$45 in the budget and $0 on the balance chart. Fix: treat the
   * account as open from min(openedOn, earliest transaction) in both, or clamp the date.
   */
  it('budget cash and the balance chart agree for a month with a transaction dated before the account opened', () => {
    const input: Input = {
      accounts: [
        acct({ id: 'a', kind: 'checking', openingBalance: 100000, openedOn: '2026-09-01' }),
        acct({ id: 'b', kind: 'checking', openingBalance: 50000, openedOn: '2026-11-02' }),
      ],
      envelopes: [env('food')],
      allocations: [],
      transactions: [tx({ accountId: 'b', amount: -4500, kind: 'spend', envelopeId: 'food', date: '2026-10-28' })],
    };
    const oct = computeMonth(input, '2026-10');
    const chart = balanceHistory(input, 3, '2026-11-14').find((p) => p.month === '2026-10')!;
    expect(oct.cash).toBe(chart.cash);
  });

  /*
   * BUG 4: assignedAhead (months.ts:223) lists every later month that has any allocation,
   * even one that nets to $0 after money was moved back. Home's note
   * (home-cards.tsx:140) then says "$100 assigned ahead to Dec–Jan" when January has $0.
   */
  it('"assigned ahead" names only months that still hold money', () => {
    const allocations = [al('fun', 10000, '2026-12-01'), al('fun', 5000, '2027-01-01'), al('fun', -5000, '2027-01-01')];
    expect(assignedAhead(allocations, '2026-11')).toEqual({ total: 10000, months: ['2026-12'] });
  });

  /*
   * BUG 5 (copy): desktop/budget.tsx:331 shows the "short" banner when
   * floorDollars(readyToAssign) < 0, which is true for a 1-cent shortfall, but line 349
   * prints formatDollars(-readyToAssign), which rounds down to "$0". The banner then reads
   * "Spending is $0 short this month." Use formatDollars(-rta, 'up') (as moveToCover does).
   */
  it('a pool flagged short never says it is $0 short', () => {
    const rta = -1;
    const showsBanner = floorDollars(rta) < 0;
    const text = formatDollars(-rta, 'up'); // as desktop/budget.tsx now prints it
    expect(showsBanner).toBe(true);
    expect(text).not.toBe('$0');
  });
});

// Sanity: the helpers above agree with the module's own definitions.
describe('audit helpers', () => {
  it('counts only cash accounts as cash', () => {
    expect(isCashAccount({ kind: 'savings' })).toBe(true);
    expect(isCashAccount({ kind: 'credit_card' })).toBe(false);
    expect(addMonthKey('2026-12', 1)).toBe('2027-01');
  });
});
