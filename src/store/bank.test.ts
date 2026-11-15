import { beforeEach, describe, expect, it } from '@jest/globals';

import type { SyncResult } from '@/domain/bank';
import { computeLedger } from '@/domain/ledger';

import { resetStore, useStore } from './index';

beforeEach(() => resetStore());

function setup() {
  const s = useStore.getState();
  const check = s.addAccount({ name: 'Checking', kind: 'checking', balance: 100000 });
  const card = s.addAccount({ name: 'Chase', kind: 'credit_card', balance: 50000 });
  const groceries = s.addEnvelope({ name: 'Groceries', group: 'Daily' });
  s.saveBankLink({
    id: 'item',
    institution: 'Bank',
    token: 'v1.x',
    linkedAt: 0,
    accounts: [
      { plaidAccountId: 'pc', name: 'Checking', type: 'depository', accountId: check, since: '2026-11-01' },
      { plaidAccountId: 'pk', name: 'Card', type: 'credit', accountId: card, since: '2026-11-01' },
    ],
  });
  return { check, card, groceries };
}

const result = (added: SyncResult['added'], extra: Partial<SyncResult> = {}): SyncResult => ({
  added,
  modified: [],
  removed: [],
  cursor: 'c1',
  ready: true,
  accounts: [],
  ...extra,
});

const state = () => useStore.getState();
const row = (bankId: string) => state().transactions.find((t) => t.bankId === bankId);

