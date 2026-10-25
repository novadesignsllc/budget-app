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
export function targetFor(envelope: Pick<Envelope, 'targets' | 'monthlyTarget'>, month: MonthKey): Cents | null {
  const entries = Object.keys(envelope.targets ?? {})
    .filter((m) => m <= month)
    .sort();
  if (entries.length) {
    const v = envelope.targets![entries[entries.length - 1]];
    return v && v > 0 ? v : null;
  }
  return envelope.monthlyTarget && envelope.monthlyTarget > 0 ? envelope.monthlyTarget : null;
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
