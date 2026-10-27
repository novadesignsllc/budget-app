import { describe, expect, it } from '@jest/globals';

import { computeLedger } from './ledger';
import { addMonthKey, assignDateFor, canGoToMonth, computeMonth, formatMonth, monthEnd, targetGaps } from './months';
import type { Account, Allocation, Envelope, Transaction } from './types';

const checking: Account = { id: 'chk', name: 'Checking', kind: 'checking', openingBalance: 100000, openedOn: '2026-09-01', order: 0 };
const visa: Account = { id: 'visa', name: 'Visa', kind: 'credit_card', openingBalance: -50000, openedOn: '2026-09-01', order: 1 };
const envelopes: Envelope[] = [
  { id: 'groc', name: 'Groceries', group: 'Daily', order: 0, monthlyTarget: 40000 },
  { id: 'save', name: 'Emergency', group: 'Savings', order: 1, monthlyTarget: 10000 },
  { id: 'vpay', name: 'Visa', group: 'Debt payments', order: 2, debtAccountId: 'visa' },
];
let n = 0;
const al = (envelopeId: string, amount: number, date: string): Allocation => ({ id: `a${n++}`, envelopeId, amount, date, createdAt: n });
const tx = (p: Partial<Transaction> & Pick<Transaction, 'accountId' | 'amount' | 'kind' | 'date'>): Transaction => ({
  id: `t${n++}`, payee: 'x', cleared: false, createdAt: n, ...p,
});

const input = {
  accounts: [checking, visa],
  envelopes,
  allocations: [al('groc', 40000, '2026-09-02'), al('save', 10000, '2026-09-02'), al('groc', 40000, '2026-10-01')],
  transactions: [
    tx({ accountId: 'chk', amount: -30000, kind: 'spend', envelopeId: 'groc', date: '2026-09-20' }),
    tx({ accountId: 'chk', amount: 200000, kind: 'income', date: '2026-10-01' }),
    tx({ accountId: 'chk', amount: -5000, kind: 'spend', envelopeId: 'groc', date: '2026-10-05' }),
    tx({ accountId: 'visa', amount: -2000, kind: 'slip', envelopeId: 'groc', date: '2026-10-06' }),
  ],
};

describe('computeMonth', () => {
  it('shows a past month as it stood at its end', () => {
    const sep = computeMonth(input, '2026-09');
    expect(sep.envelopes.get('groc')).toMatchObject({ assigned: 40000, spent: 30000, carriedIn: 0, available: 10000 });
    expect(sep.cash).toBe(70000);
    // October's grocery money was assigned later, so September's pool excludes it.
    expect(sep.readyToAssign).toBe(70000 - 10000 - 10000 - 40000);
  });

  it('carries leftovers into the next month', () => {
    const oct = computeMonth(input, '2026-10');
    expect(oct.envelopes.get('groc')).toMatchObject({ carriedIn: 10000, assigned: 40000, spent: 7000, available: 43000 });
    // A slip moves cash into the card's payment envelope; that's not spending.
    expect(oct.envelopes.get('vpay')).toMatchObject({ activity: 2000, spent: 0, available: 2000 });
  });

  it('matches the all-time ledger for the latest month', () => {
    const oct = computeMonth(input, '2026-10');
    const all = computeLedger(input);
    expect(oct.readyToAssign).toBe(all.readyToAssign);
    expect(oct.cash).toBe(all.cashTotal);
  });

  it('keeps the core rule in every month', () => {
    for (const m of ['2026-08', '2026-09', '2026-10', '2026-11']) {
      const b = computeMonth(input, m);
      let sum = 0;
      for (const r of b.envelopes.values()) sum += r.available;
      const later = input.allocations.filter((a) => a.date > monthEnd(m)).reduce((s, a) => s + a.amount, 0);
      expect(b.readyToAssign + sum + later).toBe(b.cash);
    }
  });

  it('lists what each envelope still needs to reach its target', () => {
    const nov = computeMonth(input, '2026-11');
    // Groceries is a spending limit: the $430 left over already covers November's $400.
    // Emergency is a goal: it wants its $100 every month.
    expect(targetGaps(envelopes, nov)).toEqual([{ envelopeId: 'save', need: 10000 }]);
    // As a goal, groceries would want its full $400 again.
    const asGoal = envelopes.map((e) => (e.id === 'groc' ? { ...e, targetKind: 'goal' as const } : e));
    expect(targetGaps(asGoal, computeMonth({ ...input, envelopes: asGoal }, '2026-11'))).toEqual([
      { envelopeId: 'groc', need: 40000 },
      { envelopeId: 'save', need: 10000 },
    ]);
    expect(targetGaps(envelopes, computeMonth(input, '2026-10'))).toEqual([{ envelopeId: 'save', need: 10000 }]);
  });
});

