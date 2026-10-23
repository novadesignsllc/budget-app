import { describe, expect, it } from '@jest/globals';

import { canReconcile, isLocked, reconciledBalance } from './reconcile';
import type { Transaction } from './types';

const t = (p: Partial<Transaction>): Transaction => ({
  id: Math.random().toString(36), date: '2026-10-01', accountId: 'a', amount: -100, kind: 'spend', payee: 'x', cleared: false, createdAt: 0, ...p,
});

describe('reconcile helpers', () => {
  it('sums only reconciled transactions on top of the opening balance', () => {
    const list = [t({ reconciled: true, amount: -500 }), t({ amount: -200 }), t({ reconciled: true, amount: 1000, accountId: 'b' })];
    expect(reconciledBalance({ id: 'a', openingBalance: 10000 }, list)).toBe(9500);
  });
  it('locks reconciled transactions and keeps flagged ones out', () => {
    expect(isLocked(t({ reconciled: true }))).toBe(true);
    expect(isLocked(t({}))).toBe(false);
    expect(canReconcile(t({ flagged: true }))).toBe(false);
    expect(canReconcile(t({}))).toBe(true);
  });
});
