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

describe('bank sync in the store', () => {
  it('links what you entered, queues the rest, and keeps the cursor and balance', () => {
    const { check, groceries } = setup();
    useStore.getState().addTransaction({ date: '2026-11-02', accountId: check, amount: 910, kind: 'spend', payee: "McDonald's", envelopeId: groceries });
    useStore.getState().applyBankSync(
      'item',
      result(
        [
          { id: 'b1', plaidAccountId: 'pc', date: '2026-11-03', name: 'MCDONALDS F1', amount: -910, pending: false },
          { id: 'b2', plaidAccountId: 'pc', date: '2026-11-04', name: 'KROGER', amount: -5000, pending: true },
        ],
        { accounts: [{ plaidAccountId: 'pc', name: 'Checking', type: 'depository', current: 120000 }] },
      ),
    );
    const s = useStore.getState();
    expect(s.transactions[0]).toMatchObject({ bankId: 'b1', cleared: true });
    expect(s.bankTransactions.find((b) => b.id === 'b2')?.status).toBe('new');
    expect(s.bankLinks[0]).toMatchObject({ cursor: 'c1' });
    expect(s.bankLinks[0].accounts[0].balance).toBe(120000);
  });

  it('approving makes spending in the envelope, once, and learns the bank name', () => {
    const { groceries } = setup();
    useStore.getState().applyBankSync('item', result([{ id: 'b2', plaidAccountId: 'pc', date: '2026-11-04', name: 'KROGER #12', merchant: 'Kroger', amount: -5000, pending: true }]));
    const id = useStore.getState().approveBank('b2', { type: 'envelope', envelopeId: groceries });
    useStore.getState().approveBank('b2', { type: 'envelope', envelopeId: groceries });
    const s = useStore.getState();
    expect(s.transactions).toHaveLength(1);
    expect(s.transactions[0]).toMatchObject({ id, payee: 'Kroger', amount: -5000, kind: 'spend', envelopeId: groceries, cleared: false, bankId: 'b2' });
    expect(s.bankTransactions[0]).toMatchObject({ status: 'linked', transactionId: id });
    expect(s.payees.find((p) => p.name === 'Kroger')).toMatchObject({ envelopeId: groceries });
    // Same name as the payee: nothing extra to remember.
    expect(s.payees.find((p) => p.name === 'Kroger')?.bankNames).toBeUndefined();
  });

  it('a card purchase approves as a slip, and a paycheck as income', () => {
    const { groceries } = setup();
    useStore.getState().applyBankSync(
      'item',
      result([
        { id: 's', plaidAccountId: 'pk', date: '2026-11-04', name: 'Amazon', amount: -2399, pending: false },
        { id: 'p', plaidAccountId: 'pc', date: '2026-11-05', name: 'ACME PAYROLL', amount: 193542, pending: false },
      ]),
    );
    useStore.getState().approveBank('s', { type: 'envelope', envelopeId: groceries });
    useStore.getState().approveBank('p', { type: 'income' });
    const s = useStore.getState();
    expect(s.transactions.find((t) => t.bankId === 's')).toMatchObject({ kind: 'slip', amount: -2399, envelopeId: groceries });
    expect(s.transactions.find((t) => t.bankId === 'p')).toMatchObject({ kind: 'income', amount: 193542 });
    expect(s.transactions.find((t) => t.bankId === 'p')?.envelopeId).toBeUndefined();
  });

  it('a card payment approves as a transfer, and the card side links to it on the next sync', () => {
    const { check, card } = setup();
    useStore.getState().applyBankSync('item', result([{ id: 'out', plaidAccountId: 'pc', date: '2026-11-06', name: 'CHASE CREDIT CRD AUTOPAY', amount: -25000, pending: false }]));
    useStore.getState().approveBank('out', { type: 'transfer', accountId: card });
    useStore.getState().applyBankSync('item', result([{ id: 'in', plaidAccountId: 'pk', date: '2026-11-07', name: 'Payment Thank You', amount: 25000, pending: false }]));
    const s = useStore.getState();
    const pair = s.transactions.filter((t) => t.kind === 'transfer');
    expect(pair).toHaveLength(2);
    expect(pair.find((t) => t.accountId === check)).toMatchObject({ bankId: 'out', cleared: true });
    expect(pair.find((t) => t.accountId === card)).toMatchObject({ bankId: 'in', cleared: true });
    expect(s.bankTransactions.every((b) => b.status === 'linked')).toBe(true);
  });

  it('linking takes the bank amount, keeps envelopes adding up, and changes the other half of a transfer too', () => {
    const { check, groceries } = setup();
    useStore.getState().addTransaction({ date: '2026-11-10', accountId: check, amount: 4840, kind: 'spend', payee: 'Olive Garden', envelopeId: groceries });
    useStore.getState().applyBankSync('item', result([{ id: 'og', plaidAccountId: 'pc', date: '2026-11-11', name: 'OLIVE GARDEN 0123', amount: -5840, pending: false }]));
    const mine = useStore.getState().transactions[0];
    useStore.getState().linkBank('og', mine.id);
    const s = useStore.getState();
    expect(s.transactions[0]).toMatchObject({ amount: -5840, bankId: 'og', cleared: true });
    const ledger = computeLedger(s);
    expect(ledger.available.get(groceries)).toBe(-5840);
  });

  it('remembers a bank name that differs from yours, and uses your name next time', () => {
    const { check, groceries } = setup();
    useStore.getState().addTransaction({ date: '2026-11-10', accountId: check, amount: 450, kind: 'spend', payee: 'Joe’s Coffee', envelopeId: groceries });
    useStore.getState().applyBankSync('item', result([{ id: 'j1', plaidAccountId: 'pc', date: '2026-11-11', name: 'SQ *JAVA HUT 4411', amount: -500, pending: false }]));
    useStore.getState().linkBank('j1', useStore.getState().transactions[0].id);
    expect(useStore.getState().payees[0].bankNames).toEqual(['javahut']);
    useStore.getState().applyBankSync('item', result([{ id: 'j2', plaidAccountId: 'pc', date: '2026-11-20', name: 'SQ *JAVA HUT 4411', amount: -525, pending: false }]));
    useStore.getState().approveBank('j2', { type: 'envelope', envelopeId: groceries });
    expect(useStore.getState().transactions.find((t) => t.bankId === 'j2')?.payee).toBe('Joe’s Coffee');
  });

  it('skipping takes it off Home without adding anything', () => {
    setup();
    useStore.getState().applyBankSync('item', result([{ id: 'x', plaidAccountId: 'pc', date: '2026-11-04', name: 'X', amount: -100, pending: false }]));
    useStore.getState().skipBank('x');
    expect(useStore.getState().bankTransactions[0].status).toBe('skipped');
    expect(useStore.getState().transactions).toHaveLength(0);
  });

  it('a due bill approved from the bank posts once and moves the bill on', () => {
    const { check } = setup();
    const rid = useStore.getState().addRecurring({ name: 'Verizon', kind: 'bill', amount: 6500, accountId: check, frequency: 'monthly', nextDue: '2026-11-13' });
    useStore.getState().applyBankSync('item', result([{ id: 'v', plaidAccountId: 'pc', date: '2026-11-12', name: 'VERIZON', amount: -6512, pending: false }]));
    useStore.getState().approveBank('v', { type: 'bill', recurringId: rid });
    const s = useStore.getState();
    expect(s.transactions).toEqual([expect.objectContaining({ id: `${rid}-2026-11-13`, amount: -6512, recurringId: rid, bankId: 'v' })]);
    expect(s.recurring[0].nextDue).toBe('2026-12-13');
  });

  it('unlinking a bank keeps your transactions', () => {
    const { groceries } = setup();
    useStore.getState().applyBankSync('item', result([{ id: 'k', plaidAccountId: 'pc', date: '2026-11-04', name: 'Kroger', amount: -5000, pending: false }]));
    useStore.getState().approveBank('k', { type: 'envelope', envelopeId: groceries });
    useStore.getState().removeBankLink('item');
    const s = useStore.getState();
    expect(s.bankLinks).toHaveLength(0);
    expect(s.bankTransactions).toHaveLength(0);
    expect(s.transactions).toHaveLength(1);
    expect(s.transactions[0].bankId).toBeUndefined();
  });

  it('undo takes the lock off but keeps them posted', () => {
    const { check } = setup();
    useStore.getState().addTransaction({ date: '2026-11-02', accountId: check, amount: 100, kind: 'spend', payee: 'A' });
    const id = useStore.getState().transactions[0].id;
    useStore.getState().updateTransaction(id, { cleared: true });
    useStore.getState().reconcileTransactions(check, [id]);
    useStore.getState().unreconcile([id]);
    expect(useStore.getState().transactions[0]).toMatchObject({ reconciled: false, cleared: true });
  });
});

