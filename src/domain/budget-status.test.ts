import { describe, expect, it } from '@jest/globals';

import { budgetStatus } from './budget-status';
import type { EnvelopeMonth } from './months';
import type { Envelope } from './types';

const env = (id: string, group = 'Daily'): Envelope => ({ id, name: id, group, order: 0 });
const row = (available: number, spent: number): EnvelopeMonth => ({ assigned: 0, activity: -spent, spent, carriedIn: 0, available });

describe('budgetStatus', () => {
  const envelopes = [env('food'), env('gas'), env('rent', 'Bills')];
  it('is on track when spending keeps pace with the month', () => {
    const s = budgetStatus(envelopes, new Map([['food', row(50000, 50000)], ['gas', row(10000, 10000)], ['rent', row(0, 120000)]]), 15, 30);
    expect(s).toMatchObject({ level: 'ok', left: 60000, spent: 60000 });
  });
  it('is getting close when spending runs ahead of the month', () => {
    const s = budgetStatus(envelopes, new Map([['food', row(20000, 80000)], ['gas', row(5000, 5000)]]), 10, 30);
    expect(s.level).toBe('close');
  });
  it('is overspent when any everyday envelope is below zero', () => {
    const s = budgetStatus(envelopes, new Map([['food', row(-1320, 51320)], ['gas', row(10000, 0)]]), 20, 30);
    expect(s.level).toBe('over');
    expect(s.overspent).toEqual([{ envelope: envelopes[0], by: 1400 }]);
    expect(s.left).toBe(10000 - 1400);
  });
  it('rounds like the budget: left down, spent up', () => {
    const s = budgetStatus(envelopes, new Map([['food', row(7275, 2725)]]), 1, 30);
    expect(s).toMatchObject({ left: 7200, spent: 2800 });
  });
});
