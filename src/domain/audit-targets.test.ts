import { beforeEach, describe, expect, it } from '@jest/globals';

import { resetStore, useStore } from '@/store';

import { computeMonth, targetGaps, type MonthKey } from './months';
import { targetFor, targetNeed, targetThisMonth } from './targets';
import type { Account, Allocation, Envelope, Transaction } from './types';

/*
 * Audit of envelope targets end to end: what Auto-assign asks for (targetGaps), month by
 * month, for every target kind. Tests marked BUG fail today and assert the right answer.
 */

const checking: Account = { id: 'chk', name: 'Checking', kind: 'checking', openingBalance: 5_000_000, openedOn: '2026-01-01', order: 0 };
let n = 0;
const income = (date: string, amount: number): Transaction => ({
  id: `i${n++}`,
  date,
  accountId: 'chk',
  amount,
  kind: 'income',
  payee: 'Paycheck',
  cleared: true,
  createdAt: 1,
});
const spend = (date: string, envelopeId: string, amount: number): Transaction => ({
  id: `s${n++}`,
  date,
  accountId: 'chk',
  amount: -amount,
  kind: 'spend',
  payee: 'Store',
  envelopeId,
  cleared: true,
  createdAt: 1,
});
const assign = (date: string, envelopeId: string, amount: number): Allocation => ({
  id: `a${n++}`,
  date,
  envelopeId,
  amount,
  createdAt: 1,
});

function gapFor(
  envelope: Envelope,
  month: MonthKey,
  transactions: Transaction[] = [],
  allocations: Allocation[] = [],
): number {
  const budget = computeMonth({ accounts: [checking], envelopes: [envelope], transactions, allocations }, month);
  return targetGaps([envelope], budget).find((g) => g.envelopeId === envelope.id)?.need ?? 0;
}

beforeEach(() => resetStore());

// ---------------------------------------------------------------------------------------
// BUG: the target kind is one field for the whole envelope, but the amounts are per month.
// Changing the kind re-reads every other month's amount in the new unit.
// ---------------------------------------------------------------------------------------
describe('BUG: changing the target kind re-reads amounts stored in the old unit', () => {
  it('switching Maximum $400 to 10% of income in November does not turn a planned December $500 into 500% of income', () => {
    const s = useStore.getState();
    const id = s.addEnvelope({ name: 'Taxes', group: 'Daily', monthlyTarget: 40000, month: '2026-09' });
    // Planned ahead earlier: December's Maximum is $500.
    useStore.getState().setTarget(id, '2026-12', 50000);
    // Exactly what Edit envelope's Save does in November: kind first, then the amount.
    useStore.getState().updateEnvelope(id, { targetKind: 'percent' });
    useStore.getState().setTarget(id, '2026-11', 1000);
    const e = useStore.getState().envelopes.find((x) => x.id === id)!;

    // December income $5,000. The user's last word was "10% of income from November on",
    // so December should ask $500. Today the old $500 Maximum entry (50000) is read as
    // 500%, and Auto-assign asks for $25,000.
    const need = gapFor(e, '2026-12', [income('2026-12-05', 500000)]);
    expect(need).toBe(50000);
  });

  it('switching Maximum $400 to 10% of income does not bill the old Maximum months as 400% of their income', () => {
    const e: Envelope = {
      id: 'tax',
      name: 'Taxes',
      group: 'Daily',
      order: 0,
      // What the store holds after the switch: $400 Maximum from September, 10% from November.
      targetKind: 'percent',
      targetKinds: { '2026-09': 'spending', '2026-11': 'percent' },
      targets: { '2026-09': 40000, '2026-11': 1000 },
    };
    const tx = [
      income('2026-09-01', 500000),
      income('2026-10-01', 500000),
      income('2026-11-01', 500000),
      spend('2026-09-20', 'tax', 40000),
      spend('2026-10-20', 'tax', 40000),
    ];
    const al = [assign('2026-09-01', 'tax', 40000), assign('2026-10-01', 'tax', 40000)];
    // September and October were Maximum months, fully funded. November owes 10% of
    // November's $5,000 = $500. Today the percent carry reads 40000 as 400% for September
    // and October (4 × $5,000 each, minus $800 assigned) and asks for $39,700.
    expect(gapFor(e, '2026-11', tx, al)).toBe(50000);
  });

  it('looking back at October after the switch still shows the $400 Maximum it had', () => {
    const e: Envelope = {
      id: 'tax',
      name: 'Taxes',
      group: 'Daily',
      order: 0,
      targetKind: 'percent',
      targetKinds: { '2026-09': 'spending', '2026-11': 'percent' },
      targets: { '2026-09': 40000, '2026-11': 1000 },
    };
    // October had a $400 Maximum and nothing assigned: it needed $400. Today it reads as
    // 400% of October's $5,000 income and asks $20,000 (the kind needs to be per month,
    // stored with each `targets` entry).
    expect(gapFor(e, '2026-10', [income('2026-10-01', 500000)])).toBe(40000);
  });
});

