import type { DropdownOption } from '@/components/dropdown';
import { today } from '@/domain/dates';
import { addMonthKey, formatMonth, monthOf, type MonthKey } from '@/domain/months';
import { useStore } from '@/store';

/**
 * Months for a month dropdown: from the earliest month with data up to the current
 * month, newest first. Never later than this month (you can't skip ahead).
 */
export function useMonthOptions(): DropdownOption<MonthKey>[] {
  const accounts = useStore((s) => s.accounts);
  const transactions = useStore((s) => s.transactions);
  const current = monthOf(today());
  let earliest = current;
  for (const a of accounts) if (monthOf(a.openedOn) < earliest) earliest = monthOf(a.openedOn);
  for (const t of transactions) if (monthOf(t.date) < earliest) earliest = monthOf(t.date);
  const options: DropdownOption<MonthKey>[] = [];
  for (let m = current; m >= earliest; m = addMonthKey(m, -1)) {
    options.push({
      value: m,
      label: formatMonth(m),
      section: m.slice(0, 4),
      detail: m === current ? 'This month' : undefined,
    });
    if (options.length > 120) break;
  }
  return options;
}
