import { addDays, nextOccurrence } from './dates';
import type { Cents, Frequency, ISODate, Recurring } from './types';

/** Recurring items due today or earlier, oldest first. These wait for a one-tap confirm. */
export function dueForApproval(items: Recurring[], today: ISODate): Recurring[] {
  return items
    .filter((r) => r.active && r.nextDue <= today)
    .sort((a, b) => a.nextDue.localeCompare(b.nextDue));
}

/** Coming up in the next `days` days, not yet due. */
export function upcoming(items: Recurring[], today: ISODate, days = 7): Recurring[] {
  const until = addDays(today, days);
  return items
    .filter((r) => r.active && r.nextDue > today && r.nextDue <= until)
    .sort((a, b) => a.nextDue.localeCompare(b.nextDue));
}

export function advance(item: Recurring): ISODate {
  const anchorDay = Number(item.nextDue.slice(8, 10));
  return nextOccurrence(item.nextDue, item.frequency, anchorDay);
}

const PER_MONTH: Record<Frequency, number> = {
  weekly: 52 / 12,
  biweekly: 26 / 12,
  monthly: 1,
  quarterly: 1 / 3,
  yearly: 1 / 12,
};

export function monthlyCost(item: Pick<Recurring, 'amount' | 'frequency'>): Cents {
  return Math.round(item.amount * PER_MONTH[item.frequency]);
}

export const FREQUENCY_LABEL: Record<Frequency, string> = {
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  monthly: 'Monthly',
  quarterly: 'Every 3 months',
  yearly: 'Yearly',
};
