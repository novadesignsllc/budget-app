import { describe, expect, test } from '@jest/globals';

import {
  choiceFromKey,
  choiceKey,
  guessChoice,
  exactMatch,
  kindFits,
  kindFor,
  linkPreview,
  nameKey,
  nearMatch,
  planSync,
  similarName,
  slipBalance,
  waiting,
  type BankLink,
  type BankTransaction,
  type SyncedTxn,
} from './bank';
import type { Transaction } from './types';

const link: BankLink = {
  id: 'item1',
  institution: 'SoFi',
  token: 'v1.x',
  linkedAt: 0,
  accounts: [{ plaidAccountId: 'p-check', name: 'Checking', type: 'depository', subtype: 'checking', accountId: 'check', since: '2026-11-01' }],
};

function txn(id: string, date: string, amount: number, payee: string, extra: Partial<Transaction> = {}): Transaction {
  return { id, date, accountId: 'check', amount, kind: 'spend', payee, cleared: false, createdAt: 1, ...extra };
}

function synced(id: string, date: string, amount: number, name: string, extra: Partial<SyncedTxn> = {}): SyncedTxn {
  return { id, plaidAccountId: 'p-check', date, amount, name, pending: false, ...extra };
}

function bank(id: string, date: string, amount: number, name: string, extra: Partial<BankTransaction> = {}): BankTransaction {
  return {
    id,
    linkId: 'item1',
    plaidAccountId: 'p-check',
    accountId: 'check',
    date,
    amount,
    name,
    raw: name,
    pending: false,
    status: 'new',
    createdAt: 1,
    ...extra,
  };
}

const sync = (
  result: { added?: SyncedTxn[]; modified?: SyncedTxn[]; removed?: string[] },
  state: { bankTransactions?: BankTransaction[]; transactions?: Transaction[] } = {},
) =>
  planSync({
    link,
    result: { added: result.added ?? [], modified: result.modified ?? [], removed: result.removed ?? [] },
    bankTransactions: state.bankTransactions ?? [],
    transactions: state.transactions ?? [],
    payees: [],
    now: 5,
  });

describe('names', () => {
  test('bank noise is dropped', () => {
    expect(nameKey("MCDONALD'S F12345 SAN JOSE")).toBe('mcdonaldsfsanjose');
    expect(nameKey('POS DEBIT KROGER #0412')).toBe('kroger');
  });
  test('a typed payee matches the bank name', () => {
    expect(similarName({ name: "McDonald's", raw: "MCDONALD'S F12345" }, 'McDonalds')).toBe(true);
    expect(similarName({ name: 'Olive Garden', raw: 'OLIVE GARDEN 0123' }, 'Olive Garden')).toBe(true);
    expect(similarName({ name: 'Shell', raw: 'SHELL OIL 57444' }, 'Kroger')).toBe(false);
  });
  test('a learned bank name matches', () => {
    const payees = [{ id: 'y', name: 'Joe’s Coffee', bankNames: ['javahut'] }];
    expect(similarName({ name: 'SQ *JAVA HUT 4411', raw: 'SQ *JAVA HUT 4411' }, 'Joe’s Coffee')).toBe(false);
    expect(similarName({ name: 'SQ *JAVA HUT 4411', raw: 'SQ *JAVA HUT 4411' }, 'Joe’s Coffee', payees)).toBe(true);
  });
});

describe('matching', () => {
  const mine = [txn('a', '2026-10-31', -910, "McDonald's"), txn('b', '2026-11-10', -4840, 'Olive Garden')];

  test('same amount within 5 days links, whatever the name', () => {
    expect(exactMatch(bank('x', '2026-11-01', -910, 'MCDONALDS F1234'), mine)?.id).toBe('a');
    expect(exactMatch(bank('x', '2026-11-04', -910, 'Something else'), mine)?.id).toBe('a');
    expect(exactMatch(bank('x', '2026-11-06', -910, "McDonald's"), mine)).toBeUndefined();
  });

  test('the closest date wins', () => {
    const two = [txn('a', '2026-11-01', -500, 'Wawa'), txn('b', '2026-11-04', -500, 'Wawa')];
    expect(exactMatch(bank('x', '2026-11-05', -500, 'Wawa'), two)?.id).toBe('b');
  });

  test('a tip makes it a near match, not an exact one', () => {
    const b = bank('x', '2026-11-11', -5840, 'Olive Garden');
    expect(exactMatch(b, mine)).toBeUndefined();
    expect(nearMatch(b, mine)?.id).toBe('b');
  });

  test('a different amount and a different name is not a match', () => {
    expect(nearMatch(bank('x', '2026-11-11', -5840, 'Shell'), mine)).toBeUndefined();
  });

  test('inflow never matches outflow', () => {
    expect(exactMatch(bank('x', '2026-11-01', 910, 'Refund'), mine)).toBeUndefined();
  });

  test('already linked transactions are skipped', () => {
    const linked = [txn('a', '2026-11-01', -910, "McDonald's", { bankId: 'other' })];
    expect(exactMatch(bank('x', '2026-11-01', -910, "McDonald's"), linked)).toBeUndefined();
  });
});

