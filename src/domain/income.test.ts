import { describe, expect, it } from '@jest/globals';

import { incomeByMonth, incomeByPayee, incomeTransactions } from './income';
import type { Account, Transaction } from './types';

const accounts: Account[] = [
  { id: 'chk', name: 'Checking', kind: 'checking', openingBalance: 0, openedOn: '2026-01-01', order: 0 },
  { id: 'visa', name: 'Visa', kind: 'credit_card', openingBalance: 0, openedOn: '2026-01-01', order: 1 },
];
const tx = (id: string, date: string, amount: number, payee: string, extra: Partial<Transaction> = {}): Transaction => ({
  id,
  date,
  accountId: 'chk',
  amount,
  kind: 'income',
  payee,
  cleared: true,
  createdAt: 0,
  ...extra,
});
const all = [
  tx('a', '2026-08-15', 200000, 'Acme Payroll'),
  tx('b', '2026-09-15', 200000, 'ACME payroll'),
  tx('c', '2026-10-01', 50000, 'Etsy'),
  tx('d', '2026-10-15', 210000, 'Acme Payroll'),
  tx('e', '2026-10-02', 3000, 'Refund', { accountId: 'visa' }),
  tx('f', '2026-10-03', -5000, 'Kroger', { kind: 'spend' }),
  tx('g', '2026-10-04', 40000, 'Savings', { kind: 'transfer' }),
];

describe('income', () => {
  it('counts only income into bank accounts', () => {
    expect(incomeTransactions(accounts, all).map((t) => t.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('totals by month, with empty months as zero', () => {
    const income = incomeTransactions(accounts, all);
    expect(incomeByMonth(income, '2026-10', 4)).toEqual([
      { month: '2026-07', total: 0 },
      { month: '2026-08', total: 200000 },
      { month: '2026-09', total: 200000 },
      { month: '2026-10', total: 260000 },
    ]);
  });

  it('groups payees, biggest first', () => {
    const income = incomeTransactions(accounts, all);
    expect(incomeByPayee(income, '2026-09-01')).toEqual([
      { payee: 'Acme Payroll', total: 410000, count: 2, last: '2026-10-15' },
      { payee: 'Etsy', total: 50000, count: 1, last: '2026-10-01' },
    ]);
  });
});
