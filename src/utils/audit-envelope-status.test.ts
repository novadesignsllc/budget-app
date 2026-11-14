import { describe, expect, it } from '@jest/globals';

import { computeMonth, targetGaps, type EnvelopeMonth, type MonthKey } from '@/domain/months';
import type { Account, Allocation, Envelope, Transaction } from '@/domain/types';

import { envelopeStatus, leftPillState, targetBar } from './envelope-status';

/*
 * Audit: the phone's status line and Left pill (envelopeStatus / targetBar) must agree
 * with what Auto-assign asks for (targetGaps). Tests marked BUG fail today.
 */

const MONTH = '2026-11';
const row = (r: Partial<EnvelopeMonth>): EnvelopeMonth => {
  const base = { assigned: 0, activity: 0, spent: 0, carriedIn: 0, ...r };
  return { available: base.carriedIn + base.assigned + base.activity, ...base };
};
const gap = (e: Envelope, r: EnvelopeMonth, month: MonthKey = MONTH, debt?: number) =>
  targetGaps(
    [e],
    { month, envelopes: new Map([[e.id, r]]), cash: 0, readyToAssign: 0, pools: null },
    debt === undefined ? new Map() : new Map([[e.id, debt]]),
  ).find((g) => g.envelopeId === e.id)?.need ?? 0;

const env = (patch: Partial<Envelope>): Envelope => ({ id: 'e', name: 'E', group: 'Daily', order: 0, targets: { '2026-10': 40000 }, ...patch });

describe('status, pill and Auto-assign agree for every kind (whole-dollar amounts)', () => {
  const cases: [string, Envelope, EnvelopeMonth][] = [
    ['Maximum, empty', env({}), row({})],
    ['Maximum, carried in', env({}), row({ carriedIn: 25000 })],
    ['Maximum, full and half spent', env({}), row({ assigned: 40000, activity: -20000, spent: 20000 })],
    ['Save each month, carried in', env({ group: 'Savings' }), row({ carriedIn: 90000, assigned: 5000 })],
    ['Save each month, met', env({ group: 'Savings' }), row({ assigned: 40000 })],
    ['Bank, spent some', env({ targetKind: 'bank' }), row({ carriedIn: 40000, activity: -15000, spent: 15000 })],
    ['Builder, mid-way', env({ targetKind: 'builder', targetDate: '2026-12' }), row({ carriedIn: 10000 })],
    ['Builder, ended short', env({ targetKind: 'builder', targetDate: '2026-10' }), row({ carriedIn: 10000 })],
    ['Repeat, building', env({ targetKind: 'repeat', targetDate: '2027-02', targetEvery: 12 }), row({ carriedIn: 10000 })],
    ['Weekly, five weeks', env({ targetKind: 'weekly', targets: { '2026-10': 10000 } }), row({ carriedIn: 20000 })],
    ['Percent, income in', env({ targetKind: 'percent', targets: { '2026-10': 1000 } }), row({ assigned: 10000, monthIncome: 421550 })],
    ['Snoozed', env({ snoozed: [MONTH] }), row({})],
  ];
  it.each(cases)('%s', (_name, e, r) => {
    const status = envelopeStatus(e, r, MONTH);
    const bar = targetBar(e, r, MONTH);
    expect(status.need).toBe(gap(e, r));
    // Yellow (short) exactly when there is something to fill.
    if (bar) expect(bar.state === 'short').toBe(status.need > 0);
  });
});

describe('BUG: a gap of a few cents', () => {
  it('a Maximum $0.66 short is yellow, since the status line and Auto-assign both ask for $1', () => {
    // $12.34 carried in plus $387 typed in: $399.34 of $400.
    const e = env({});
    const r = row({ carriedIn: 1234, assigned: 38700 });
    const status = envelopeStatus(e, r, MONTH);
    expect(status.subtitle).toBe('Needs $1 this month');
    expect(gap(e, r)).toBe(100);
    // targetBar compares the raw 66¢ to a dollar and calls it funded, so the Left pill is
    // green while the line under the name, the swipe "Fill $1", Home's "1 target needs $1"
    // and Auto-assign all say it's short. It should use the same rounded-up need.
    expect(targetBar(e, r, MONTH)?.state).toBe('short');
    expect(leftPillState(r, targetBar(e, r, MONTH))).toBe('short');
  });

  it('a Bank 50¢ under its amount is yellow, matching "$1 to refill"', () => {
    const e = env({ targetKind: 'bank', targets: { '2026-10': 100000 } });
    const r = row({ carriedIn: 100000, activity: -50, spent: 50 });
    expect(envelopeStatus(e, r, MONTH).subtitle).toBe('$1 to refill to $1,000');
    expect(targetBar(e, r, MONTH)?.state).toBe('short');
  });

  it('a debt payment with a $35.50 minimum and $35 assigned is yellow, matching "Fill $1"', () => {
    const e: Envelope = { id: 'd', name: 'Visa', group: 'Debt payments', order: 0, debtAccountId: 'visa' };
    const r = row({ assigned: 3500 });
    const debt = { owed: 100000, target: 3550 };
    expect(envelopeStatus(e, r, MONTH, debt).need).toBe(100);
    expect(targetBar(e, r, MONTH, debt)?.state).toBe('short');
  });
});