describe('looking back', () => {
  it('ignores assignments that were made after the month ended', () => {
    const later = al('groc', 40000, '2026-11-01');
    later.createdAt = new Date(2026, 10, 1).getTime();
    const sep = computeMonth({ ...input, allocations: [...input.allocations, later] }, '2026-09');
    expect(sep.readyToAssign).toBe(computeMonth(input, '2026-09').readyToAssign);
  });
});

describe('targets by month', () => {
  it('uses the target in effect for the month being looked at', () => {
    const changed = envelopes.map((e) => (e.id === 'groc' ? { ...e, targets: { '2026-11': 45000 } } : e));
    // October still reads the old target and is already filled.
    expect(targetGaps(changed, computeMonth({ ...input, envelopes: changed }, '2026-10'))).toEqual([
      { envelopeId: 'save', need: 10000 },
    ]);
    // November's limit is $450 and $430 carried in, so it only needs $20.
    expect(targetGaps(changed, computeMonth({ ...input, envelopes: changed }, '2026-11'))[0]).toEqual({
      envelopeId: 'groc',
      need: 2000,
    });
  });
});

describe('month helpers', () => {
  it('goes back any distance and up to a year ahead', () => {
    expect(canGoToMonth('2026-10', '2026-10-23')).toBe(true);
    expect(canGoToMonth('2020-01', '2026-10-23')).toBe(true);
    expect(canGoToMonth('2026-11', '2026-10-23')).toBe(true);
    expect(canGoToMonth('2027-11', '2026-10-23')).toBe(false);
  });

  it('steps across years', () => {
    expect(addMonthKey('2026-12', 1)).toBe('2027-01');
    expect(addMonthKey('2026-01', -1)).toBe('2025-12');
    expect(monthEnd('2028-02')).toBe('2028-02-29');
  });
  it('dates an assignment for the month being viewed', () => {
    expect(assignDateFor('2026-10', '2026-10-23')).toBe('2026-10-23');
    expect(assignDateFor('2026-09', '2026-10-23')).toBe('2026-09-30');
    expect(assignDateFor('2026-11', '2026-10-23')).toBe('2026-11-01');
  });
  it('names months, adding the year when it differs', () => {
    expect(formatMonth('2026-10', 2026)).toBe('October');
    expect(formatMonth('2025-10', 2026)).toBe('October 2025');
  });
});