describe('bank sync in the store', () => {
  it('links what you entered, adds the rest to the account to check, and keeps the cursor and balance', () => {
    const { check, groceries } = setup();
    state().addTransaction({ date: '2026-11-02', accountId: check, amount: 910, kind: 'spend', payee: "McDonald's", envelopeId: groceries });
    state().applyBankSync(
      'item',
      result(
        [
          { id: 'b1', plaidAccountId: 'pc', date: '2026-11-03', name: 'MCDONALDS F1', amount: -910, pending: false },
          { id: 'b2', plaidAccountId: 'pc', date: '2026-11-04', name: 'ZZQ STORE', amount: -5000, pending: true },
        ],
        { accounts: [{ plaidAccountId: 'pc', name: 'Checking', type: 'depository', current: 120000 }] },
      ),
    );
    const s = state();
    expect(s.transactions).toHaveLength(2);
    expect(s.transactions[0]).toMatchObject({ bankId: 'b1', cleared: true });
    expect(s.transactions[0].review).toBeUndefined();
    // In the account already, pending, with nothing guessed: Home asks where it goes.
    expect(row('b2')).toMatchObject({ amount: -5000, kind: 'spend', cleared: false, fromBank: true, review: true });
    expect(row('b2')?.envelopeId).toBeUndefined();
    expect(s.bankTransactions.find((b) => b.id === 'b2')).toMatchObject({ status: 'linked', transactionId: row('b2')!.id });
    expect(s.bankLinks[0]).toMatchObject({ cursor: 'c1' });
    expect(s.bankLinks[0].accounts[0].balance).toBe(120000);
  });

  it('approving from Home puts it in the envelope, once, and learns the payee', () => {
    const { groceries } = setup();
    state().applyBankSync('item', result([{ id: 'b2', plaidAccountId: 'pc', date: '2026-11-04', name: 'KROGER #12', merchant: 'Kroger', amount: -5000, pending: true }]));
    state().settleBank('b2', { type: 'envelope', envelopeId: groceries });
    state().settleBank('b2', { type: 'envelope', envelopeId: groceries });
    const s = state();
    expect(s.transactions).toHaveLength(1);
    expect(s.transactions[0]).toMatchObject({ payee: 'Kroger', amount: -5000, kind: 'spend', envelopeId: groceries, cleared: false, bankId: 'b2' });
    expect(s.transactions[0].review).toBeUndefined();
    expect(s.payees.find((p) => p.name === 'Kroger')).toMatchObject({ envelopeId: groceries });
  });

  it('a card purchase goes in as a slip, and a paycheck approves as income', () => {
    const { groceries } = setup();
    state().applyBankSync(
      'item',
      result([
        { id: 's', plaidAccountId: 'pk', date: '2026-11-04', name: 'ZZQ', amount: -2399, pending: false },
        { id: 'p', plaidAccountId: 'pc', date: '2026-11-05', name: 'ACME PAYROLL', amount: 193542, pending: false },
      ]),
    );
    expect(row('s')).toMatchObject({ kind: 'slip', amount: -2399, review: true });
    state().settleBank('s', { type: 'envelope', envelopeId: groceries });
    state().settleBank('p', { type: 'income' });
    expect(row('s')).toMatchObject({ kind: 'slip', amount: -2399, envelopeId: groceries });
    expect(row('p')).toMatchObject({ kind: 'income', amount: 193542 });
    expect(row('p')?.envelopeId).toBeUndefined();
    expect(state().transactions).toHaveLength(2);
  });

  it('a card payment named in words goes in as a transfer, and the card side links to it', () => {
    const { check, card } = setup();
    state().applyBankSync('item', result([{ id: 'out', plaidAccountId: 'pc', date: '2026-11-06', name: 'CHASE CREDIT CRD AUTOPAY', amount: -25000, pending: false }]));
    state().applyBankSync('item', result([{ id: 'in', plaidAccountId: 'pk', date: '2026-11-07', name: 'Payment Thank You', amount: 25000, pending: false }]));
    const pair = state().transactions;
    expect(pair).toHaveLength(2);
    expect(pair.find((t) => t.accountId === check)).toMatchObject({ kind: 'transfer', bankId: 'out', review: true });
    expect(pair.find((t) => t.accountId === card)).toMatchObject({ kind: 'transfer', bankId: 'in', cleared: true });
  });

  it('when the card side comes first, the payment from checking becomes its other half', () => {
    const { check, card } = setup();
    // No words to go on, so it goes in with no envelope...
    state().applyBankSync('item', result([{ id: 'out', plaidAccountId: 'pc', date: '2026-11-06', name: 'ZZQ 4471', amount: -25000, pending: false }]));
    expect(row('out')).toMatchObject({ kind: 'spend', review: true });
    // ...then the card shows the same money arriving: one transfer, not a payment plus a mystery charge.
    state().applyBankSync('item', result([{ id: 'in', plaidAccountId: 'pk', date: '2026-11-07', name: 'ZZQ CREDIT', amount: 25000, pending: false }]));
    const s = state();
    expect(s.transactions).toHaveLength(2);
    expect(s.transactions.every((t) => t.kind === 'transfer')).toBe(true);
    expect(s.transactions.find((t) => t.accountId === check)?.bankId).toBe('out');
    expect(s.transactions.find((t) => t.accountId === card)?.bankId).toBe('in');
    expect(s.bankTransactions.every((b) => b.status === 'linked')).toBe(true);
  });

  it('linking to one you entered drops what sync added, keeps your envelope, takes the bank amount', () => {
    const { check, groceries } = setup();
    state().addTransaction({ date: '2026-11-10', accountId: check, amount: 4840, kind: 'spend', payee: 'Olive Garden', envelopeId: groceries });
    state().applyBankSync('item', result([{ id: 'og', plaidAccountId: 'pc', date: '2026-11-11', name: 'OLIVE GARDEN 0123', amount: -5840, pending: false }]));
    expect(state().transactions).toHaveLength(2);
    const mine = state().transactions.find((t) => !t.fromBank)!;
    state().linkBank('og', mine.id);
    const s = state();
    expect(s.transactions).toHaveLength(1);
    expect(s.transactions[0]).toMatchObject({ id: mine.id, amount: -5840, bankId: 'og', cleared: true, envelopeId: groceries });
    expect(computeLedger(s).available.get(groceries)).toBe(-5840);
  });

  it('remembers a bank name that differs from yours, and uses your name next time', () => {
    const { check, groceries } = setup();
    state().addTransaction({ date: '2026-11-10', accountId: check, amount: 450, kind: 'spend', payee: 'Joe’s Coffee', envelopeId: groceries });
    state().applyBankSync('item', result([{ id: 'j1', plaidAccountId: 'pc', date: '2026-11-11', name: 'SQ *JAVA HUT 4411', amount: -500, pending: false }]));
    state().linkBank('j1', state().transactions.find((t) => !t.fromBank)!.id);
    expect(state().payees[0].bankNames).toEqual(['javahut']);
    state().applyBankSync('item', result([{ id: 'j2', plaidAccountId: 'pc', date: '2026-11-20', name: 'SQ *JAVA HUT 4411', amount: -525, pending: false }]));
    expect(row('j2')).toMatchObject({ payee: 'Joe’s Coffee', envelopeId: groceries, review: true });
  });

  it('a due bill goes in once and moves the bill on; picking something else moves it back', () => {
    const { check, groceries } = setup();
    const rid = state().addRecurring({ name: 'Verizon', kind: 'bill', amount: 6500, accountId: check, frequency: 'monthly', nextDue: '2026-11-13' });
    state().applyBankSync('item', result([{ id: 'v', plaidAccountId: 'pc', date: '2026-11-12', name: 'VERIZON', amount: -6512, pending: false }]));
    expect(state().transactions).toEqual([expect.objectContaining({ id: `${rid}-2026-11-13`, amount: -6512, recurringId: rid, bankId: 'v', review: true })]);
    expect(state().recurring[0].nextDue).toBe('2026-12-13');
    state().settleBank('v', { type: 'envelope', envelopeId: groceries });
    expect(state().recurring[0].nextDue).toBe('2026-11-13');
    expect(state().transactions).toEqual([expect.objectContaining({ bankId: 'v', envelopeId: groceries })]);
  });

  it('a hold the bank drops goes away; a pending charge that posts for more just changes', () => {
    setup();
    state().applyBankSync('item', result([
      { id: 'h', plaidAccountId: 'pc', date: '2026-11-04', name: 'HOTEL', amount: -10000, pending: true },
      { id: 'g', plaidAccountId: 'pc', date: '2026-11-04', name: 'SHELL', amount: -100, pending: true },
    ]));
    expect(state().transactions).toHaveLength(2);
    state().applyBankSync('item', result([{ id: 'g2', plaidAccountId: 'pc', date: '2026-11-05', name: 'SHELL', amount: -4210, pending: false, pendingId: 'g' }], { removed: ['h', 'g'] }));
    const s = state();
    expect(s.transactions).toHaveLength(1);
    expect(s.transactions[0]).toMatchObject({ amount: -4210, cleared: true, bankId: 'g2' });
    expect(s.transactions[0].flagged).toBeUndefined();
  });

  it('deleting one the bank added keeps it out', () => {
    setup();
    const add = result([{ id: 'x', plaidAccountId: 'pc', date: '2026-11-04', name: 'X', amount: -100, pending: false }]);
    state().applyBankSync('item', add);
    state().deleteTransaction(row('x')!.id);
    state().applyBankSync('item', add);
    expect(state().transactions).toHaveLength(0);
    expect(state().bankTransactions[0].status).toBe('skipped');
  });

  it('editing it yourself counts as checking it', () => {
    const { groceries } = setup();
    state().applyBankSync('item', result([{ id: 'x', plaidAccountId: 'pc', date: '2026-11-04', name: 'ZZQ', amount: -100, pending: false }]));
    const t = row('x')!;
    state().updateTransaction(t.id, { cleared: true });
    expect(row('x')?.review).toBe(true);
    state().editTransaction(t.id, { date: t.date, payee: t.payee, memo: '', amount: -100, envelope: groceries });
    expect(row('x')).toMatchObject({ envelopeId: groceries });
    expect(row('x')?.review).toBeUndefined();
  });

  it('unlinking a bank keeps your transactions', () => {
    const { groceries } = setup();
    state().applyBankSync('item', result([{ id: 'k', plaidAccountId: 'pc', date: '2026-11-04', name: 'Kroger', amount: -5000, pending: false }]));
    state().settleBank('k', { type: 'envelope', envelopeId: groceries });
    state().removeBankLink('item');
    const s = state();
    expect(s.bankLinks).toHaveLength(0);
    expect(s.bankTransactions).toHaveLength(0);
    expect(s.transactions).toHaveLength(1);
    expect(s.transactions[0].bankId).toBeUndefined();
  });

  it('undo takes the lock off but keeps them posted', () => {
    const { check } = setup();
    state().addTransaction({ date: '2026-11-02', accountId: check, amount: 100, kind: 'spend', payee: 'A' });
    const id = state().transactions[0].id;
    state().updateTransaction(id, { cleared: true });
    state().reconcileTransactions(check, [id]);
    state().unreconcile([id]);
    expect(state().transactions[0]).toMatchObject({ reconciled: false, cleared: true });
  });
});