// ---------------------------------------------------------------------------------------
// Repeating builder: a $2,003 yearly bill due December 2026.
// ---------------------------------------------------------------------------------------
describe('repeating builder across its due month and the next cycle', () => {
  const insurance: Envelope = {
    id: 'ins',
    name: 'Progressive',
    group: 'Bills',
    order: 0,
    recurringId: 'r1',
    targetKind: 'repeat',
    targetDate: '2026-12',
    targetEvery: 12,
    targets: { '2026-01': 200300 },
  };
  // Saved in full during the year.
  const saved = [assign('2026-01-15', 'ins', 200300)];

  it('asks nothing in December when it is already saved, even after the bill posts', () => {
    expect(gapFor(insurance, '2026-12', [spend('2026-12-03', 'ins', 200300)], saved)).toBe(0);
  });

  it('asks the rest in the due month when it is short', () => {
    expect(gapFor(insurance, '2026-12', [], [assign('2026-01-15', 'ins', 150000)])).toBe(50300);
  });

  it('paid in December: January starts the next year at $167, and 12 × $167 covers $2,003', () => {
    const tx = [spend('2026-12-03', 'ins', 200300)];
    expect(gapFor(insurance, '2027-01', tx, saved)).toBe(16700);
    expect(12 * 16700).toBeGreaterThanOrEqual(200300);
  });

  it('a bill that came in under the target leaves the extra toward next year', () => {
    // Paid $1,900 of the $2,003 saved: $103 carries in, $1,900 left over 12 months = $158.34 → $159.
    expect(gapFor(insurance, '2027-01', [spend('2026-12-03', 'ins', 190000)], saved)).toBe(15900);
  });

  it('a bill that posts a few days early (Nov 30 for a Dec 3 due date) does not make December ask for all $2,003 again', () => {
    // Autopay or a bank link dates the payment November 30. The December bill is paid;
    // the next one is December 2027, so December 2026 should ask at most a twelfth
    // ($167). Today December still counts as the due month with $0 in the envelope and
    // asks for the full $2,003 a second time.
    const need = gapFor(insurance, '2026-12', [spend('2026-11-30', 'ins', 200300)], saved);
    expect(need).toBeLessThanOrEqual(16700);
  });

  it('a bill that posts late (Jan 2) leaves January asking for its twelfth, not $0', () => {
    // January starts the December 2027 cycle with an empty envelope once the late bill
    // posts, so it should ask $2,003 / 12 = $167. Today January counts the $2,003 that
    // carried in (and was then spent) and asks nothing.
    const need = gapFor(insurance, '2027-01', [spend('2027-01-02', 'ins', 200300)], saved);
    expect(need).toBe(16700);
  });

  it('snoozing the due month does not carry the shortfall into the next cycle', () => {
    const snoozed = { ...insurance, snoozed: ['2026-12'] };
    expect(gapFor(snoozed, '2026-12', [], [])).toBe(0);
    // January is a fresh 12-month cycle toward December 2027.
    expect(gapFor(snoozed, '2027-01', [], [])).toBe(16700);
  });
});

// ---------------------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------------------
describe('builder', () => {
  const christmas: Envelope = {
    id: 'xmas',
    name: 'Christmas',
    group: 'Savings',
    order: 0,
    targetKind: 'builder',
    targetDate: '2026-12',
    targets: { '2026-10': 120000 },
  };

  it('spreads over the months through its date, using what carried in', () => {
    expect(gapFor(christmas, '2026-10')).toBe(40000);
    expect(gapFor(christmas, '2026-11', [], [assign('2026-10-01', 'xmas', 40000)])).toBe(40000);
    // Short in October: November makes it up over the two months left.
    expect(gapFor(christmas, '2026-11', [], [assign('2026-10-01', 'xmas', 10000)])).toBe(55000);
  });

  it('asks nothing after its date, reached or not', () => {
    expect(gapFor(christmas, '2027-01', [], [assign('2026-10-01', 'xmas', 30000)])).toBe(0);
  });

  it('raising the amount mid-way re-spreads what is left', () => {
    const raised = { ...christmas, targets: { '2026-10': 120000, '2026-11': 180000 } };
    // $400 in from October, $1,400 left over November and December.
    expect(gapFor(raised, '2026-11', [], [assign('2026-10-01', 'xmas', 40000)])).toBe(70000);
  });

  it('a snoozed month is made up over the months that are left', () => {
    const snoozed = { ...christmas, snoozed: ['2026-10'] };
    expect(gapFor(snoozed, '2026-10')).toBe(0);
    expect(gapFor(snoozed, '2026-11')).toBe(60000);
  });

  it('money spent from it before the date is asked for again next month', () => {
    const al = [assign('2026-10-01', 'xmas', 40000), assign('2026-11-01', 'xmas', 40000)];
    // Spent $300 in November: December starts with $500 and needs $700.
    expect(gapFor(christmas, '2026-12', [spend('2026-11-20', 'xmas', 30000)], al)).toBe(70000);
  });
});

