import { ceilDollars } from './money';
import type { MonthKey } from './months';
import type { Cents, Envelope, TargetKind } from './types';

/** Spending (a monthly limit) or goal (set aside every month), defaulting by group. */
export function targetKindOf(envelope: Pick<Envelope, 'targetKind' | 'group'>): TargetKind {
  return envelope.targetKind ?? (envelope.group === 'Savings' ? 'goal' : 'spending');
}

/** The target types in the order they're offered, with their names. */
export const TARGET_KINDS: { kind: TargetKind; name: string; description: string }[] = [
  { kind: 'spending', name: 'Maximum', description: 'The most to spend each month' },
  { kind: 'bank', name: 'Bank', description: 'Always keep this much in it' },
  { kind: 'builder', name: 'Builder', description: 'Reach an amount by a date' },
  { kind: 'goal', name: 'Save each month', description: 'Put this much in every month' },
];

export function targetKindName(kind: TargetKind): string {
  return TARGET_KINDS.find((k) => k.kind === kind)?.name ?? 'Maximum';
}

/** Months from `from` through `to`, counting both: October through December is 3. */
export function monthsThrough(from: MonthKey, to: MonthKey): number {
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  return (ty - fy) * 12 + (tm - fm) + 1;
}

/** A builder whose date has gone by. It asks for nothing more until it gets a new date. */
export function builderEnded(envelope: Pick<Envelope, 'targetDate'>, month: MonthKey): boolean {
  return !!envelope.targetDate && envelope.targetDate < month;
}

/**
 * Builder: what this month should get so the envelope reaches `target` by its date, from
 * what it started the month with. Zero once it's there, or after the date.
 */
export function builderMonthly(
  envelope: Pick<Envelope, 'targetDate'>,
  target: Cents,
  carriedIn: Cents,
  month: MonthKey,
): Cents {
  const left = target - carriedIn;
  if (left <= 0 || builderEnded(envelope, month)) return 0;
  const months = envelope.targetDate ? Math.max(1, monthsThrough(month, envelope.targetDate)) : 1;
  return ceilDollars(Math.ceil(left / months));
}

/**
 * What an envelope still needs this month to meet its target.
 * - Maximum (spending) refills up to the target; money carried in counts.
 * - Save each month (goal) wants the full amount assigned every month.
 * - Bank keeps the target in the envelope: whatever was spent is needed back.
 * - Builder spreads what's left to reach the target over the months until its date.
 */
export function targetNeed(
  envelope: Pick<Envelope, 'targetKind' | 'group' | 'targetDate'>,
  target: Cents,
  row: { assigned: Cents; carriedIn: Cents; available: Cents },
  month: MonthKey,
): Cents {
  switch (targetKindOf(envelope)) {
    case 'goal':
      return Math.max(0, target - row.assigned);
    case 'bank':
      return Math.max(0, target - row.available);
    case 'builder':
      return Math.max(0, builderMonthly(envelope, target, row.carriedIn, month) - row.assigned);
    default:
      return Math.max(0, target - row.carriedIn - row.assigned);
  }
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
