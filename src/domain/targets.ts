import { ceilDollars } from './money';
import type { MonthKey } from './months';
import type { Cents, Envelope, TargetKind } from './types';

/**
 * The target type: the one in effect in `month` when given (see `targetKinds`), else the
 * current one. Unset follows the group: Savings saves each month, everything else is a
 * spending limit.
 */
export function targetKindOf(
  envelope: Pick<Envelope, 'targetKind' | 'group'> & { targetKinds?: Envelope['targetKinds'] },
  month?: MonthKey,
): TargetKind {
  if (month && envelope.targetKinds) {
    const keys = Object.keys(envelope.targetKinds).sort();
    const at = keys.filter((m) => m <= month).pop() ?? keys[0];
    if (at) return envelope.targetKinds[at];
  }
  return envelope.targetKind ?? (envelope.group === 'Savings' ? 'goal' : 'spending');
}

/**
 * Switching an envelope's target type from `month` on. Earlier months keep the type they
 * had, so their amounts still mean what they meant. Amounts planned for later months were
 * set under the old type, so they go; `month` starts with no target until one is set.
 */
export function changeTargetKind(
  envelope: Pick<Envelope, 'targetKind' | 'group' | 'targets' | 'targetKinds'>,
  kind: TargetKind,
  month: MonthKey,
): Pick<Envelope, 'targetKind' | 'targetKinds' | 'targets'> {
  const was = targetKindOf(envelope);
  const targets = Object.fromEntries(Object.entries(envelope.targets ?? {}).filter(([m]) => m < month));
  const earliest = Object.keys(envelope.targets ?? {}).sort()[0];
  const kinds: Record<string, TargetKind> = envelope.targetKinds
    ? Object.fromEntries(Object.entries(envelope.targetKinds).filter(([m]) => m < month))
    : earliest && earliest < month
      ? { [earliest]: was }
      : {};
  kinds[month] = kind;
  return { targetKind: kind, targetKinds: kinds, targets: { ...targets, [month]: null } };
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

/**
 * A repeating builder's current cycle: the month it's due and what counts as saved toward
 * it. A bill paid before its due month (autopay, or a bank date a few days early) means
 * that cycle is done, so the next one starts. Outside the due month, money spent from the
 * envelope (a bill paid late) isn't saved toward the next one.
 */
export function repeatCycle(
  envelope: Pick<Envelope, 'targetDate' | 'targetEvery'>,
  target: Cents,
  row: { carriedIn: Cents; activity?: Cents; cycleSpent?: Cents },
  month: MonthKey,
): { due: MonthKey; have: Cents } | null {
  let due = nextDue(envelope, month);
  if (!due) return null;
  const every = Math.max(1, envelope.targetEvery ?? 12);
  if (target > 0 && (row.cycleSpent ?? 0) >= target * 0.9) due = addMonths(due, every);
  const have = month === due ? row.carriedIn : row.carriedIn + Math.min(0, row.activity ?? 0);
  return { due, have };
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
  envelope: Pick<Envelope, 'targetKind' | 'group' | 'targetDate' | 'targetEvery'> & { targetKinds?: Envelope['targetKinds'] },
  target: Cents,
  row: { carriedIn: Cents; activity?: Cents; cycleSpent?: Cents; monthIncome?: Cents; percentCarry?: Cents },
  month: MonthKey,
): Cents {
  switch (targetKindOf(envelope, month)) {
    case 'weekly':
      return target * weeksIn(month);
    case 'percent':
      // This month's share, plus anything earlier months came up short (or minus what they got extra).
      return Math.max(0, percentOf(target, row.monthIncome ?? 0) + (row.percentCarry ?? 0));
    case 'builder':
      return builderMonthly(envelope, target, row.carriedIn, month);
    case 'repeat': {
      const cycle = repeatCycle(envelope, target, row, month);
      return cycle ? builderMonthly({ targetDate: cycle.due }, target, cycle.have, month) : 0;
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
  envelope: Pick<Envelope, 'targetKind' | 'group' | 'targetDate' | 'targetEvery'> & { targetKinds?: Envelope['targetKinds'] },
  target: Cents,
  row: {
    assigned: Cents;
    carriedIn: Cents;
    available: Cents;
    activity?: Cents;
    cycleSpent?: Cents;
    monthIncome?: Cents;
    percentCarry?: Cents;
  },
  month: MonthKey,
): Cents {
  const kind = targetKindOf(envelope, month);
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
