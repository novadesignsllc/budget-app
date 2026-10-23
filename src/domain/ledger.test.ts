import { describe, expect, it } from '@jest/globals';
import { computeLedger } from './ledger';
import type { Account, Allocation, Envelope, Transaction } from './types';

const checking: Account = { id: 'chk', name: 'Checking', kind: 'checking', openingBalance: 200000, openedOn: '2026-10-01', order: 0 };
const savings: Account = { id: 'sav', name: 'Savings', kind: 'savings', openingBalance: 50000, openedOn: '2026-10-01', order: 1 };
const visa: Account = { id: 'visa', name: 'Visa', kind: 'credit_card', openingBalance: -300000, openedOn: '2026-10-01', order: 2, apr: 2499, minPayment: 9000 };

const envelopes: Envelope[] = [
  { id: 'food', name: 'Eating Out', group: 'Daily', order: 0 },
  { id: 'groc', name: 'Groceries', group: 'Daily', order: 1 },
  { id: 'visa-pay', name: 'Visa', group: 'Debt payments', order: 0, debtAccountId: 'visa' },
];

let n = 0;
function tx(partial: Partial<Transaction> & Pick<Transaction, 'accountId' | 'amount' | 'kind'>): Transaction {
  return { id: `t${n++}`, date: '2026-10-10', payee: 'x', cleared: false, createdAt: n, ...partial };
}
function alloc(envelopeId: string, amount: number): Allocation {
  return { id: `a${n++}`, date: '2026-10-10', envelopeId, amount, createdAt: n };
}

function assertInvariant(l: ReturnType<typeof computeLedger>) {
  let assigned = 0;
  for (const v of l.available.values()) assigned += v;
  expect(l.readyToAssign + assigned).toBe(l.cashTotal);
}

describe('computeLedger', () => {
  const accounts = [checking, savings, visa];

  it('puts all opening cash in Ready to Assign and counts debt separately', () => {
    const l = computeLedger({ accounts, envelopes, transactions: [], allocations: [] });
    expect(l.cashTotal).toBe(250000);
    expect(l.debtTotal).toBe(300000);
    expect(l.readyToAssign).toBe(250000);
    assertInvariant(l);
  });

  it('moves money from Ready to Assign into envelopes, then spends it', () => {
    const l = computeLedger({
      accounts,
      envelopes,
      allocations: [alloc('food', 10000)],
      transactions: [tx({ accountId: 'chk', amount: -1099, kind: 'spend', envelopeId: 'food' })],
    });
    expect(l.available.get('food')).toBe(8901);
    expect(l.readyToAssign).toBe(240000);
    expect(l.balance.get('chk')).toBe(198901);
    assertInvariant(l);
  });

  it('a credit card slip takes from the envelope and sets the cash aside for the card', () => {
    const l = computeLedger({
      accounts,
      envelopes,
      allocations: [alloc('food', 10000)],
      transactions: [tx({ accountId: 'visa', amount: -1099, kind: 'slip', envelopeId: 'food' })],
    });
    expect(l.available.get('food')).toBe(8901);
    expect(l.available.get('visa-pay')).toBe(1099);
    expect(l.debtTotal).toBe(301099);
    expect(l.cashTotal).toBe(250000);
    expect(l.readyToAssign).toBe(240000);
    assertInvariant(l);
  });

  it('a debt payment spends from the payment envelope and lowers the debt', () => {
    const l = computeLedger({
      accounts,
      envelopes,
      allocations: [alloc('visa-pay', 50000)],
      transactions: [
        tx({ accountId: 'chk', amount: -50000, kind: 'transfer', envelopeId: 'visa-pay', transferAccountId: 'visa', transferPairId: 'p1' }),
        tx({ accountId: 'visa', amount: 50000, kind: 'transfer', transferAccountId: 'chk', transferPairId: 'p1' }),
      ],
    });
    expect(l.available.get('visa-pay')).toBe(0);
    expect(l.debtTotal).toBe(250000);
    expect(l.cashTotal).toBe(200000);
    expect(l.readyToAssign).toBe(200000);
    assertInvariant(l);
  });

  it('income lands in Ready to Assign; interest only grows the debt', () => {
    const l = computeLedger({
      accounts,
      envelopes,
      allocations: [],
      transactions: [
        tx({ accountId: 'chk', amount: 180000, kind: 'income' }),
        tx({ accountId: 'visa', amount: -6200, kind: 'interest' }),
      ],
    });
    expect(l.readyToAssign).toBe(430000);
    expect(l.debtTotal).toBe(306200);
    assertInvariant(l);
  });

  it('cash-to-cash transfers change nothing in the budget', () => {
    const l = computeLedger({
      accounts,
      envelopes,
      allocations: [alloc('groc', 20000)],
      transactions: [
        tx({ accountId: 'chk', amount: -30000, kind: 'transfer', transferAccountId: 'sav', transferPairId: 'p2' }),
        tx({ accountId: 'sav', amount: 30000, kind: 'transfer', transferAccountId: 'chk', transferPairId: 'p2' }),
      ],
    });
    expect(l.readyToAssign).toBe(230000);
    expect(l.balance.get('sav')).toBe(80000);
    assertInvariant(l);
  });

  it('overspending shows a negative envelope without breaking the rule', () => {
    const l = computeLedger({
      accounts,
      envelopes,
      allocations: [alloc('food', 1000)],
      transactions: [tx({ accountId: 'chk', amount: -2500, kind: 'spend', envelopeId: 'food' })],
    });
    expect(l.available.get('food')).toBe(-1500);
    assertInvariant(l);
  });

  it('tracks cleared balance separately for reconciliation', () => {
    const l = computeLedger({
      accounts,
      envelopes,
      allocations: [],
      transactions: [
        tx({ accountId: 'chk', amount: -1000, kind: 'spend', cleared: true }),
        tx({ accountId: 'chk', amount: -500, kind: 'spend', cleared: false }),
      ],
    });
    expect(l.clearedBalance.get('chk')).toBe(199000);
    expect(l.balance.get('chk')).toBe(198500);
  });
});