describe('repeating builder status around its due month', () => {
  const checking: Account = { id: 'chk', name: 'Checking', kind: 'checking', openingBalance: 5_000_000, openedOn: '2026-01-01', order: 0 };
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
  const saved: Allocation[] = [{ id: 'a', date: '2026-01-15', envelopeId: 'ins', amount: 200300, createdAt: 1 }];
  const bill = (date: string): Transaction => ({
    id: 'bill',
    date,
    accountId: 'chk',
    amount: -200300,
    kind: 'spend',
    payee: 'Progressive',
    envelopeId: 'ins',
    recurringId: 'r1',
    cleared: true,
    createdAt: 1,
  });
  const at = (month: MonthKey, tx: Transaction[]) =>
    computeMonth({ accounts: [checking], envelopes: [insurance], transactions: tx, allocations: saved }, month).envelopes.get('ins')!;

  it('paid on time: December reads ready, January asks $167 toward December 2027', () => {
    expect(envelopeStatus(insurance, at('2026-12', [bill('2026-12-03')]), '2026-12').subtitle).toBe('$2,003 ready for Dec 2026');
    expect(envelopeStatus(insurance, at('2027-01', [bill('2026-12-03')]), '2027-01').subtitle).toBe(
      '$167 this month toward $2,003 due Dec 2027',
    );
  });

  it('paid late (Jan 2), January does not claim "$2,003 ready for Dec 2027" with $0 in the envelope', () => {
    const r = at('2027-01', [bill('2027-01-02')]);
    expect(r.available).toBe(0);
    // The status counts carried-in money that was then spent on last year's bill.
    expect(envelopeStatus(insurance, r, '2027-01').subtitle).not.toContain('ready');
  });

  it('paid early (Nov 30), December does not ask for the whole $2,003 again', () => {
    const r = at('2026-12', [bill('2026-11-30')]);
    expect(envelopeStatus(insurance, r, '2026-12').need).toBeLessThanOrEqual(16700);
  });
});

describe('Save each month after money was moved out', () => {
  it('the line reads "-$50 of $200", not "+-$50 of $200"', () => {
    const e = env({ group: 'Savings', targets: { '2026-10': 20000 } });
    const r = row({ carriedIn: 30000, assigned: -5000 });
    expect(envelopeStatus(e, r, MONTH).subtitle).not.toContain('+-');
  });
});

describe('BUG: targetBar progress mixes units for Weekly and Percent', () => {
  // Not drawn anywhere today, but it's exported as "how much of the target is in".
  it('Percent 10% with $100 of $422 assigned is about a quarter of the way', () => {
    const e = env({ targetKind: 'percent', targets: { '2026-10': 1000 } });
    const bar = targetBar(e, row({ assigned: 10000, monthIncome: 421550 }), MONTH);
    // have = target(1000, a percent) − need(32200, cents): negative, clamped to 0.
    expect(bar?.progress).toBeCloseTo(10000 / 42200, 2);
  });

  it('Weekly $100 in a five-week month with $400 in is 80% of the way', () => {
    const e = env({ targetKind: 'weekly', targets: { '2026-10': 10000 } });
    const bar = targetBar(e, row({ carriedIn: 40000 }), MONTH);
    expect(bar?.progress).toBeCloseTo(0.8, 2);
  });
});

describe('correct but surprising', () => {
  it('an overspent Maximum that was fully funded says "Cover $50", but Auto-assign skips it', () => {
    const e = env({});
    const r = row({ assigned: 40000, activity: -45000, spent: 45000 });
    expect(envelopeStatus(e, r, MONTH)).toMatchObject({ subtitle: 'Overspent by $50', need: 5000, fillLabel: 'Cover' });
    expect(gap(e, r)).toBe(0);
  });

  it('an overspent Bank: "Cover" covers to $0, Auto-assign refills to the full amount', () => {
    const e = env({ targetKind: 'bank' });
    const r = row({ assigned: 40000, activity: -45000, spent: 45000 });
    expect(envelopeStatus(e, r, MONTH).need).toBe(5000);
    expect(gap(e, r)).toBe(45000);
  });

  it('a builder that ended short shows a green (funded) pill', () => {
    const e = env({ targetKind: 'builder', targetDate: '2026-10', targets: { '2026-10': 120000 } });
    const r = row({ carriedIn: 30000 });
    expect(envelopeStatus(e, r, MONTH).subtitle).toBe('Ended in Oct 2026');
    expect(targetBar(e, r, MONTH)?.state).toBe('funded');
  });

  it('a builder that was reached and then spent this month still reads "Reached"', () => {
    const e = env({ targetKind: 'builder', targetDate: '2026-12', targets: { '2026-10': 120000 } });
    const r = row({ carriedIn: 120000, activity: -80000, spent: 80000 });
    expect(envelopeStatus(e, r, MONTH).subtitle).toBe('Reached $1,200');
  });
});