describe('planSync', () => {
  test('a new bank transaction waits for approval', () => {
    const plan = sync({ added: [synced('k', '2026-11-12', -8430, 'KROGER #0412', { merchant: 'Kroger' })] });
    expect(plan.bankTransactions).toEqual([
      expect.objectContaining({ id: 'k', status: 'new', name: 'Kroger', raw: 'KROGER #0412', accountId: 'check' }),
    ]);
    expect(plan.patches).toEqual([]);
  });

  test('one you entered links on its own and shows the bank status', () => {
    const plan = sync(
      { added: [synced('m', '2026-11-01', -910, 'MCDONALDS', { pending: true })] },
      { transactions: [txn('a', '2026-10-31', -910, "McDonald's")] },
    );
    expect(plan.bankTransactions[0]).toMatchObject({ status: 'linked', transactionId: 'a' });
    expect(plan.patches).toEqual([{ id: 'a', bankId: 'm', cleared: false }]);
  });

  test('before the start date is ignored, and unmapped accounts too', () => {
    const plan = sync({
      added: [synced('old', '2026-10-20', -100, 'Old'), { ...synced('o', '2026-11-05', -100, 'X'), plaidAccountId: 'p-other' }],
    });
    expect(plan.bankTransactions).toEqual([]);
  });

  test('syncing the same thing twice changes nothing', () => {
    const first = sync({ added: [synced('k', '2026-11-12', -8430, 'Kroger')] });
    const again = sync({ added: [synced('k', '2026-11-12', -8430, 'Kroger')] }, { bankTransactions: first.bankTransactions });
    expect(again.bankTransactions).toEqual(first.bankTransactions);
    expect(again.patches).toEqual([]);
  });

  test('when a pending charge posts with a tip, the linked one takes the new amount and is flagged', () => {
    const pending = bank('p1', '2026-11-10', -4840, 'Olive Garden', { pending: true, status: 'linked', transactionId: 'b' });
    const plan = sync(
      { added: [synced('p2', '2026-11-11', -5840, 'Olive Garden', { pendingId: 'p1' })], removed: ['p1'] },
      { bankTransactions: [pending], transactions: [txn('b', '2026-11-10', -4840, 'Olive Garden', { bankId: 'p1' })] },
    );
    expect(plan.bankTransactions.find((b) => b.id === 'p1')?.status).toBe('gone');
    expect(plan.bankTransactions.find((b) => b.id === 'p2')).toMatchObject({ status: 'linked', transactionId: 'b' });
    expect(plan.patches).toEqual([{ id: 'b', bankId: 'p2', cleared: true, amount: -5840, flag: true }]);
  });

  test('a posted charge for a pending one still waiting replaces it on Home', () => {
    const pending = bank('p1', '2026-11-10', -4107, 'Shell', { pending: true });
    const plan = sync({ added: [synced('p2', '2026-11-11', -4107, 'Shell', { pendingId: 'p1' })], removed: ['p1'] }, { bankTransactions: [pending] });
    expect(waiting(plan.bankTransactions).map((b) => b.id)).toEqual(['p2']);
  });

  test('if you entered it with the tip, the posted charge links to yours', () => {
    const pending = bank('p1', '2026-11-10', -4840, 'Olive Garden', { pending: true });
    const plan = sync(
      { added: [synced('p2', '2026-11-11', -5840, 'Olive Garden', { pendingId: 'p1' })], removed: ['p1'] },
      { bankTransactions: [pending], transactions: [txn('b', '2026-11-10', -5840, 'Olive Garden')] },
    );
    expect(plan.bankTransactions.find((b) => b.id === 'p2')).toMatchObject({ status: 'linked', transactionId: 'b' });
    expect(plan.patches).toEqual([{ id: 'b', bankId: 'p2', cleared: true }]);
  });

  test('a hold the bank dropped unlinks and flags yours', () => {
    const hold = bank('h', '2026-11-10', -100, 'Shell', { pending: true, status: 'linked', transactionId: 'g' });
    const plan = sync({ removed: ['h'] }, { bankTransactions: [hold], transactions: [txn('g', '2026-11-10', -100, 'Gas', { bankId: 'h' })] });
    expect(plan.patches).toEqual([{ id: 'g', bankId: null, cleared: false, flag: true }]);
  });

  test('reconciled transactions are never changed', () => {
    const plan = sync(
      { added: [synced('m', '2026-11-02', -910, 'MCDONALDS')] },
      { transactions: [txn('a', '2026-11-02', -910, "McDonald's", { reconciled: true, cleared: true })] },
    );
    expect(plan.patches).toEqual([{ id: 'a', bankId: 'm' }]);
  });
});

