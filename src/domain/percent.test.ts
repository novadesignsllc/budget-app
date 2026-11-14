import { describe, expect, it } from '@jest/globals';

import { computeMonth } from './months';
import { targetNeed, targetThisMonth } from './targets';
import type { Account, Allocation, Envelope, Transaction } from './types';

// The Business budget's Taxes envelope: 30% of income, starting in October.
const accounts: Account[] = [{ id: 'novo', name: 'Novo', kind: 'checking', openingBalance: 250000, openedOn: '2026-10-01', order: 0 }];
const taxes: Envelope = { id: 'tax', name: 'Taxes', group: 'Savings', order: 0, targetKind: 'percent', targets: { '2026-10': 3000 } };
const income = (date: string, amount: number): Transaction => ({ id: date + amount, date, accountId: 'novo', amount, kind: 'income', payee: 'Americo', cleared: true, createdAt: 1 });
const assign = (date: string, amount: number): Allocation => ({ id: date + amount + Math.random(), date, envelopeId: 'tax', amount, createdAt: 1 });

function need(month: string, transactions: Transaction[], allocations: Allocation[]) {
  const m = computeMonth({ accounts, envelopes: [taxes], transactions, allocations }, month);
  const row = m.envelopes.get('tax')!;
  return { need: targetNeed(taxes, 3000, row, month), asks: targetThisMonth(taxes, 3000, row, month) };
}

describe('percent of income carries a shortfall forward', () => {
  const tx = [income('2026-10-26', 62921), income('2026-10-28', 5817)];

  it('October asks 30% of $687.38, rounded up to $207', () => {
    expect(need('2026-10', tx, []).asks).toBe(20700);
  });

  it('assigning $189 in October leaves $18 for November, even with no November income yet', () => {
    expect(need('2026-11', tx, [assign('2026-10-27', 18900)])).toEqual({ need: 1800, asks: 1800 });
  });

  it('November income adds its own share on top', () => {
    const nov = [...tx, income('2026-11-20', 100000)];
    expect(need('2026-11', nov, [assign('2026-10-27', 18900)]).asks).toBe(1800 + 30000);
  });

  it('money taken back out of the envelope counts against it', () => {
    expect(need('2026-11', tx, [assign('2026-10-27', 20700), assign('2026-10-30', -5000)]).need).toBe(5000);
  });

  it('extra put in earlier counts toward later months', () => {
    const nov = [...tx, income('2026-11-20', 100000)];
    expect(need('2026-11', nov, [assign('2026-10-27', 25700)]).need).toBe(30000 - 5000);
  });

  it('a fully funded October leaves nothing for November', () => {
    expect(need('2026-11', tx, [assign('2026-10-27', 20700)]).need).toBe(0);
  });
});
