import { ceilDollars, floorDollars } from './money';
import type { EnvelopeMonth } from './months';
import type { Cents, Envelope } from './types';

export type BudgetStatusLevel = 'ok' | 'close' | 'over';

export type BudgetStatus = {
  level: BudgetStatusLevel;
  /** Whole dollars left across the Daily envelopes (an overspent one counts against it). */
  left: Cents;
  /** Whole dollars spent from them this month. */
  spent: Cents;
  /** Daily envelopes below zero. */
  overspent: { envelope: Envelope; by: Cents }[];
  /** How far through the month today is, 0 to 1. */
  elapsed: number;
};

/** How much ahead of the calendar spending can run before it counts as getting close. */
const AHEAD = 0.1;

/**
 * The everyday budget at a glance. Overspent when any Daily envelope is below zero.
 * Getting close when the share of the month's Daily money already spent runs more than
 * 10 points ahead of the share of the month gone (spent 70% by the 15th), or less than
 * 10% is left with more than a week to go. Otherwise on track.
 */
export function budgetStatus(
  envelopes: Envelope[],
  rows: Map<string, EnvelopeMonth>,
  day: number,
  daysInMonth: number,
): BudgetStatus {
  const daily = envelopes.filter((e) => e.group === 'Daily' && !e.hidden && !e.debtAccountId);
  let left = 0;
  let spent = 0;
  const overspent: BudgetStatus['overspent'] = [];
  for (const e of daily) {
    const r = rows.get(e.id);
    if (!r) continue;
    left += floorDollars(r.available);
    spent += ceilDollars(r.spent);
    if (r.available < 0) overspent.push({ envelope: e, by: ceilDollars(-r.available) });
  }
  const elapsed = Math.min(1, Math.max(0, day / daysInMonth));
  const total = spent + Math.max(left, 0);
  const used = total > 0 ? spent / total : 0;
  const daysLeft = daysInMonth - day;
  const level: BudgetStatusLevel =
    overspent.length > 0 || left < 0
      ? 'over'
      : used > elapsed + AHEAD || (total > 0 && left < total * 0.1 && daysLeft > 7)
        ? 'close'
        : 'ok';
  return { level, left, spent, overspent, elapsed };
}
