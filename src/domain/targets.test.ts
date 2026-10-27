import { describe, expect, it } from '@jest/globals';

import { builderMonthly, monthsThrough, targetFor, targetNeed, withTarget } from './targets';

describe('targetFor', () => {
  it('falls back to the legacy target when there are no entries', () => {
    expect(targetFor({ monthlyTarget: 50000 }, '2026-10')).toBe(50000);
    expect(targetFor({}, '2026-10')).toBeNull();
  });

  it('uses the latest entry at or before the month', () => {
    const e = { monthlyTarget: 50000, targets: { '2026-11': 60000, '2027-02': null } };
    expect(targetFor(e, '2026-10')).toBe(50000);
    expect(targetFor(e, '2026-11')).toBe(60000);
    expect(targetFor(e, '2027-01')).toBe(60000);
    expect(targetFor(e, '2027-02')).toBeNull();
  });
});

describe('withTarget', () => {
  it('changing November leaves October alone', () => {
    const before = { monthlyTarget: 50000 };
    const after = { ...before, targets: withTarget(before, '2026-11', 65000) };
    expect(targetFor(after, '2026-10')).toBe(50000);
    expect(targetFor(after, '2026-11')).toBe(65000);
    expect(targetFor(after, '2026-12')).toBe(65000);
  });

  it('a later month that had its own target keeps it', () => {
    const e = { targets: { '2026-12': 30000 } };
    const after = { targets: withTarget(e, '2026-11', 20000) };
    expect(targetFor(after, '2026-11')).toBe(20000);
    expect(targetFor(after, '2026-12')).toBe(30000);
  });

  it('clearing a target only clears it from that month on', () => {
    const e = { targets: { '2026-09': 10000 } };
    const after = { targets: withTarget(e, '2026-11', null) };
    expect(targetFor(after, '2026-10')).toBe(10000);
    expect(targetFor(after, '2026-11')).toBeNull();
  });
});

describe('targetNeed by type', () => {
  const daily = { group: 'Daily' };
  const row = (carriedIn: number, assigned: number, spent = 0) => ({
    carriedIn,
    assigned,
    available: carriedIn + assigned - spent,
  });

  it('Maximum refills up to the target, counting what carried in', () => {
    expect(targetNeed(daily, 50000, row(20000, 0), '2026-10')).toBe(30000);
    expect(targetNeed(daily, 50000, row(20000, 30000, 45000), '2026-10')).toBe(0);
  });

  it('Save each month wants the full amount assigned every month', () => {
    expect(targetNeed({ ...daily, targetKind: 'goal' }, 20000, row(90000, 5000), '2026-10')).toBe(15000);
  });

  it('Bank keeps the amount in it: spending is needed back, extra stays extra', () => {
    const bank = { ...daily, targetKind: 'bank' as const };
    expect(targetNeed(bank, 100000, row(100000, 0, 25000), '2026-10')).toBe(25000);
    expect(targetNeed(bank, 100000, row(140000, 0, 25000), '2026-10')).toBe(0);
    expect(targetNeed(bank, 100000, row(0, 0), '2026-10')).toBe(100000);
  });

  it('Builder spreads what is left over the months through its date', () => {
    const christmas = { ...daily, targetKind: 'builder' as const, targetDate: '2026-12' };
    expect(monthsThrough('2026-10', '2026-12')).toBe(3);
    // $1,200 by December from October: $400 a month.
    expect(targetNeed(christmas, 120000, row(0, 0), '2026-10')).toBe(40000);
    expect(targetNeed(christmas, 120000, row(0, 10000), '2026-10')).toBe(30000);
    // $500 already in November: $700 over two months.
    expect(targetNeed(christmas, 120000, row(50000, 0), '2026-11')).toBe(35000);
    // Uneven splits round up to whole dollars.
    expect(builderMonthly(christmas, 100000, 0, '2026-10')).toBe(33400);
  });

  it('Builder is met once it reaches the amount, and stops after its date', () => {
    const christmas = { ...daily, targetKind: 'builder' as const, targetDate: '2026-12' };
    expect(targetNeed(christmas, 120000, row(130000, 0), '2026-12')).toBe(0);
    expect(targetNeed(christmas, 120000, row(0, 0), '2027-01')).toBe(0);
    // In its last month it asks for everything left.
    expect(targetNeed(christmas, 120000, row(80000, 0), '2026-12')).toBe(40000);
  });
});
