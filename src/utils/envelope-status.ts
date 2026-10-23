import { ceilDollars, formatDollars } from '@/domain/money';
import type { EnvelopeMonth, MonthKey } from '@/domain/months';
import { targetFor } from '@/domain/targets';
import type { Cents, Envelope } from '@/domain/types';
import { DEBT_GROUP } from '@/store';

export type EnvelopeStatus = {
  subtitle: string;
  tone: 'textSecondary' | 'negative' | 'positive' | 'accent';
  /** 0 to 1 for the bar. */
  progress: number;
  overspent: boolean;
  /** What "Fill" would add this month: the target gap, or the overspending to cover. */
  need: Cents;
  fillLabel: 'Fill' | 'Cover';
};

// The budget shows whole dollars: amounts round down, spending rounds up.
const m = (c: Cents) => formatDollars(c);
const up = (c: Cents) => formatDollars(c, 'up');

/**
 * How an envelope is doing in a month, in one line. Bills and Everyday show spending
 * against what's there; Savings shows what went in; debt payments show coverage.
 */
export function envelopeStatus(
  e: Envelope,
  row: EnvelopeMonth,
  month: MonthKey,
  debt?: { owed: Cents; minPayment?: Cents },
): EnvelopeStatus {
  const { available, assigned, spent } = row;

  if (available < 0) {
    return {
      subtitle: `Overspent by ${up(-available)}`,
      tone: 'negative',
      progress: 1,
      overspent: true,
      need: ceilDollars(-available),
      fillLabel: 'Cover',
    };
  }

  if (e.debtAccountId && debt) {
    const need = ceilDollars(Math.max(0, (debt.minPayment ?? 0) - assigned));
    return {
      subtitle:
        debt.owed <= 0
          ? 'Paid off'
          : available >= debt.owed
            ? 'Enough to pay it off'
            : `${m(available)} of ${m(debt.owed)} owed`,
      tone: debt.owed > 0 && available >= debt.owed ? 'positive' : 'textSecondary',
      progress: debt.owed > 0 ? available / debt.owed : 1,
      overspent: false,
      need,
      fillLabel: 'Fill',
    };
  }

  const target = targetFor(e, month) ?? 0;
  const need = ceilDollars(Math.max(0, target - assigned));

  if (e.group === 'Savings') {
    return {
      subtitle: target ? `+${m(assigned)} of ${m(target)} this month` : `+${m(assigned)} this month`,
      tone: target && assigned >= target ? 'positive' : 'textSecondary',
      progress: target ? assigned / target : available > 0 ? 1 : 0,
      overspent: false,
      need,
      fillLabel: 'Fill',
    };
  }

  const budget = available + spent;
  let subtitle: string;
  let tone: EnvelopeStatus['tone'] = 'textSecondary';
  if (need > 0) {
    subtitle = spent ? `${up(spent)} spent · ${m(need)} to fill` : `Needs ${m(need)} this month`;
    tone = 'accent';
  } else if (spent > 0) {
    subtitle = `${up(spent)} spent of ${m(budget)}`;
  } else if (available > 0) {
    subtitle = 'Nothing spent yet';
  } else {
    subtitle = 'Nothing assigned';
  }
  return { subtitle, tone, progress: budget > 0 ? spent / budget : 0, overspent: false, need, fillLabel: 'Fill' };
}

export function groupSummary(group: string, total: Cents): string {
  if (group === 'Savings') return `${m(total)} saved`;
  if (group === DEBT_GROUP) return `${m(total)} ready to pay`;
  return `${m(total)} left`;
}
