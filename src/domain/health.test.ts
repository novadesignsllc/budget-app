import { describe, expect, it } from '@jest/globals';

import { budgetHealth } from './health';
import { computeLedger } from './ledger';
import type { Account, Allocation, Envelope, Transaction } from './types';

const checking: Account = { id: 'chk', name: 'Checking', kind: 'checking', openingBalance: 100000, openedOn: '2026-10-01', order: 0 };
const visa: Account = { id: 'visa', name: 'Visa', kind: 'credit_card', openingBalance: -50000, openedOn: '2026-10-01', order: 1 };
const envelopes: Envelope[] = [
  { id: 'food', name: 'Food', group: 'Daily', order: 0 },
  { id: 'vpay', name: 'Visa', group: 'Debt payments', order: 1, debtAccountId: 'visa' },
];
const al = (envelopeId: string, amount: number): Allocation => ({ id: envelopeId + amount, envelopeId, amount, date: '2026-10-02', createdAt: 1 });
const tx = (p: Partial<Transaction> & Pick<Transaction, 'accountId' | 'amount' | 'kind'>): Transaction => ({
  id: Math.random().toString(36), date: '2026-10-05', payee: 'x', cleared: false, createdAt: 1, ...p,
});

describe('budgetHealth', () => {
  it('is fine when envelopes hold no more than the accounts', () => {
    const l = computeLedger({ accounts: [checking, visa], envelopes, transactions: [], allocations: [al('food', 100000)] });
    expect(budgetHealth(l)).toEqual({ cash: 100000, assigned: 100000, short: 0 });
  });

  it('card slips alone never make it short', () => {
    const l = computeLedger({
      accounts: [checking, visa],
      envelopes,
      allocations: [al('food', 60000)],
      transactions: [
        tx({ accountId: 'visa', amount: -20000, kind: 'slip', envelopeId: 'food' }),
        tx({ accountId: 'visa', amount: -5000, kind: 'slip', envelopeId: 'food' }),
      ],
    });
    expect(budgetHealth(l).short).toBe(0);
  });

  it('flags cash that fell below what is assigned', () => {
    const l = computeLedger({
      accounts: [checking, visa],
      envelopes,
      allocations: [al('food', 100000)],
      // The bank was lower than the app thought.
      transactions: [tx({ accountId: 'chk', amount: -12000, kind: 'adjustment' })],
    });
    expect(budgetHealth(l)).toEqual({ cash: 88000, assigned: 100000, short: 12000 });
  });
});
