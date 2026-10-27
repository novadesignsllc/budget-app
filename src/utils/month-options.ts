import type { DropdownOption } from '@/components/dropdown';
import { today } from '@/domain/dates';
import { addMonthKey, formatMonth, monthOf, type MonthKey } from '@/domain/months';
import { useStore } from '@/store';

/**
 * Months for a month dropdown, newest first: from the earliest month with data up to the
 * current month, plus `ahead` months after it for budgeting ahead (the Budget passes
 * MONTHS_AHEAD; Transactions has nothing in the future, so it passes none).
 */
export function useMonthOptions({ ahead = 0 }: { ahead?: number } = {}): DropdownOption<MonthKey>[] {
  const accounts = useStore((s) => s.accounts);
  const transactions = useStore((s) => s.transactions);
  const current = monthOf(today());
  let earliest = current;
  for (const a of accounts) if (monthOf(a.openedOn) < earliest) earliest = monthOf(a.openedOn);
  for (const t of transactions) if (monthOf(t.date) < earliest) earliest = monthOf(t.date);
  const options: DropdownOption<MonthKey>[] = [];
  // Budgeting ahead: this month on top, then the months ahead in order (with their year,
  // since next October is a different October), then the past by year.
  if (ahead > 0) {
    options.push({ value: current, label: formatMonth(current), section: 'This month' });
    for (let i = 1; i <= ahead; i++) {
      const m = addMonthKey(current, i);
      options.push({ value: m, label: formatMonth(m, 0), section: 'Ahead' });
    }
  }
  for (let m = ahead > 0 ? addMonthKey(current, -1) : current; m >= earliest; m = addMonthKey(m, -1)) {
    options.push({
      value: m,
      label: formatMonth(m),
      section: m.slice(0, 4),
      detail: m === current ? 'This month' : undefined,
    });
    if (options.length > 120 + ahead) break;
  }
  return options;
}
