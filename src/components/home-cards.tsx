import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { today } from '@/domain/dates';
import { debtTarget } from '@/domain/debt';
import { averageMonthlyIncome } from '@/domain/history';
import { ceilDollars, formatDollars } from '@/domain/money';
import { assignedAhead, targetGaps } from '@/domain/months';
import { recurringMonthly } from '@/domain/recurring';
import { currentMonth, useBudgetMonth } from '@/hooks/use-budget-month';
import { useLedger } from '@/hooks/use-ledger';
import { useStore } from '@/store';
import { spacing, useColors } from '@/theme';

import { Card } from './card';
import { Icon } from './icon';
import { Text } from './text';

/** This month's budget in one line: overspent envelopes first, then targets still to fill, else all set. */
export function useBudgetCheck() {
  const budget = useBudgetMonth(currentMonth());
  const envelopes = useStore((s) => s.envelopes);
  const accounts = useStore((s) => s.accounts);
  const ledger = useLedger();
  return useMemo(() => {
    const debtTargets = new Map<string, number>();
    for (const e of envelopes) {
      const a = e.debtAccountId ? accounts.find((x) => x.id === e.debtAccountId) : undefined;
      if (a) debtTargets.set(e.id, ceilDollars(debtTarget(a, -(ledger.balance.get(a.id) ?? 0))));
    }
    const overspent = envelopes.filter((e) => !e.hidden && (budget.envelopes.get(e.id)?.available ?? 0) < 0);
    const gaps = targetGaps(envelopes, budget, debtTargets);
    return { overspent, unfunded: gaps.length, need: gaps.reduce((a, g) => a + g.need, 0) };
  }, [budget, envelopes, accounts, ledger]);
}

/** Home's budget check: red with what's overspent, yellow with targets left to fill, green when all set. */
export function BudgetCheckCard({ padding = spacing.lg }: { padding?: number }) {
  const colors = useColors();
  const { overspent, unfunded, need } = useBudgetCheck();
  const look =
    overspent.length > 0
      ? {
          dot: colors.negativeStrong,
          ink: colors.negative,
          title:
            overspent.length === 1 ? `${overspent[0].name} is overspent` : `${overspent.length} envelopes are overspent`,
          icon: { sf: 'exclamationmark.circle.fill', md: 'error' } as const,
        }
      : unfunded > 0
        ? {
            dot: colors.cautionDot,
            ink: colors.caution,
            title: `${unfunded} ${unfunded === 1 ? 'target needs' : 'targets need'} ${formatDollars(need)}`,
            icon: { sf: 'circle.dashed', md: 'pending' } as const,
          }
        : {
            dot: colors.positive,
            ink: colors.positive,
            title: 'Every target is funded',
            icon: { sf: 'checkmark.circle.fill', md: 'check_circle' } as const,
          };
  return (
    <Card>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${look.title}. Open the budget`}
        onPress={() => router.navigate('/budget')}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          padding,
          backgroundColor: pressed ? colors.control : colors.surface,
        })}
      >
        <Icon sf={look.icon.sf} md={look.icon.md} size={20} color={look.dot} />
        <View style={{ flex: 1, gap: 1 }}>
          <Text variant="footnote" tone="textSecondary">
            Budget
          </Text>
          <Text variant="body" weight="600" color={look.ink}>
            {look.title}
          </Text>
        </View>
        <Text variant="callout" weight="600" tone="accent">
          Budget ›
        </Text>
      </Pressable>
    </Card>
  );
}

/** What bills and subscriptions cost a month, and what comes in on average. */
export function MonthlyCard({ padding = spacing.lg }: { padding?: number }) {
  const recurring = useStore((s) => s.recurring);
  const accounts = useStore((s) => s.accounts);
  const transactions = useStore((s) => s.transactions);
  const costs = useMemo(() => recurringMonthly(recurring), [recurring]);
  const income = useMemo(() => averageMonthlyIncome({ accounts, transactions }, today()), [accounts, transactions]);
  const stat = (label: string, cents: number, tone?: 'positive') => (
    <View style={{ flexGrow: 1, flexBasis: 120, gap: 1 }}>
      <Text variant="footnote" tone="textSecondary">
        {label}
      </Text>
      <Text style={{ fontSize: 18, lineHeight: 23, fontWeight: '700', fontVariant: ['tabular-nums'] }} tone={tone ?? 'text'}>
        {formatDollars(cents)}
      </Text>
    </View>
  );
  return (
    <Card>
      <View style={{ padding, gap: spacing.md }}>
        <Text variant="body" weight="700">
          Every month
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.md, columnGap: spacing.lg }}>
          {stat('Bills', costs.bills)}
          {stat('Subscriptions', costs.subscriptions)}
          {stat('Recurring total', costs.total)}
          {stat('Income, on average', income, income > 0 ? 'positive' : undefined)}
        </View>
      </View>
    </Card>
  );
}

const monthShort = new Intl.DateTimeFormat('en-US', { month: 'short' });
const monthLong = new Intl.DateTimeFormat('en-US', { month: 'long' });
const asDate = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1);
};

/** Money already set aside for months after this one: "$200 assigned ahead to Nov–Dec". */
export function useAssignedAhead() {
  const allocations = useStore((s) => s.allocations);
  return useMemo(() => {
    const { total, months } = assignedAhead(allocations, currentMonth());
    if (total <= 0 || !months.length) return null;
    const first = asDate(months[0]);
    const last = asDate(months[months.length - 1]);
    const span = months.length === 1 ? monthLong.format(first) : `${monthShort.format(first)}–${monthShort.format(last)}`;
    return { total, span };
  }, [allocations]);
}

export function AssignedAheadNote() {
  const ahead = useAssignedAhead();
  if (!ahead) return null;
  return (
    <Text variant="footnote" tone="textSecondary">
      {formatDollars(ahead.total)} assigned ahead to {ahead.span}
    </Text>
  );
}
