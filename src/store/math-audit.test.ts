import { beforeEach, describe, expect, it } from '@jest/globals';

import { cleanAmount, cleanDollars, showAmount } from '@/domain/amount-text';
import { comparePlan, debtTarget, project } from '@/domain/debt';
import { computeLedger } from '@/domain/ledger';
import { addMonthKey, computeMonth, monthOf } from '@/domain/months';
import { ceilDollars, floorDollars, parseMoney } from '@/domain/money';
import { isCashAccount } from '@/domain/types';

import { generateDemo } from './demo-data';
import { resetStore, useStore } from './index';

const AS_OF = '2026-10-23';
const demo = generateDemo(AS_OF);
const sumAvailable = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);

describe('math across the demo data', () => {
  const ledger = computeLedger(demo);

  it('every dollar of cash is in an envelope or Ready to assign', () => {
    expect(ledger.readyToAssign + sumAvailable(ledger.available)).toBe(ledger.cashTotal);
  });

  it('Home and Budget show the same Ready to assign this month', () => {
    expect(computeMonth(demo, monthOf(AS_OF)).readyToAssign).toBe(ledger.readyToAssign);
  });

  it('account balances are the opening balance plus every transaction', () => {
    for (const a of demo.accounts) {
      const sum = demo.transactions.filter((t) => t.accountId === a.id).reduce((s, t) => s + t.amount, 0);
      expect(ledger.balance.get(a.id)).toBe(a.openingBalance + sum);
    }
    const cash = demo.accounts.filter(isCashAccount).reduce((s, a) => s + ledger.balance.get(a.id)!, 0);
    expect(ledger.cashTotal).toBe(cash);
  });

  it('what a month carries in is what the month before ended with', () => {
    const months = [...new Set(demo.transactions.map((t) => monthOf(t.date)))].sort();
    for (let i = 1; i < months.length; i++) {
      const before = computeMonth(demo, months[i - 1]);
      const now = computeMonth(demo, months[i]);
      for (const e of demo.envelopes) {
        expect(now.envelopes.get(e.id)!.carriedIn).toBe(before.envelopes.get(e.id)!.available);
      }
    }
  });

  it('this month in the budget matches the envelopes right now', () => {
    const month = computeMonth(demo, monthOf(AS_OF));
    for (const e of demo.envelopes) expect(month.envelopes.get(e.id)!.available).toBe(ledger.available.get(e.id));
  });

  it('transfers net to zero and signs match their kind', () => {
    const pairs = new Map<string, number>();
    for (const t of demo.transactions) {
      if (t.transferPairId) pairs.set(t.transferPairId, (pairs.get(t.transferPairId) ?? 0) + t.amount);
      if (t.kind === 'spend' || t.kind === 'slip') expect(t.amount).toBeLessThan(0);
      if (t.kind === 'income') expect(t.amount).toBeGreaterThan(0);
    }
    for (const total of pairs.values()) expect(total).toBe(0);
  });

  it('a later month never runs ahead of the next', () => {
    const next = addMonthKey(monthOf(AS_OF), 1);
    expect(computeMonth(demo, next).cash).toBe(ledger.cashTotal);
  });
});

describe('math through the store, one action at a time', () => {
  beforeEach(() => resetStore());
  const check = () => {
    const s = useStore.getState();
    const l = computeLedger(s);
    expect(l.readyToAssign + sumAvailable(l.available)).toBe(l.cashTotal);
    return l;
  };

  it('keeps the core rule through spending, slips, payments, edits and adjustments', () => {
    const s = useStore.getState();
    const checking = s.addAccount({ name: 'Checking', kind: 'checking', balance: 200000 });
    const card = s.addAccount({ name: 'Visa', kind: 'credit_card', balance: 50000, apr: 2499, minPayment: 3500 });
    const food = s.addEnvelope({ name: 'Food', group: 'Daily' });
    const pay = useStore.getState().envelopes.find((e) => e.debtAccountId === card)!.id;
    let l = check();
    expect(l.readyToAssign).toBe(200000);
    expect(l.debtTotal).toBe(50000);

    useStore.getState().assign(food, 30000);
    l = check();
    expect(l.readyToAssign).toBe(170000);

    // $27.25 at the store: the envelope drops by exactly that.
    const spend = useStore.getState().addTransaction({ date: AS_OF, accountId: checking, amount: 2725, kind: 'spend', payee: 'Kroger', envelopeId: food });
    l = check();
    expect(l.available.get(food)).toBe(27275);
    expect(l.balance.get(checking)).toBe(197275);

    // A $40 slip: food pays, the card's payment envelope holds the cash for it.
    useStore.getState().addTransaction({ date: AS_OF, accountId: card, amount: 4000, kind: 'slip', payee: 'Shell', envelopeId: food });
    l = check();
    expect(l.available.get(food)).toBe(23275);
    expect(l.available.get(pay)).toBe(4000);
    expect(l.debtTotal).toBe(54000);

    // Paying the card from checking empties the payment envelope; cash and debt both drop.
    useStore.getState().transfer({ fromAccountId: checking, toAccountId: card, amount: 4000, date: AS_OF });
    l = check();
    expect(l.available.get(pay)).toBe(0);
    expect(l.debtTotal).toBe(50000);
    expect(l.balance.get(checking)).toBe(193275);

    // Income lands in Ready to assign.
    const before = l.readyToAssign;
    useStore.getState().addTransaction({ date: AS_OF, accountId: checking, amount: 100000, kind: 'income', payee: 'Paycheck' });
    l = check();
    expect(l.readyToAssign).toBe(before + 100000);

    // Editing the amount keeps the sign; moving it to the card turns it into a slip.
    useStore.getState().updateTransaction(spend, { amount: 3000 });
    l = check();
    expect(useStore.getState().transactions.find((t) => t.id === spend)!.amount).toBe(-3000);
    useStore.getState().updateTransaction(spend, { accountId: card });
    l = check();
    expect(useStore.getState().transactions.find((t) => t.id === spend)!.kind).toBe('slip');
    expect(l.available.get(pay)).toBe(3000);

    // An error adjustment moves the balance to what you typed and goes to Ready to assign.
    const rta = l.readyToAssign;
    useStore.getState().addAdjustment(checking, 1234, { fix: true });
    l = check();
    expect(l.readyToAssign).toBe(rta + 1234);

    useStore.getState().deleteTransaction(spend);
    check();
  });
});