describe('undo', () => {
  it('puts an approved one back on Home and removes what it added', () => {
    const { groceries } = setup();
    useStore.getState().applyBankSync('item', result([{ id: 'k', plaidAccountId: 'pc', date: '2026-11-04', name: 'Kroger', amount: -5000, pending: false }]));
    useStore.getState().approveBank('k', { type: 'envelope', envelopeId: groceries });
    useStore.getState().restoreBank('k');
    expect(useStore.getState().transactions).toHaveLength(0);
    expect(useStore.getState().bankTransactions[0]).toMatchObject({ status: 'new' });
    expect(useStore.getState().bankTransactions[0].transactionId).toBeUndefined();
  });

  it('unlinks, but keeps, one you entered yourself', () => {
    const { check, groceries } = setup();
    useStore.getState().addTransaction({ date: '2026-11-10', accountId: check, amount: 4840, kind: 'spend', payee: 'Olive Garden', envelopeId: groceries });
    useStore.getState().applyBankSync('item', result([{ id: 'og', plaidAccountId: 'pc', date: '2026-11-11', name: 'OLIVE GARDEN', amount: -5840, pending: false }]));
    useStore.getState().linkBank('og', useStore.getState().transactions[0].id);
    useStore.getState().restoreBank('og');
    expect(useStore.getState().transactions).toHaveLength(1);
    expect(useStore.getState().transactions[0].bankId).toBeUndefined();
  });

  it('removes both halves of an approved transfer', () => {
    const { card } = setup();
    useStore.getState().applyBankSync('item', result([{ id: 'out', plaidAccountId: 'pc', date: '2026-11-06', name: 'AUTOPAY', amount: -25000, pending: false }]));
    useStore.getState().approveBank('out', { type: 'transfer', accountId: card });
    useStore.getState().restoreBank('out');
    expect(useStore.getState().transactions).toHaveLength(0);
  });
});
