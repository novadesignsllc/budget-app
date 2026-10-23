import type { MonthKey } from './months';
import type { Cents, Envelope } from './types';

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
