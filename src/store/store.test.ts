import { beforeEach, describe, expect, it } from '@jest/globals';

import { today } from '@/domain/dates';
import { computeLedger } from '@/domain/ledger';
import { targetFor, targetSetFor } from '@/domain/targets';

import { isLocked, resetStore, useStore } from './index';

beforeEach(() => resetStore());

function setup() {
  const s = useStore.getState();
  const account = s.addAccount({ name: 'Checking', kind: 'checking', balance: 100000 });
  const groceries = s.addEnvelope({ name: 'Groceries', group: 'Daily' });
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
    useStore.getState().setFlag(b, 'red');
    const skipped = useStore.getState().reconcileTransactions(account, [a, b]);
    expect(skipped).toEqual([b]);
    const [ta, tb] = useStore.getState().transactions;
    expect(isLocked(ta)).toBe(true);
    expect(ta.cleared).toBe(true);
    expect(isLocked(tb)).toBe(false);
  });

  it('keeps a flag color and clears it', () => {
    const { account, groceries } = setup();
    const id = useStore.getState().addTransaction({ date: '2026-10-01', accountId: account, amount: 500, kind: 'spend', payee: 'A', envelopeId: groceries });
    useStore.getState().setFlag(id, 'blue');
    let t = useStore.getState().transactions.find((x) => x.id === id)!;
    expect(t.flagged).toBe(true);
    expect(t.flagColor).toBe('blue');
    useStore.getState().setFlag(id, null);
    t = useStore.getState().transactions.find((x) => x.id === id)!;
    expect(t.flagged).toBe(false);
    expect(t.flagColor).toBeUndefined();
  });

  it('posts a reconciled adjustment for a leftover difference', () => {
    const { account } = setup();
    useStore.getState().addAdjustment(account, -1234);
    expect(useStore.getState().transactions[0]).toMatchObject({ kind: 'adjustment', amount: -1234, reconciled: true });
  });
});

describe('targets', () => {
  it('a new envelope’s target starts in the given month', () => {
    const id = useStore.getState().addEnvelope({ name: 'Gas', group: 'Daily', monthlyTarget: 16000, month: '2026-10' });
    const e = useStore.getState().envelopes.find((x) => x.id === id)!;
    expect(targetFor(e, '2026-09')).toBeNull();
    expect(targetFor(e, '2026-10')).toBe(16000);
  });

  it('changing November leaves October alone', () => {
    const id = useStore.getState().addEnvelope({ name: 'Gas', group: 'Daily', monthlyTarget: 16000, month: '2026-10' });
    useStore.getState().setTarget(id, '2026-11', 20000);
    const e = useStore.getState().envelopes.find((x) => x.id === id)!;
    expect(targetFor(e, '2026-10')).toBe(16000);
    expect(targetFor(e, '2026-11')).toBe(20000);
  });
});

describe('editing transactions', () => {
  it('moves spending to a card as a slip and back, keeping its id', () => {
    const { account, groceries } = setup();
    const s = useStore.getState();
    const card = s.addAccount({ name: 'Visa', kind: 'credit_card', balance: -20000 });
    const id = s.addTransaction({ date: '2026-10-01', accountId: account, amount: 500, kind: 'spend', payee: 'Kroger', envelopeId: groceries });
    useStore.getState().reconcileTransactions(account, [id]);
    useStore.getState().updateTransaction(id, { accountId: card });
    let t = useStore.getState().transactions.find((x) => x.id === id)!;
    expect(t).toMatchObject({ accountId: card, kind: 'slip', amount: -500, reconciled: false });
    useStore.getState().updateTransaction(id, { accountId: account });
    t = useStore.getState().transactions.find((x) => x.id === id)!;
    expect(t).toMatchObject({ accountId: account, kind: 'spend' });
  });
});

describe('sorting envelopes', () => {
  it('saves group order and moves envelopes between groups', () => {
    const { groceries } = setup();
    const s = useStore.getState();
    const rent = s.addEnvelope({ name: 'Rent', group: 'Bills' });
    const gas = s.addEnvelope({ name: 'Gas', group: 'Daily' });
    useStore.getState().reorderEnvelopes([
      { name: 'Daily', ids: [groceries] },
      { name: 'Bills', ids: [gas, rent] },
    ]);
    const after = useStore.getState();
    expect(after.settings.groupOrder).toEqual(['Daily', 'Bills']);
    expect(after.envelopes.find((e) => e.id === gas)).toMatchObject({ group: 'Bills', order: 0 });
    expect(after.envelopes.find((e) => e.id === rent)).toMatchObject({ group: 'Bills', order: 1 });
  });
});