// ---------------------------------------------------------------------------------------
// The simpler kinds, across months.
// ---------------------------------------------------------------------------------------
describe('Maximum, Save each month, Bank, Weekly across months', () => {
  const groceries: Envelope = { id: 'g', name: 'Groceries', group: 'Daily', order: 0, targets: { '2026-10': 40000 } };

  it('Maximum counts money carried in and covers last month’s overspending', () => {
    expect(gapFor(groceries, '2026-11', [], [assign('2026-10-01', 'g', 50000)])).toBe(0);
    // Overspent October by $50: the -$50 carries in, so November needs $450 to have $400.
    const tx = [spend('2026-10-20', 'g', 45000)];
    expect(gapFor(groceries, '2026-11', tx, [assign('2026-10-01', 'g', 40000)])).toBe(45000);
  });

  it('a target set in November does not apply to October', () => {
    const later = { ...groceries, targets: { '2026-11': 40000 } };
    expect(gapFor(later, '2026-10')).toBe(0);
    expect(gapFor(later, '2026-11')).toBe(40000);
  });

  it('Save each month in Savings ignores what carried in', () => {
    const vacation: Envelope = { id: 'v', name: 'Vacation', group: 'Savings', order: 0, targets: { '2026-10': 20000 } };
    expect(gapFor(vacation, '2026-11', [], [assign('2026-10-01', 'v', 90000)])).toBe(20000);
  });

  it('the default kind follows the group: Savings saves each month, Daily is a Maximum', () => {
    const al = [assign('2026-10-01', 'x', 40000)];
    const daily: Envelope = { id: 'x', name: 'X', group: 'Daily', order: 0, targets: { '2026-10': 40000 } };
    expect(gapFor(daily, '2026-11', [], al)).toBe(0);
    expect(gapFor({ ...daily, group: 'Savings' }, '2026-11', [], al)).toBe(40000);
  });

  it('Bank refills what was spent, and counts overspending', () => {
    const buffer: Envelope = { id: 'b', name: 'Buffer', group: 'Savings', order: 0, targetKind: 'bank', targets: { '2026-10': 100000 } };
    const al = [assign('2026-10-01', 'b', 100000)];
    expect(gapFor(buffer, '2026-11', [spend('2026-10-15', 'b', 25000)], al)).toBe(25000);
    expect(gapFor(buffer, '2026-10', [spend('2026-10-15', 'b', 125000)], al)).toBe(125000);
  });

  it('targets round up to whole dollars: a $10.10 Maximum asks $11', () => {
    const cents = { ...groceries, targets: { '2026-10': 1010 } };
    expect(targetFor(cents, '2026-10')).toBe(1100);
    expect(gapFor(cents, '2026-10')).toBe(1100);
  });

  it('a few cents short still asks a whole dollar', () => {
    // $12.34 carried in, $387 assigned: $399.34 of $400. Auto-assign adds $1.
    const tx = [spend('2026-09-30', 'g', 0)];
    const al = [assign('2026-09-01', 'g', 1234), assign('2026-10-01', 'g', 38700)];
    expect(gapFor(groceries, '2026-10', tx, al)).toBe(100);
  });

  it('surprising: Weekly rounds each week up before multiplying ($10.10 a week asks $55 in a five-week month, not $51)', () => {
    const coffee: Envelope = { id: 'c', name: 'Coffee', group: 'Daily', order: 0, targetKind: 'weekly', targets: { '2026-11': 1010 } };
    expect(gapFor(coffee, '2026-11')).toBe(5500);
  });
});

describe('percent of income', () => {
  const tithe: Envelope = { id: 't', name: 'Giving', group: 'Daily', order: 0, targetKind: 'percent', targets: { '2026-10': 1000 } };

  it('10% of $4,215.50 is $421.55, asked as $422', () => {
    expect(gapFor(tithe, '2026-10', [income('2026-10-01', 421550)])).toBe(42200);
  });

  it('asks nothing in a month with no income yet', () => {
    expect(gapFor(tithe, '2026-10')).toBe(0);
  });

  it('the settings preview ("This month") matches what Auto-assign asks before anything is assigned', () => {
    const budget = computeMonth({ accounts: [checking], envelopes: [tithe], transactions: [income('2026-10-01', 421550)], allocations: [] }, '2026-10');
    const row = budget.envelopes.get('t')!;
    expect(targetThisMonth(tithe, 1000, row, '2026-10')).toBe(targetNeed(tithe, 1000, row, '2026-10'));
  });
});

describe('debt payment envelopes', () => {
  const visa: Envelope = { id: 'd', name: 'Visa', group: 'Debt payments', order: 0, debtAccountId: 'visa' };

  it('want the full payment every month, whatever carried in', () => {
    const budget = computeMonth(
      { accounts: [checking], envelopes: [visa], transactions: [], allocations: [assign('2026-10-01', 'd', 50000)] },
      '2026-11',
    );
    expect(targetGaps([visa], budget, new Map([['d', 3600]]))).toEqual([{ envelopeId: 'd', need: 3600 }]);
  });

  it('are left out without a debt target', () => {
    const budget = computeMonth({ accounts: [checking], envelopes: [visa], transactions: [], allocations: [] }, '2026-11');
    expect(targetGaps([visa], budget)).toEqual([]);
  });
});
