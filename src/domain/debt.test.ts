import { describe, expect, it } from '@jest/globals';
import { comparePlan, interestFromStatement, orderDebts, project, type DebtInput } from './debt';

const debts: DebtInput[] = [
  { id: 'big', name: 'Car', balance: 1200000, apr: 699, minPayment: 30000 },
  { id: 'small', name: 'Store card', balance: 80000, apr: 2699, minPayment: 3500 },
  { id: 'mid', name: 'Visa', balance: 450000, apr: 2299, minPayment: 13500 },
];

describe('orderDebts', () => {
  it('snowball goes smallest balance first', () => {
    expect(orderDebts(debts, 'snowball').map((d) => d.id)).toEqual(['small', 'mid', 'big']);
  });
  it('avalanche goes highest APR first', () => {
    expect(orderDebts(debts, 'avalanche').map((d) => d.id)).toEqual(['small', 'mid', 'big']);
    const flipped = debts.map((d) => (d.id === 'big' ? { ...d, apr: 3000 } : d));
    expect(orderDebts(flipped, 'avalanche')[0].id).toBe('big');
  });
});

describe('project', () => {
  it('pays a single debt off with the expected interest', () => {
    // $1,000 at 12% APR, $100/month: 11 months, about $58 interest.
    const p = project([{ id: 'a', name: 'A', balance: 100000, apr: 1200, minPayment: 10000 }], 10000, 'snowball');
    expect(p.months).toBe(11);
    expect(p.totalInterest).toBeGreaterThan(5500);
    expect(p.totalInterest).toBeLessThan(6000);
    expect(p.balances[p.balances.length - 1]).toBe(0);
  });

  it('pays the smallest debt first under snowball', () => {
    const p = project(debts, 100000, 'snowball');
    const byId = Object.fromEntries(p.perDebt.map((d) => [d.id, d.payoffMonth!]));
    expect(byId.small).toBeLessThan(byId.mid);
    expect(byId.mid).toBeLessThan(byId.big);
  });

  it('tracks each debt month by month, hitting zero on its payoff month', () => {
    const p = project(debts, 100000, 'snowball');
    for (const d of p.perDebt) {
      const series = p.perDebtBalances[d.id];
      expect(series[0]).toBe(debts.find((x) => x.id === d.id)!.balance);
      expect(series[d.payoffMonth!]).toBe(0);
      expect(series[d.payoffMonth! - 1]).toBeGreaterThan(0);
      expect(series).toHaveLength(p.balances.length);
    }
    // The totals line is the sum of the per-debt lines.
    p.balances.forEach((total, m) =>
      expect(Object.values(p.perDebtBalances).reduce((a, s) => a + s[m], 0)).toBe(total),
    );
  });

  it('reports a plan that never finishes when payments do not cover interest', () => {
    const p = project([{ id: 'a', name: 'A', balance: 1000000, apr: 3000, minPayment: 1000 }], 1000, 'snowball');
    expect(p.months).toBeNull();
  });
});

describe('comparePlan', () => {
  it('extra payments save interest and months versus minimums only', () => {
    const c = comparePlan(debts, 100000, 'snowball');
    expect(c.interestSaved).toBeGreaterThan(0);
    expect(c.monthsSaved).toBeGreaterThan(0);
    expect(c.plan.months).toBeLessThan(c.minimumsOnly.months!);
  });

  it('never plans below the sum of minimums', () => {
    const c = comparePlan(debts, 0, 'snowball');
    expect(c.plan.months).not.toBeNull();
  });
});

describe('interestFromStatement', () => {
  it('is whatever the statement shows beyond what the app tracked', () => {
    expect(interestFromStatement(306200, 300000)).toBe(6200);
  });
});
