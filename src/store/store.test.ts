import { beforeEach, describe, expect, it } from '@jest/globals';

import { targetFor } from '@/domain/targets';

import { isLocked, resetStore, useStore } from './index';

beforeEach(() => resetStore());

function setup() {
  const s = useStore.getState();
  const account = s.addAccount({ name: 'Checking', kind: 'checking', balance: 100000 });
  const groceries = s.addEnvelope({ name: 'Groceries', group: 'Everyday' });
  return { account, groceries };
}

describe('payees', () => {
  it('learns payees and their envelope from transactions', () => {
    const { account, groceries } = setup();
    useStore.getState().addTransaction({ date: '2026-10-01', accountId: account, amount: 500, kind: 'spend', payee: 'Kroger', envelopeId: groceries });
    useStore.getState().addTransaction({ date: '2026-10-02', accountId: account, amount: 700, kind: 'spend', payee: 'kroger', envelopeId: groceries });
    const payees = useStore.getState().payees;
    expect(payees).toHaveLength(1);
    expect(payees[0]).toMatchObject({ name: 'Kroger', envelopeId: groceries });
  });

  it('moves the old merchant memory into payees once', () => {
    const { account, groceries } = setup();
    useStore.setState({
      merchantMemory: { kroger: groceries },
      transactions: [{ id: 't', date: '2026-10-01', accountId: account, amount: -500, kind: 'spend', payee: 'Kroger', cleared: false, createdAt: 0 }],
    });
    useStore.getState().migrateMerchantMemory();
    useStore.getState().migrateMerchantMemory();
    expect(useStore.getState().payees).toEqual([expect.objectContaining({ name: 'Kroger', envelopeId: groceries })]);
  });

  it('can be renamed, re-pointed and deleted', () => {
    const { groceries } = setup();
    const s = useStore.getState();
    const id = s.addPayee('Aldi');
    s.setPayeeEnvelope(id, groceries);
    s.renamePayee(id, 'ALDI');
    expect(useStore.getState().payees[0]).toMatchObject({ name: 'ALDI', envelopeId: groceries });
    useStore.getState().deletePayee(id);
    expect(useStore.getState().payees).toEqual([]);
  });
});

describe('reconciling', () => {
  it('locks selected transactions and skips flagged ones', () => {
    const { account, groceries } = setup();
    const s = useStore.getState();
    const a = s.addTransaction({ date: '2026-10-01', accountId: account, amount: 500, kind: 'spend', payee: 'A', envelopeId: groceries });
    const b = s.addTransaction({ date: '2026-10-02', accountId: account, amount: 700, kind: 'spend', payee: 'B', envelopeId: groceries });
    useStore.getState().setFlag(b, true);
    const skipped = useStore.getState().reconcileTransactions(account, [a, b]);
    expect(skipped).toEqual([b]);
    const [ta, tb] = useStore.getState().transactions;
    expect(isLocked(ta)).toBe(true);
    expect(ta.cleared).toBe(true);
    expect(isLocked(tb)).toBe(false);
  });

  it('posts a reconciled adjustment for a leftover difference', () => {
    const { account } = setup();
    useStore.getState().addAdjustment(account, -1234);
    expect(useStore.getState().transactions[0]).toMatchObject({ kind: 'adjustment', amount: -1234, reconciled: true });
  });
});

describe('targets', () => {
  it('a new envelope’s target starts in the given month', () => {
    const id = useStore.getState().addEnvelope({ name: 'Gas', group: 'Everyday', monthlyTarget: 16000, month: '2026-10' });
    const e = useStore.getState().envelopes.find((x) => x.id === id)!;
    expect(targetFor(e, '2026-09')).toBeNull();
    expect(targetFor(e, '2026-10')).toBe(16000);
  });

  it('changing November leaves October alone', () => {
    const id = useStore.getState().addEnvelope({ name: 'Gas', group: 'Everyday', monthlyTarget: 16000, month: '2026-10' });
    useStore.getState().setTarget(id, '2026-11', 20000);
    const e = useStore.getState().envelopes.find((x) => x.id === id)!;
    expect(targetFor(e, '2026-10')).toBe(16000);
    expect(targetFor(e, '2026-11')).toBe(20000);
  });
});
