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
  { kind: 'weekly', name: 'Weekly maximum', description: 'The most to spend each week' },
  { kind: 'repeat', name: 'Repeating builder', description: 'An amount that comes due every few months' },
  { kind: 'percent', name: 'Percent of income', description: 'A share of what comes in each month' },
];

/** How many weeks a month has, counted by its Sundays: 4 or 5. */
export function weeksIn(month: MonthKey): number {
  const [y, m] = month.split('-').map(Number);
  const days = new Date(y, m, 0).getDate();
  const firstDay = new Date(y, m - 1, 1).getDay();
  const firstSunday = 1 + ((7 - firstDay) % 7);
  return Math.floor((days - firstSunday) / 7) + 1;
}

/** Repeating builder: the month it next comes due, on or after `month`. */
export function nextDue(envelope: Pick<Envelope, 'targetDate' | 'targetEvery'>, month: MonthKey): MonthKey | null {
  if (!envelope.targetDate) return null;
  const every = Math.max(1, envelope.targetEvery ?? 12);
  let due = envelope.targetDate;
  while (due < month) due = addMonths(due, every);
  return due;
}

function addMonths(month: MonthKey, n: number): MonthKey {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Percent of income: a percent target (stored × 100) of this month's income, in whole dollars. */
export function percentOf(target: Cents, income: Cents): Cents {
  return ceilDollars(Math.ceil((Math.max(0, income) * target) / 10000));
}

/**
 * What the target asks of this month, before counting what's in: the monthly amount for
 * Maximum, Bank and Save each month; weeks × the amount for Weekly; the month's share for
 * builders; the percent of this month's income.
 */
export function targetThisMonth(
  envelope: Pick<Envelope, 'targetKind' | 'group' | 'targetDate' | 'targetEvery'>,
  target: Cents,
  row: { carriedIn: Cents; monthIncome?: Cents },
  month: MonthKey,
): Cents {
  switch (targetKindOf(envelope)) {
    case 'weekly':
      return target * weeksIn(month);
    case 'percent':
      return percentOf(target, row.monthIncome ?? 0);
    case 'builder':
      return builderMonthly(envelope, target, row.carriedIn, month);
    case 'repeat': {
      const due = nextDue(envelope, month);
      return due ? builderMonthly({ targetDate: due }, target, row.carriedIn, month) : 0;
    }
    default:
      return target;
  }
}

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
 * - Repeating builder does the same toward its next due month.
 * - Weekly refills up to the week's amount times the month's weeks.
 * - Percent wants its share of the month's income assigned.
 */
export function targetNeed(
  envelope: Pick<Envelope, 'targetKind' | 'group' | 'targetDate' | 'targetEvery'>,
  target: Cents,
  row: { assigned: Cents; carriedIn: Cents; available: Cents; monthIncome?: Cents },
  month: MonthKey,
): Cents {
  const kind = targetKindOf(envelope);
  if (kind === 'bank') return Math.max(0, target - row.available);
  const amount = targetThisMonth(envelope, target, row, month);
  // Maximum and Weekly refill what's there; the rest want this month's amount assigned.
  const have = kind === 'spending' || kind === 'weekly' ? row.carriedIn + row.assigned : row.assigned;
  return Math.max(0, amount - have);
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
