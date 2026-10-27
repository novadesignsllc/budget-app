import { describe, expect, it } from '@jest/globals';

import { generateDemo } from '@/store/demo-data';

import { averageMonthlyIncome, balanceHistory, monthlyCashFlow, projectBalances } from './history';
import { computeLedger } from './ledger';
import type { Account, Transaction } from './types';

describe('balanceHistory', () => {
  it('ends at today’s balances and skips months before the first account', () => {
    const asOf = '2026-10-23';
    const demo = generateDemo(asOf);
    const points = balanceHistory(demo, 12, asOf);
    expect(points).toHaveLength(6);
    expect(points[0].month).toBe('2026-05');
    const last = points[points.length - 1];
    const ledger = computeLedger(demo);
    expect(last).toEqual({ month: '2026-10', cash: ledger.cashTotal, debt: ledger.debtTotal });
    // Snowball payments pay debt down over time.
    expect(last.debt).toBeLessThan(points[0].debt);
  });

  it('counts each transaction in the month it happened', () => {
    const accounts: Account[] = [
      { id: 'c', name: 'C', kind: 'checking', openingBalance: 1000, openedOn: '2026-08-10', order: 0 },
      { id: 'd', name: 'D', kind: 'credit_card', openingBalance: -5000, openedOn: '2026-09-15', order: 1 },
    ];
    const t = (accountId: string, amount: number, date: string): Transaction => ({
      id: date + accountId, accountId, amount, date, kind: 'spend', payee: 'x', cleared: false, createdAt: 0,
    });
    const points = balanceHistory({ accounts, transactions: [t('c', -200, '2026-08-20'), t('c', 500, '2026-10-01'), t('d', 1000, '2026-10-02')] }, 3, '2026-10-05');
    expect(points).toEqual([
      { month: '2026-08', cash: 800, debt: 0 },
      { month: '2026-09', cash: 800, debt: 5000 },
      { month: '2026-10', cash: 1300, debt: 4000 },
    ]);
  });
});

describe('projections', () => {
  const chk: Account = { id: 'chk', name: 'Checking', kind: 'checking', openingBalance: 100000, openedOn: '2026-06-01', order: 0 };
  const card: Account = { id: 'card', name: 'Card', kind: 'credit_card', openingBalance: -50000, openedOn: '2026-06-01', order: 1 };
  const t = (date: string, amount: number, kind: Transaction['kind'], extra: Partial<Transaction> = {}): Transaction => ({
    id: `${date}${amount}`, date, accountId: 'chk', amount, kind, payee: 'x', cleared: false, createdAt: 0, ...extra,
  });
  const txns = [
    t('2026-07-01', 300000, 'income'), t('2026-07-10', -200000, 'spend'),
    t('2026-08-01', 300000, 'income'), t('2026-08-10', -220000, 'spend'),
    t('2026-09-01', 300000, 'income'), t('2026-09-10', -180000, 'spend'),
    // A card payment and a balance fix don't count as cash flow.
    t('2026-09-15', -40000, 'transfer', { transferAccountId: 'card' }),
    t('2026-09-20', -5000, 'adjustment'),
    // This month isn't over, so it's left out.
    t('2026-10-02', -999999, 'spend'),
  ];

  it('averages the last three full months, leaving out debt payments and fixes', () => {
    expect(monthlyCashFlow({ accounts: [chk, card], transactions: txns }, '2026-10-20')).toBe(100000);
  });

  it('only counts full months the account existed', () => {
    const late: Account = { ...chk, openedOn: '2026-08-15' };
    // Only September is a full month here: +300,000 − 180,000.
    expect(monthlyCashFlow({ accounts: [late, card], transactions: txns }, '2026-10-20')).toBe(120000);
  });

  it('pays debt down on the plan and keeps the payment in cash once it’s gone', () => {
    const p = projectBalances({ cash: 100000, debtBalances: [30000, 15000, 0], monthlyPayment: 20000, cashFlow: 50000, months: 4 });
    expect(p.map((x) => x.debt)).toEqual([15000, 0, 0, 0]);
    // Month 1 pays 20,000; month 2 pays the last 15,000; then nothing.
    expect(p.map((x) => x.cash)).toEqual([130000, 165000, 215000, 265000]);
  });
});

describe('averageMonthlyIncome', () => {
  const chk: Account = { id: 'chk', name: 'Checking', kind: 'checking', openingBalance: 0, openedOn: '2026-07-01', order: 0 };
  const inc = (date: string, amount: number): Transaction => ({ id: date, date, accountId: 'chk', amount, kind: 'income', payee: 'Job', cleared: false, createdAt: 0 });
  it('averages full months since the account opened, leaving out this month', () => {
    const transactions = [inc('2026-07-15', 300000), inc('2026-08-15', 300000), inc('2026-09-15', 360000), inc('2026-10-01', 999999)];
    expect(averageMonthlyIncome({ accounts: [chk], transactions }, '2026-10-20')).toBe(320000);
  });
  it('is zero before a full month', () => {
    expect(averageMonthlyIncome({ accounts: [{ ...chk, openedOn: '2026-10-02' }], transactions: [] }, '2026-10-20')).toBe(0);
  });
});
