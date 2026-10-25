import { ceilDollars, formatDollars } from '@/domain/money';
import type { EnvelopeMonth, MonthKey } from '@/domain/months';
import { targetFor, targetKindOf, targetNeed } from '@/domain/targets';
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

/**
 * The bar under an envelope with a target. Yellow while it's short of the target (filled
 * as far as the money in it goes), green once it's funded (shrinking as you spend), grey
 * when funded and spent to zero, red when overspent. `null` means no target: draw the
 * plain bar.
 */
export type TargetBar = { state: 'short' | 'funded' | 'empty' | 'over'; progress: number };

export function targetBar(
  e: Envelope,
  row: EnvelopeMonth,
  month: MonthKey,
  debt?: { owed: Cents; target: Cents },
): TargetBar | null {
  const target = e.debtAccountId ? (debt?.target ?? 0) : (targetFor(e, month) ?? 0);
  if (target <= 0) return null;
  if (row.available < 0) return { state: 'over', progress: 1 };
  const need = e.debtAccountId ? Math.max(0, target - row.assigned) : targetNeed(e, target, row);
  if (need >= 100) {
    // How much of the target is in: a spending limit counts what's in the envelope.
    const have = target - need;
    return { state: 'short', progress: Math.min(1, Math.max(0, have / target)) };
  }
  if (row.available < 100) return { state: 'empty', progress: 0 };
  const month$ = row.available + row.spent;
  return { state: 'funded', progress: month$ > 0 ? row.available / month$ : 1 };
}

// The budget shows whole dollars: amounts round down, spending rounds up.
const m = (c: Cents) => formatDollars(c);
const up = (c: Cents) => formatDollars(c, 'up');

/**
 * How an envelope is doing in a month, in one line. Bills and Daily show spending
 * against what's there; Savings shows what went in; debt payments show coverage.
 */
export function envelopeStatus(
  e: Envelope,
  row: EnvelopeMonth,
  month: MonthKey,
  debt?: { owed: Cents; target: Cents },
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
    const need = ceilDollars(Math.max(0, debt.target - assigned));
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
  const need = ceilDollars(targetNeed(e, target, row));

  if (targetKindOf(e) === 'goal') {
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
