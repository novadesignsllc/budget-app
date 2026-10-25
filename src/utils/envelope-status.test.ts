import { describe, expect, it } from '@jest/globals';

import type { EnvelopeMonth } from '@/domain/months';
import type { Envelope } from '@/domain/types';

import { moneyLeftBar, targetBar } from './envelope-status';

const MONTH = '2026-10';
const groceries: Envelope = { id: 'g', name: 'Groceries', group: 'Daily', order: 0, targets: { [MONTH]: 40000 } };
const row = (r: Partial<EnvelopeMonth>): EnvelopeMonth => ({ assigned: 0, activity: 0, spent: 0, carriedIn: 0, available: 0, ...r });

describe('targetBar', () => {
  it('has no target bar without a target', () => {
    expect(targetBar({ ...groceries, targets: {} }, row({}), MONTH)).toBeNull();
  });
  it('is yellow while short of the target, filled as far as the money goes', () => {
    expect(targetBar(groceries, row({}), MONTH)).toEqual({ state: 'short', progress: 0 });
    expect(targetBar(groceries, row({ assigned: 10000, available: 10000 }), MONTH)).toEqual({ state: 'short', progress: 0.25 });
  });
  it('turns green when funded and shrinks as you spend', () => {
    expect(targetBar(groceries, row({ assigned: 40000, available: 40000 }), MONTH)).toEqual({ state: 'funded', progress: 1 });
    expect(targetBar(groceries, row({ assigned: 40000, spent: 30000, available: 10000 }), MONTH)).toEqual({
      state: 'funded',
      progress: 0.25,
    });
  });
  it('is grey when spent to zero and red when over', () => {
    expect(targetBar(groceries, row({ assigned: 40000, spent: 40000, available: 0 }), MONTH)?.state).toBe('empty');
    expect(targetBar(groceries, row({ assigned: 40000, spent: 41000, available: -1000 }), MONTH)?.state).toBe('over');
  });
  it('counts money carried in toward a spending limit', () => {
    expect(targetBar(groceries, row({ carriedIn: 40000, available: 40000 }), MONTH)?.state).toBe('funded');
  });
  it('wants the full amount each month for a goal', () => {
    const goal = { ...groceries, targetKind: 'goal' as const };
    expect(targetBar(goal, row({ carriedIn: 40000, available: 40000 }), MONTH)?.state).toBe('short');
  });
});

describe('moneyLeftBar', () => {
  it('shrinks as you spend and turns red when spent to zero', () => {
    expect(moneyLeftBar(row({ available: 10000, spent: 30000 }))).toEqual({ progress: 0.25, red: false });
    expect(moneyLeftBar(row({ available: 0, spent: 40000 }))).toEqual({ progress: 0, red: true });
    expect(moneyLeftBar(row({}))).toEqual({ progress: 0, red: false });
  });
  it('treats a paid bill at zero as fine, but not one that went over', () => {
    const bill = { recurringId: 'r1' };
    expect(moneyLeftBar(row({ available: 0, spent: 15000 }), bill).red).toBe(false);
    expect(moneyLeftBar(row({ available: -500, spent: 15500 }), bill).red).toBe(true);
  });
});