describe('spending and savings pools', () => {
  const savings: Account = { id: 'sav', name: 'Savings', kind: 'savings', openingBalance: 30000, openedOn: '2026-09-01', order: 2 };
  const split = { ...input, accounts: [checking, visa, savings] };

  it('stays one pool until there is a savings account', () => {
    expect(computeMonth(input, '2026-10').pools).toBeNull();
  });

  it('splits Ready to assign by account and envelope, and the halves add up', () => {
    const oct = computeMonth(split, '2026-10');
    const pools = oct.pools!;
    // Savings: $300 in the account minus the $100 in Emergency.
    expect(pools.savings).toEqual({ cash: 30000, readyToAssign: 20000 });
    expect(pools.spending.cash).toBe(oct.cash - 30000);
    expect(pools.spending.readyToAssign + pools.savings.readyToAssign).toBe(oct.readyToAssign);
  });

  it('moves money between the pools when you transfer checking to savings', () => {
    const moved = {
      ...split,
      transactions: [
        ...split.transactions,
        tx({ accountId: 'chk', amount: -50000, kind: 'transfer', transferAccountId: 'sav', date: '2026-10-07' }),
        tx({ accountId: 'sav', amount: 50000, kind: 'transfer', transferAccountId: 'chk', date: '2026-10-07' }),
      ],
    };
    const before = computeMonth(split, '2026-10').pools!;
    const after = computeMonth(moved, '2026-10').pools!;
    expect(after.savings.readyToAssign - before.savings.readyToAssign).toBe(50000);
    expect(after.spending.readyToAssign - before.spending.readyToAssign).toBe(-50000);
  });

  it('shows savings short when spending envelopes are paid from savings', () => {
    const fromSavings = {
      ...split,
      transactions: [...split.transactions, tx({ accountId: 'sav', amount: -25000, kind: 'spend', envelopeId: 'groc', date: '2026-10-08' })],
    };
    const pools = computeMonth(fromSavings, '2026-10').pools!;
    expect(pools.savings.readyToAssign).toBe(20000 - 25000);
  });
});

describe('assigning months ahead', () => {
  // Assigned in October (createdAt), for November and December.
  const madeInOctober = new Date(2026, 9, 10).getTime();
  const ahead = (envelopeId: string, amount: number, date: string): Allocation => ({
    ...al(envelopeId, amount, date),
    createdAt: madeInOctober,
  });
  const planned = {
    ...input,
    allocations: [...input.allocations, ahead('groc', 15000, '2026-11-01'), ahead('save', 5000, '2026-12-01')],
  };

  it('takes money assigned ahead out of this month, so it can’t be spent twice', () => {
    const now = computeMonth(input, '2026-10');
    const withPlan = computeMonth(planned, '2026-10');
    expect(withPlan.readyToAssign).toBe(now.readyToAssign - 20000);
    // This month's envelopes don't change: the money isn't theirs until its month.
    expect(withPlan.envelopes.get('groc')).toEqual(now.envelopes.get('groc'));
  });

  it('shows it in the month it was assigned to, on top of what carries over', () => {
    const oct = computeMonth(planned, '2026-10');
    const nov = computeMonth(planned, '2026-11');
    expect(nov.envelopes.get('groc')).toMatchObject({ carriedIn: oct.envelopes.get('groc')!.available, assigned: 15000, spent: 0 });
    // Nothing new comes in by November, so Ready to assign is the same as October's.
    expect(nov.readyToAssign).toBe(oct.readyToAssign);
    expect(computeMonth(planned, '2026-12').envelopes.get('save')!.assigned).toBe(5000);
  });

  it('keeps every future month adding up to the cash', () => {
    for (const m of ['2026-10', '2026-11', '2026-12', '2027-01']) {
      const b = computeMonth(planned, m);
      const sum = [...b.envelopes.values()].reduce((s, r) => s + r.available, 0);
      const later = planned.allocations
        .filter((a) => a.date > monthEnd(m) && a.createdAt <= new Date(Number(m.slice(0, 4)), Number(m.slice(5)), 0, 23, 59, 59, 999).getTime())
        .reduce((s, a) => s + a.amount, 0);
      expect(b.readyToAssign + sum + later).toBe(b.cash);
    }
  });

  it('takes savings assigned ahead out of the savings side only', () => {
    const savings: Account = { id: 'sav', name: 'Savings', kind: 'savings', openingBalance: 30000, openedOn: '2026-09-01', order: 2 };
    const before = computeMonth({ ...input, accounts: [checking, visa, savings] }, '2026-10').pools!;
    const after = computeMonth({ ...planned, accounts: [checking, visa, savings] }, '2026-10').pools!;
    expect(after.savings.readyToAssign).toBe(before.savings.readyToAssign - 5000);
    expect(after.spending.readyToAssign).toBe(before.spending.readyToAssign - 15000);
  });

  it('lets you go a year ahead, not further', () => {
    expect(canGoToMonth('2027-10', '2026-10-27')).toBe(true);
    expect(canGoToMonth('2027-11', '2026-10-27')).toBe(false);
  });
});