describe('linking an account already in Slip', () => {
  test('counts what matched, what is new and what the bank does not have', () => {
    const preview = linkPreview({
      accountId: 'check',
      since: '2026-11-01',
      plaidAccountId: 'p-check',
      synced: [synced('1', '2026-11-03', -5133, 'Kroger'), synced('2', '2026-11-07', -1289, 'Chick-fil-A'), synced('3', '2026-10-30', -10, 'Old')],
      transactions: [txn('a', '2026-11-03', -5133, 'Kroger'), txn('b', '2026-11-04', -3705, 'Target'), txn('c', '2026-10-20', -1, 'Before')],
      payees: [],
    });
    expect(preview.matched).toBe(1);
    expect(preview.fresh.map((s) => s.id)).toEqual(['2']);
    expect(preview.missing.map((t) => t.id)).toEqual(['b']);
  });
});

describe('accounts', () => {
  test('cards and loans are owed, so they go negative', () => {
    expect(slipBalance('credit', 41000)).toBe(-41000);
    expect(slipBalance('depository', 11000)).toBe(11000);
  });
  test('bank account types map to Slip kinds', () => {
    expect(kindFor({ type: 'depository', subtype: 'savings' })).toBe('savings');
    expect(kindFor({ type: 'credit', subtype: 'credit card' })).toBe('credit_card');
    expect(kindFor({ type: 'loan', subtype: 'student' })).toBe('student_loan');
    expect(kindFits({ type: 'credit' }, 'checking')).toBe(false);
    expect(kindFits({ type: 'loan' }, 'auto_loan')).toBe(true);
  });
});

describe('choices', () => {
  test('round-trip through a dropdown value', () => {
    for (const c of [
      { type: 'envelope', envelopeId: 'e1' },
      { type: 'transfer', accountId: 'a:b' },
      { type: 'bill', recurringId: 'r1' },
      { type: 'income' },
      { type: 'interest' },
      { type: 'adjustment' },
    ] as const) {
      expect(choiceFromKey(choiceKey(c)!)).toEqual(c);
    }
  });

  const accounts = [
    { id: 'check', name: 'Checking', kind: 'checking', openingBalance: 0, openedOn: '2026-01-01', order: 0 },
    { id: 'save', name: 'Savings', kind: 'savings', openingBalance: 0, openedOn: '2026-01-01', order: 1 },
  ] as const;
  const envelopes = [{ id: 'groc', name: 'Groceries', group: 'Daily', order: 0 }];
  const ctx = (extra: object = {}) => ({
    accounts: [...accounts],
    envelopes,
    payees: [],
    recurring: [],
    bankTransactions: [],
    ...extra,
  });

  test('a payee you used before gets its envelope', () => {
    const b = bank('k', '2026-11-12', -8430, 'Kroger');
    expect(guessChoice(b, ctx({ payees: [{ id: 'y', name: 'Kroger', envelopeId: 'groc' }] }))).toEqual({
      type: 'envelope',
      envelopeId: 'groc',
    });
  });

  test('a due bill on the same account is picked first', () => {
    const r = { id: 'r1', name: 'Verizon', kind: 'bill', amount: 6500, accountId: 'check', frequency: 'monthly', nextDue: '2026-11-13', active: true } as const;
    expect(guessChoice(bank('v', '2026-11-12', -6512, 'VERIZON WIRELESS'), ctx({ recurring: [r] }))).toEqual({ type: 'bill', recurringId: 'r1' });
  });

  test('the other side of a transfer between linked accounts', () => {
    const out = bank('o', '2026-11-12', -20000, 'Transfer to savings');
    const into = bank('i', '2026-11-12', 20000, 'Transfer from checking', { accountId: 'save' });
    expect(guessChoice(out, ctx({ bankTransactions: [out, into] }))).toEqual({ type: 'transfer', accountId: 'save' });
  });

  test('a paycheck goes to Ready to assign', () => {
    expect(guessChoice(bank('p', '2026-11-13', 193542, 'ACME PAYROLL', { category: 'INCOME' }), ctx())).toEqual({ type: 'income' });
  });
});
