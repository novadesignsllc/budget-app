import { describe, expect, it } from '@jest/globals';

import { generateDemo } from '@/store/demo-data';

import { balanceHistory } from './history';
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