describe('fixed groups', () => {
  it('renames Everyday to Daily and folds custom groups and loose Bills envelopes into Daily', () => {
    useStore.setState({
      envelopes: [
        { id: 'a', name: 'Groceries', group: 'Everyday', order: 0 },
        { id: 'b', name: 'Dates', group: 'Fun stuff', order: 1 },
        { id: 'c', name: 'Rent', group: 'Bills', order: 2 },
        { id: 'd', name: 'Visa', group: 'Debt payments', order: 0, debtAccountId: 'x' },
      ],
      settings: { debtStrategy: 'snowball', monthlyDebtPayment: 0, groupOrder: ['Bills', 'Everyday', 'Fun stuff'] },
    });
    const visa = useStore.getState().envelopes[3];
    useStore.getState().normalizeGroups();
    const s = useStore.getState();
    // Rent has no bill behind it, so it can't stay in Bills.
    expect(s.envelopes.map((e) => e.group)).toEqual(['Daily', 'Daily', 'Daily', 'Debt payments']);
    expect(s.envelopes[3]).toBe(visa);
    expect(s.settings.groupOrder).toEqual(['Bills', 'Daily']);
  });

  it('ties each recurring item to its own envelope in Bills or Subscriptions', () => {
    const { account } = setup();
    useStore.setState({
      envelopes: [
        { id: 'rent', name: 'Rent', group: 'Bills', order: 0 },
        { id: 'tv', name: 'Streaming', group: 'Daily', order: 1 },
      ],
      recurring: [
        { id: 'r1', name: 'Rent', kind: 'bill', amount: 120000, accountId: account, frequency: 'monthly', nextDue: '2026-11-01', envelopeId: 'rent', active: true },
        { id: 'r2', name: 'Netflix', kind: 'subscription', amount: 1549, accountId: account, frequency: 'monthly', nextDue: '2026-11-03', envelopeId: 'tv', active: true },
        { id: 'r3', name: 'Hulu', kind: 'subscription', amount: 999, accountId: account, frequency: 'monthly', nextDue: '2026-11-05', envelopeId: 'tv', active: true },
      ],
    });
    useStore.getState().normalizeGroups();
    const s = useStore.getState();
    expect(s.envelopes.find((e) => e.id === 'rent')).toMatchObject({ group: 'Bills', recurringId: 'r1' });
    // An ordinary envelope is never taken over and renamed: Netflix and Hulu each get their own.
    expect(s.envelopes.find((e) => e.id === 'tv')).toMatchObject({ name: 'Streaming', group: 'Daily' });
    for (const [rid, name] of [['r2', 'Netflix'], ['r3', 'Hulu']]) {
      const r = s.recurring.find((x) => x.id === rid)!;
      expect(r.envelopeId).not.toBe('tv');
      expect(s.envelopes.find((e) => e.id === r.envelopeId)).toMatchObject({ name, group: 'Subscriptions', recurringId: rid });
    }
  });

  it('does nothing when every group is already valid', () => {
    setup();
    const before = useStore.getState();
    useStore.getState().normalizeGroups();
    expect(useStore.getState().envelopes).toBe(before.envelopes);
    expect(useStore.getState().settings).toBe(before.settings);
  });
});

describe('recurring envelopes', () => {
  const bill = (account: string) =>
    ({ name: 'Verizon', kind: 'bill', amount: 6550, accountId: account, frequency: 'monthly', nextDue: '2026-11-01' }) as const;

  it('makes a Bills envelope budgeted to the monthly cost, in whole dollars', () => {
    const { account } = setup();
    const id = useStore.getState().addRecurring(bill(account));
    const s = useStore.getState();
    const r = s.recurring.find((x) => x.id === id)!;
    const e = s.envelopes.find((x) => x.id === r.envelopeId)!;
    expect(e).toMatchObject({ name: 'Verizon', group: 'Bills', recurringId: id });
    expect(Object.values(e.targets ?? {})).toEqual([6600]);
  });

  it('turns a weekly amount into a monthly target', () => {
    const { account } = setup();
    const id = useStore.getState().addRecurring({ ...bill(account), name: 'Lawn care', amount: 2500, frequency: 'weekly' });
    const r = useStore.getState().recurring.find((x) => x.id === id)!;
    const e = useStore.getState().envelopes.find((x) => x.id === r.envelopeId)!;
    // 25 × 52 / 12 = 108.33, rounded up.
    expect(Object.values(e.targets ?? {})).toEqual([10900]);
  });

  it('follows renames, amount and kind changes, and hides the envelope when deleted', () => {
    const { account } = setup();
    const id = useStore.getState().addRecurring(bill(account));
    const envelopeId = useStore.getState().recurring[0].envelopeId!;
    useStore.getState().updateRecurring(id, { name: 'Verizon Wireless', amount: 8000 });
    let e = useStore.getState().envelopes.find((x) => x.id === envelopeId)!;
    expect(e.name).toBe('Verizon Wireless');
    expect(Object.values(e.targets ?? {}).at(-1)).toBe(8000);
    useStore.getState().updateRecurring(id, { kind: 'subscription' });
    e = useStore.getState().envelopes.find((x) => x.id === envelopeId)!;
    expect(e.group).toBe('Subscriptions');
    useStore.getState().deleteRecurring(id);
    e = useStore.getState().envelopes.find((x) => x.id === envelopeId)!;
    expect(e.hidden).toBe(true);
  });

  it('approving spends from the linked envelope', () => {
    const { account } = setup();
    const id = useStore.getState().addRecurring({ ...bill(account), nextDue: '2026-10-01' });
    useStore.getState().approveRecurring(id);
    const s = useStore.getState();
    expect(s.transactions[0].envelopeId).toBe(s.recurring[0].envelopeId);
  });

  it('puts subscriptions in their own group', () => {
    const { account } = setup();
    useStore.getState().addRecurring({ ...bill(account), name: 'Spotify', kind: 'subscription', amount: 1199 });
    const s = useStore.getState();
    expect(s.envelopes.find((e) => e.id === s.recurring[0].envelopeId)).toMatchObject({ group: 'Subscriptions' });
  });
});

