import { describe, expect, it } from '@jest/globals';

import { targetFor, withTarget } from './targets';

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
