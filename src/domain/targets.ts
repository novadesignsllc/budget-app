import { ceilDollars } from './money';
import type { MonthKey } from './months';
import type { Cents, Envelope, TargetKind } from './types';

/** Spending (a monthly limit) or goal (set aside every month), defaulting by group. */
export function targetKindOf(envelope: Pick<Envelope, 'targetKind' | 'group'>): TargetKind {
  return envelope.targetKind ?? (envelope.group === 'Savings' ? 'goal' : 'spending');
}

/**
 * What an envelope still needs this month to meet its target. A spending target refills
 * the envelope up to the limit (money carried in counts); a goal wants the full amount
 * assigned every month so it keeps building.
 */
export function targetNeed(
  envelope: Pick<Envelope, 'targetKind' | 'group'>,
  target: Cents,
  row: { assigned: Cents; carriedIn: Cents },
): Cents {
  const have = targetKindOf(envelope) === 'goal' ? row.assigned : row.carriedIn + row.assigned;
  return Math.max(0, target - have);
}

/**
 * The monthly target in effect for `month`: the latest `targets` entry at or before it.
 * Months before any entry fall back to the legacy `monthlyTarget`. `null` means no target.
 */
export function targetSetFor(envelope: Pick<Envelope, 'targets' | 'monthlyTarget'>, month: MonthKey): Cents | null {
  const entries = Object.keys(envelope.targets ?? {})
    .filter((m) => m <= month)
    .sort();
  // Targets are whole dollars, rounded up: a $10.10 bill budgets $11, so pennies never leave it short.
  if (entries.length) {
    const v = envelope.targets![entries[entries.length - 1]];
    return v && v > 0 ? ceilDollars(v) : null;
  }
  return envelope.monthlyTarget && envelope.monthlyTarget > 0 ? ceilDollars(envelope.monthlyTarget) : null;
}

/** Whether the target is snoozed for `month`. */
export function isSnoozed(envelope: Pick<Envelope, 'snoozed'>, month: MonthKey): boolean {
  return !!envelope.snoozed?.includes(month);
}

/**
 * The target that counts in `month`: the one set for it, unless it's snoozed that month.
 * Editing a target uses `targetSetFor`, so a snooze never wipes the real target.
 */
export function targetFor(
  envelope: Pick<Envelope, 'targets' | 'monthlyTarget' | 'snoozed'>,
  month: MonthKey,
): Cents | null {
  return isSnoozed(envelope, month) ? null : targetSetFor(envelope, month);
}

/**
 * Sets the target from `month` on. Later months that already had their own entry keep
 * it; earlier months are untouched, because the previous entries still apply to them.
 */
export function withTarget(
  envelope: Pick<Envelope, 'targets' | 'monthlyTarget'>,
  month: MonthKey,
  amount: Cents | null,
): Record<string, Cents | null> {
  const targets = { ...(envelope.targets ?? {}) };
  targets[month] = amount && amount > 0 ? amount : null;
  return targets;
}