describe('editing an account', () => {
  it('changes the balance and Ready to assign when the starting balance changes', () => {
    const { account } = setup();
    const s = useStore.getState();
    s.addTransaction({ date: today(), accountId: account, amount: 2500, kind: 'income', payee: 'Refund' });
    const before = computeLedger(useStore.getState());
    useStore.getState().updateAccount(account, { openingBalance: 150000 });
    const after = computeLedger(useStore.getState());
    expect(after.balance.get(account)).toBe(152500);
    expect(after.readyToAssign - before.readyToAssign).toBe(50000);
  });

  it('keeps a debt negative and its payment envelope named after it', () => {
    const s = useStore.getState();
    const card = s.addAccount({ name: 'Visa', kind: 'credit_card', balance: 50000 });
    useStore.getState().updateAccount(card, { name: 'Chase Visa', kind: 'credit_card', openingBalance: -60000 });
    const ledger = computeLedger(useStore.getState());
    expect(ledger.balance.get(card)).toBe(-60000);
    expect(useStore.getState().envelopes.find((e) => e.debtAccountId === card)?.name).toBe('Chase Visa');
  });
});

describe('snoozing a target', () => {
  it('skips the target for that month only and keeps the target itself', () => {
    const { groceries } = setup();
    const s = useStore.getState();
    s.setTarget(groceries, '2026-10', 40000);
    s.snoozeTarget(groceries, '2026-10', true);
    const e = useStore.getState().envelopes.find((x) => x.id === groceries)!;
    expect(targetFor(e, '2026-10')).toBeNull();
    expect(targetFor(e, '2026-11')).toBe(40000);
    expect(targetSetFor(e, '2026-10')).toBe(40000);
    useStore.getState().snoozeTarget(groceries, '2026-10', false);
    expect(targetFor(useStore.getState().envelopes.find((x) => x.id === groceries)!, '2026-10')).toBe(40000);
  });
});

describe('bill targets', () => {
  it('a yearly bill builds up to the full amount by its due month', () => {
    const { account } = setup();
    const rid = useStore.getState().addRecurring({ name: 'Progressive', kind: 'bill', amount: 200300, accountId: account, frequency: 'yearly', nextDue: '2026-12-03' });
    const e = useStore.getState().envelopes.find((x) => x.recurringId === rid)!;
    expect(e).toMatchObject({ targetKind: 'repeat', targetDate: '2026-12', targetEvery: 12 });
    expect(Object.values(e.targets!)).toEqual([200300]);
  });

  it('switches old yearly bills once, and approving keeps the target', () => {
    const { account } = setup();
    const rid = useStore.getState().addRecurring({ name: 'Progressive', kind: 'bill', amount: 200300, accountId: account, frequency: 'monthly', nextDue: '2026-12-03' });
    // An envelope from before: a twelfth a month, no target type.
    useStore.setState((s) => ({
      recurring: s.recurring.map((r) => (r.id === rid ? { ...r, frequency: 'yearly' as const } : r)),
      envelopes: s.envelopes.map((e) => (e.recurringId === rid ? { ...e, targets: { '2026-10': 16700 } } : e)),
    }));
    useStore.getState().fixBillTargets();
    useStore.getState().fixBillTargets();
    const e = useStore.getState().envelopes.find((x) => x.recurringId === rid)!;
    expect(e).toMatchObject({ targetKind: 'repeat', targetDate: '2026-12', targetEvery: 12 });
    expect(e.targets!['2026-10']).toBe(16700);
    expect(Object.values(e.targets!)).toContain(200300);
    useStore.getState().approveRecurring(rid);
    expect(useStore.getState().envelopes.find((x) => x.recurringId === rid)).toMatchObject({ targetDate: '2026-12' });
  });

  it('a monthly bill still budgets what it costs a month', () => {
    const { account } = setup();
    const rid = useStore.getState().addRecurring({ name: 'Verizon', kind: 'bill', amount: 6512, accountId: account, frequency: 'monthly', nextDue: '2026-11-20' });
    const e = useStore.getState().envelopes.find((x) => x.recurringId === rid)!;
    expect(e.targetKind).toBeUndefined();
    expect(Object.values(e.targets!)).toEqual([6600]);
  });
});
