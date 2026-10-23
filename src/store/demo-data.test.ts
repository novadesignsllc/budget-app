import { describe, expect, it } from '@jest/globals';

import { computeLedger } from '@/domain/ledger';
import { addMonthKey, computeMonth, monthEnd, monthOf } from '@/domain/months';
import { dueForApproval } from '@/domain/recurring';
import { targetFor } from '@/domain/targets';
import { isCashAccount } from '@/domain/types';

import { demoDocs, generateDemo } from './demo-data';

const AS_OF = '2026-10-23';
const demo = generateDemo(AS_OF);

describe('generateDemo', () => {
  it('is the same every time for the same day', () => {
    expect(generateDemo(AS_OF)).toEqual(demo);
  });

  it('keeps every dollar accounted for in every month', () => {
    const months = [...new Set(demo.transactions.map((t) => monthOf(t.date)))].sort();
    expect(months.length).toBeGreaterThanOrEqual(6);
    for (const m of [...months, addMonthKey(months[months.length - 1], 1)]) {
      const b = computeMonth(demo, m);
      let sum = 0;
      for (const r of b.envelopes.values()) sum += r.available;
      const [y, mo] = m.split('-').map(Number);
      const endTime = new Date(y, mo, 0, 23, 59, 59, 999).getTime();
      const later = demo.allocations
        .filter((a) => a.date > monthEnd(m) && a.createdAt <= endTime)
        .reduce((s, a) => s + a.amount, 0);
      expect(b.readyToAssign + sum + later).toBe(b.cash);
    }
  });

  it('shows every past month with money left to assign, not a negative pool', () => {
    const months = [...new Set(demo.transactions.map((t) => monthOf(t.date)))].sort();
    for (const m of months) expect(computeMonth(demo, m).readyToAssign).toBeGreaterThanOrEqual(0);
  });

  it('never lets a cash account go negative at a month end', () => {
    const months = [...new Set(demo.transactions.map((t) => monthOf(t.date)))].sort();
    for (const m of months) {
      for (const a of demo.accounts.filter(isCashAccount)) {
        const balance = demo.transactions
          .filter((t) => t.accountId === a.id && t.date <= monthEnd(m))
          .reduce((s, t) => s + t.amount, a.openingBalance);
        expect(balance).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('has the history the screens need', () => {
    const ledger = computeLedger(demo);
    expect(demo.transactions.filter((t) => t.kind === 'income').length).toBeGreaterThanOrEqual(12);
    expect(demo.transactions.some((t) => t.kind === 'slip')).toBe(true);
    expect(demo.transactions.some((t) => t.kind === 'interest')).toBe(true);
    expect(demo.transactions.every((t) => t.date <= AS_OF)).toBe(true);
    expect(dueForApproval(demo.recurring, AS_OF).length).toBeGreaterThan(0);
    expect(ledger.readyToAssign).toBeGreaterThan(0);
    expect(ledger.readyToAssign).toBeLessThan(10000);
    expect(ledger.debtTotal).toBeGreaterThan(0);
    // Some envelope is overspent this month, so that state shows up.
    const now = computeMonth(demo, '2026-10');
    expect([...now.envelopes.values()].some((r) => r.available < 0)).toBe(true);
    expect(Object.keys(demo.merchantMemory).length).toBeGreaterThan(10);
  });

  it('uses flags, reconciling, notes, payees and per-month targets', () => {
    const flagged = demo.transactions.filter((t) => t.flagged);
    expect(flagged.length).toBe(2);
    expect(flagged.every((t) => !t.reconciled)).toBe(true);
    expect(demo.transactions.filter((t) => t.reconciled).length).toBeGreaterThan(50);
    expect(demo.transactions.filter((t) => t.memo).length).toBeGreaterThanOrEqual(3);
    expect(demo.payees.length).toBeGreaterThan(10);
    expect(demo.payees.find((p) => p.name === 'Kroger')?.envelopeId).toBe(demo.envelopes.find((e) => e.name === 'Groceries')!.id);
    const groceries = demo.envelopes.find((e) => e.name === 'Groceries')!;
    expect(targetFor(groceries, '2026-09')).toBe(52000);
    expect(targetFor(groceries, '2026-10')).toBe(56000);
    expect(computeMonth(demo, '2026-10').envelopes.get(groceries.id)?.assigned).toBeGreaterThanOrEqual(56000);
  });

  it('serializes to docs without undefined values', () => {
    const docs = demoDocs(AS_OF);
    expect(JSON.stringify(docs)).not.toContain('undefined');
    expect(docs.meta[0].id).toBe('state');
    expect(docs.transactions.length).toBe(demo.transactions.length);
  });
});
