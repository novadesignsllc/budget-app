import type { Frequency, ISODate } from './types';

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function toISODate(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function today(): ISODate {
  return toISODate(new Date());
}

export function fromISODate(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: ISODate, days: number): ISODate {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** Adds months, clamping to the last day (Jan 31 + 1 month = Feb 28). */
export function addMonths(iso: ISODate, months: number, anchorDay?: number): ISODate {
  const d = fromISODate(iso);
  const day = anchorDay ?? d.getDate();
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return toISODate(target);
}

export function nextOccurrence(iso: ISODate, frequency: Frequency, anchorDay?: number): ISODate {
  switch (frequency) {
    case 'weekly':
      return addDays(iso, 7);
    case 'biweekly':
      return addDays(iso, 14);
    case 'monthly':
      return addMonths(iso, 1, anchorDay);
    case 'quarterly':
      return addMonths(iso, 3, anchorDay);
    case 'yearly':
      return addMonths(iso, 12, anchorDay);
  }
}

export function daysBetween(from: ISODate, to: ISODate): number {
  const ms = fromISODate(to).getTime() - fromISODate(from).getTime();
  return Math.round(ms / 86_400_000);
}

const monthDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const monthYear = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' });
const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long' });

/** "Today", "Yesterday", "Monday", or "Oct 3". */
export function formatDay(iso: ISODate, now: ISODate = today()): string {
  const diff = daysBetween(iso, now);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff === -1) return 'Tomorrow';
  if (diff > 1 && diff < 7) return weekday.format(fromISODate(iso));
  return monthDay.format(fromISODate(iso));
}

export function formatMonthYear(iso: ISODate): string {
  return monthYear.format(fromISODate(iso));
}

export function formatShortDate(iso: ISODate): string {
  return monthDay.format(fromISODate(iso));
}