describe('undo', () => {
  it('puts an approved one back the way the bank brought it in', () => {
    const { groceries } = setup();
    state().applyBankSync('item', result([{ id: 'k', plaidAccountId: 'pc', date: '2026-11-04', name: 'ZZQ', amount: -5000, pending: false }]));
    state().settleBank('k', { type: 'envelope', envelopeId: groceries });
    state().restoreBank('k');
    expect(state().transactions).toHaveLength(1);
    // Back on Home to check, with the envelope it just learned already picked.
    expect(row('k')).toMatchObject({ review: true, amount: -5000, envelopeId: groceries });
  });

  it('unlinks one you entered, and the bank copy goes back in on its own', () => {
    const { check, groceries } = setup();
    state().addTransaction({ date: '2026-11-10', accountId: check, amount: 4840, kind: 'spend', payee: 'Olive Garden', envelopeId: groceries });
    state().applyBankSync('item', result([{ id: 'og', plaidAccountId: 'pc', date: '2026-11-11', name: 'OLIVE GARDEN', amount: -5840, pending: false }]));
    const mine = state().transactions.find((t) => !t.fromBank)!;
    state().linkBank('og', mine.id);
    state().restoreBank('og');
    const s = state();
    expect(s.transactions).toHaveLength(2);
    expect(s.transactions.find((t) => t.id === mine.id)?.bankId).toBeUndefined();
    expect(row('og')).toMatchObject({ fromBank: true, review: true });
  });

  it('changing a transfer to an envelope removes both halves', () => {
    const { groceries } = setup();
    state().applyBankSync('item', result([{ id: 'out', plaidAccountId: 'pc', date: '2026-11-06', name: 'CHASE AUTOPAY', amount: -25000, pending: false }]));
    expect(state().transactions).toHaveLength(2);
    state().settleBank('out', { type: 'envelope', envelopeId: groceries });
    expect(state().transactions).toEqual([expect.objectContaining({ bankId: 'out', kind: 'spend', envelopeId: groceries })]);
  });
});

