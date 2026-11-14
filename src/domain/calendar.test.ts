import { describe, expect, it } from '@jest/globals';

import { dailyFlow, monthGrid } from './calendar';
import type { Account, Transaction } from './types';

const accounts: Account[] = [
  { id: 'chk', name: 'Checking', kind: 'checking', openingBalance: 0, openedOn: '2026-01-01', order: 0 },
  { id: 'visa', name: 'Visa', kind: 'credit_card', openingBalance: 0, openedOn: '2026-01-01', order: 1 },
];
const tx = (date: string, amount: number, kind: Transaction['kind'], accountId = 'chk'): Transaction => ({
  id: date + amount,
  date,
  accountId,
  amount,
  kind,
  payee: 'x',
  cleared: true,
  createdAt: 0,
});

describe('calendar', () => {
  it('October 2026 starts on a Thursday and fills five weeks', () => {
    const weeks = monthGrid('2026-10');
    expect(weeks).toHaveLength(5);
    expect(weeks[0]).toEqual([null, null, null, null, 1, 2, 3]);
    expect(weeks[4]).toEqual([25, 26, 27, 28, 29, 30, 31]);
  });

  it('counts every inflow and outflow, but not transfers or adjustments', () => {
    const days = dailyFlow(
      accounts,
      [
        tx('2026-10-02', 193542, 'income'),
        tx('2026-10-02', -15200, 'spend'),
        tx('2026-10-02', -4000, 'slip', 'visa'),
        tx('2026-10-02', 2500, 'spend'), // a refund
        tx('2026-10-02', -45500, 'transfer'),
        tx('2026-10-02', 300000, 'adjustment'),
        tx('2026-09-30', -1000, 'spend'),
      ],
      '2026-10',
    );
    expect(days.get(2)).toEqual({ inflow: 193542 + 2500, outflow: 19200 });
    expect(days.size).toBe(1);
  });
});