describe('typing amounts', () => {
  it('fills from the right like YNAB', () => {
    expect(cleanAmount('4')).toBe('0.04');
    expect(cleanAmount('$0.044')).toBe('0.44');
    expect(cleanAmount('$0.443')).toBe('4.43');
    expect(cleanAmount('$4.435')).toBe('44.35');
    expect(cleanAmount('$44.357')).toBe('443.57');
    expect(cleanAmount('$0.0')).toBe('');
    expect(cleanAmount('$1,234.567')).toBe('12345.67');
    expect(parseMoney(cleanAmount('$1,234.567'))).toBe(1234567);
  });
  it('flips the sign with a minus when allowed', () => {
    expect(cleanAmount('$12.00-', true)).toBe('-12.00');
    expect(cleanAmount('-$12.00-', true)).toBe('12.00');
    expect(cleanAmount('$12.00-', false)).toBe('12.00');
    expect(showAmount('-1234.50')).toBe('-$1,234.50');
  });
  it('budget amounts are whole dollars', () => {
    expect(cleanDollars('$1,2005')).toBe('12005');
    expect(cleanDollars('007')).toBe('7');
  });
});

describe('budget rounding', () => {
  it('spending rounds up, money left and to assign round down', () => {
    expect(ceilDollars(2725)).toBe(2800);
    expect(ceilDollars(2657)).toBe(2700);
    expect(ceilDollars(2700)).toBe(2700);
    expect(floorDollars(3000027)).toBe(3000000);
    expect(floorDollars(-1320)).toBe(-1400); // overspent $13.20 shows as -$14
  });
});

describe('debt math', () => {
  const debts = [
    { id: 'a', name: 'Small high', balance: 100000, apr: 2999, minPayment: 3000 },
    { id: 'b', name: 'Big low', balance: 500000, apr: 500, minPayment: 10000 },
    { id: 'c', name: 'Mid highest', balance: 300000, apr: 3500, minPayment: 9000 },
  ];
  it('pays exactly what was owed plus the interest', () => {
    const p = project(debts, 50000, 'snowball');
    expect(p.months).not.toBeNull();
    expect(p.totalPaid).toBe(900000 + p.totalInterest);
  });
  it('snowball goes smallest first, avalanche highest rate first', () => {
    expect(project(debts, 50000, 'snowball').perDebt.map((d) => d.id)).toEqual(['a', 'c', 'b']);
    expect(project(debts, 50000, 'avalanche').perDebt.map((d) => d.id)).toEqual(['c', 'a', 'b']);
  });
  it('avalanche never costs more interest than snowball', () => {
    const s = comparePlan(debts, 50000, 'snowball').plan.totalInterest;
    const a = comparePlan(debts, 50000, 'avalanche').plan.totalInterest;
    expect(a).toBeLessThanOrEqual(s);
  });
  it('one month of interest is balance × rate ÷ 12', () => {
    const p = project([{ id: 'x', name: 'x', balance: 120000, apr: 1200, minPayment: 0 }], 0, 'snowball');
    expect(p.perDebtBalances.x[1]).toBe(121200);
  });
  it('the payment target is the minimum unless set, never more than owed', () => {
    expect(debtTarget({ minPayment: 3500 }, 100000)).toBe(3500);
    expect(debtTarget({ minPayment: 3500, paymentTarget: 20000 }, 100000)).toBe(20000);
    expect(debtTarget({ minPayment: 3500, paymentTarget: 20000 }, 12000)).toBe(12000);
    expect(debtTarget({ minPayment: 3500 }, 0)).toBe(0);
  });
});

describe('bills and odd amounts', () => {
  beforeEach(() => resetStore());
  it('approving the same bill twice posts it once', () => {
    const s = useStore.getState();
    const checking = s.addAccount({ name: 'Checking', kind: 'checking', balance: 100000 });
    s.addRecurring({ name: 'Netflix', kind: 'subscription', amount: 1549, accountId: checking, frequency: 'monthly', nextDue: '2026-10-20' });
    const r = useStore.getState().recurring[0];
    useStore.getState().approveRecurring(r.id);
    // A second phone that hadn't seen the first approval yet.
    useStore.setState((st) => ({ recurring: st.recurring.map((x) => ({ ...x, nextDue: '2026-10-20' })) }));
    useStore.getState().approveRecurring(r.id);
    expect(useStore.getState().transactions.filter((t) => t.recurringId === r.id)).toHaveLength(1);
  });
  it('money fields take a lone minus first', () => {
    expect(cleanAmount('-', true)).toBe('-');
    expect(cleanAmount('-$5', true)).toBe('-0.05');
    expect(showAmount('-')).toBe('-$');
  });
});