describe('fresh start', () => {
  it('clears money and history, keeps the setup', () => {
    const { check, card, groceries } = setup();
    const s0 = useStore.getState();
    s0.addAccount({ name: 'Cash jar', kind: 'cash', balance: 5000 });
    s0.assign(groceries, 20000);
    s0.setTarget(groceries, '2026-11', 40000);
    const rid = s0.addRecurring({ name: 'Netflix', kind: 'subscription', amount: 1549, accountId: card, frequency: 'monthly', nextDue: '2026-11-20' });
    s0.addTransaction({ date: '2026-11-02', accountId: check, amount: 910, kind: 'spend', payee: "McDonald's", envelopeId: groceries });
    s0.applyBankSync('item', result([{ id: 'k', plaidAccountId: 'pc', date: '2026-11-04', name: 'Kroger', amount: -5000, pending: false }], {
      accounts: [{ plaidAccountId: 'pc', name: 'Checking', type: 'depository', current: 123456 }],
      cursor: 'c9',
    }));
    useStore.getState().freshStart();
    const s = useStore.getState();
    expect(s.transactions).toEqual([]);
    expect(s.allocations).toEqual([]);
    expect(s.bankTransactions).toEqual([]);
    expect(s.accounts.find((a) => a.id === check)?.openingBalance).toBe(123456);
    expect(s.accounts.find((a) => a.name === 'Cash jar')?.openingBalance).toBe(0);
    expect(s.accounts.find((a) => a.id === card)?.openingBalance).toBe(0);
    expect(s.envelopes.find((e) => e.id === groceries)?.targets).toEqual({ '2026-11': 40000 });
    expect(s.recurring.find((r) => r.id === rid)).toMatchObject({ accountId: card, nextDue: '2026-11-20' });
    expect(s.payees.some((p) => p.name === "McDonald's")).toBe(true);
    expect(s.bankLinks[0]).toMatchObject({ cursor: 'c9' });
    expect(s.bankLinks[0].accounts[0].since).toBe(s.accounts[0].openedOn);
  });
});

describe('starting balance', () => {
  it('lands in Ready to assign and is not income', () => {
    const { check } = setup();
    useStore.getState().addAdjustment(check, 250000, { starting: true });
    const t = useStore.getState().transactions[0];
    expect(t).toMatchObject({ payee: 'Starting balance', kind: 'adjustment', cleared: true, reconciled: false });
    expect(t.envelopeId).toBeUndefined();
  });
});
