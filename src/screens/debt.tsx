import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/button';
import { Card, TableHeader } from '@/components/card';
import { CreditUsePill } from '@/components/credit-use';
import { Dropdown } from '@/components/dropdown';
import { LineChart } from '@/components/line-chart';
import { MiniCard } from '@/components/mini-card';
import { Money } from '@/components/money';
import { Screen } from '@/components/screen';
import { ActionButton, ScreenActions } from '@/components/screen-actions';
import { ScreenTitle } from '@/components/screen-title';
import { Text } from '@/components/text';
import { addMonths, fromISODate, today } from '@/domain/dates';
import { comparePlan, creditUse, type PlanComparison, type Strategy } from '@/domain/debt';
import { formatMoney } from '@/domain/money';
import { monthOf } from '@/domain/months';
import type { Account } from '@/domain/types';
import { useAccounts, useDebtPlan, useLedger } from '@/hooks/use-ledger';
import { useStore } from '@/store';
import { chartColors, spacing, useColors } from '@/theme';

const monthYear = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' });
const monthYY = new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit' });

/** "Feb 2027", months from now. */
export function payoffLabel(months: number | null): string {
  if (months === null) return 'Never at this payment';
  return monthYear.format(fromISODate(addMonths(today(), months)));
}

/** A debt's chart color: its place in the account list, so it never changes with the strategy. */
export function debtColor(debts: Account[], id: string): string {
  const i = Math.max(
    0,
    debts.findIndex((d) => d.id === id),
  );
  return chartColors[i % chartColors.length];
}

/** Axis labels in dollars: $850, $12k, $2.5k. */
export function axisMoney(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1000) return `$${+(dollars / 1000).toFixed(1)}k`;
  return `$${Math.round(dollars)}`;
}

/**
 * A projected balance line that stops where the debt is paid off: one point at zero,
 * then nothing, so a finished debt doesn't run along the bottom of the chart.
 */
export function endAtPayoff(values: number[]): (number | null)[] {
  const done = values.findIndex((v, i) => i > 0 && v <= 0);
  return done < 0 ? values : values.map((v, i) => (i <= done ? v : null));
}

/**
 * Up to five evenly spaced labels from now to the end: "Now", then years. Falls back to
 * "Nov ’27" when years would repeat, and uses fewer labels when the line is only a few months.
 */
export function horizonTicks(months: number): string[] {
  if (months < 1) return ['Now'];
  const count = Math.min(5, months + 1);
  const dates = Array.from({ length: count - 1 }, (_, i) =>
    fromISODate(addMonths(today(), Math.round(((i + 1) / (count - 1)) * months))),
  );
  const years = dates.map((d) => String(d.getFullYear()));
  const label = new Set(years).size === years.length ? years : dates.map((d) => monthYY.format(d).replace(' ', ' ’'));
  return ['Now', ...label];
}

export function Debt() {
  const colors = useColors();
  const ledger = useLedger();
  const { debts } = useAccounts();
  const settings = useStore((s) => s.settings);
  const transactions = useStore((s) => s.transactions);
  const updateSettings = useStore((s) => s.updateSettings);
  const { inputs, monthly, comparison } = useDebtPlan();

  const plans = useMemo(() => {
    if (!inputs.length || !comparison) return null;
    const other: Strategy = settings.debtStrategy === 'snowball' ? 'avalanche' : 'snowball';
    return { [settings.debtStrategy]: comparison, [other]: comparePlan(inputs, monthly, other) } as Record<
      Strategy,
      PlanComparison
    >;
  }, [inputs, monthly, settings.debtStrategy, comparison]);

  const strategyName = settings.debtStrategy === 'snowball' ? 'Snowball' : 'Avalanche';
  const addDebt = () => router.push({ pathname: '/new-account', params: { debt: '1' } });

  const actions = (
    <ScreenActions>
      {plans && (
        <Dropdown<Strategy>
          variant="compact"
          value={settings.debtStrategy}
          onChange={(v) => updateSettings({ debtStrategy: v })}
          accessibilityLabel={`Strategy: ${strategyName}`}
          options={[
            {
              value: 'snowball',
              label: 'Snowball',
              detail: payoffLabel(plans.snowball.plan.months),
            },
            {
              value: 'avalanche',
              label: 'Avalanche',
              detail: payoffLabel(plans.avalanche.plan.months),
            },
          ]}
        />
      )}
      {debts.length > 0 && (
        <ActionButton
          label={`${formatMoney(monthly, { whole: true })}/mo`}
          accessibilityLabel={`Each month toward debt: ${formatMoney(monthly, { whole: true })}. Change it`}
          onPress={() => router.push('/debt-plan')}
          chevron
        />
      )}
      <ActionButton icon={{ sf: 'plus', md: 'add' }} variant="ink" accessibilityLabel="Add a debt" onPress={addDebt} />
    </ScreenActions>
  );

  if (debts.length === 0) {
    return (
      <>
        <Screen>
          <ScreenTitle title="Debt" />
          <Card padded>
            <Text variant="section">Add what you owe</Text>
            <Text variant="callout" tone="textSecondary">
              Credit cards, car and student loans, the mortgage. Enter each balance, rate, and minimum, and you’ll see
              the month you’re debt-free and the interest you save by paying extra.
            </Text>
            <Button title="Add a debt" onPress={addDebt} style={{ alignSelf: 'flex-start' }} />
          </Card>
        </Screen>
        {actions}
      </>
    );
  }

  const plan = comparison?.plan;
  const order = plan?.perDebt ?? [];
  const byId = new Map(debts.map((a) => [a.id, a]));
  const ordered = [
    ...order.map((o) => byId.get(o.id)).filter((a): a is Account => !!a),
    ...debts.filter((a) => !order.some((o) => o.id === a.id)),
  ];
  const thisMonth = monthOf(today());
  const slipsThisMonth = (id: string) =>
    transactions.filter((t) => t.accountId === id && t.kind === 'slip' && monthOf(t.date) === thisMonth).length;

  const series = order
    .map((o) => {
      const values = plan?.perDebtBalances[o.id];
      const account = byId.get(o.id);
      if (!values || !account) return null;
      return { id: o.id, label: account.name, color: debtColor(debts, o.id), values: endAtPayoff(values) };
    })
    .filter((s): s is NonNullable<typeof s> => !!s);
  const horizon = Math.max(0, ...series.map((s) => s.values.length - 1));

  return (
    <>
      <Screen>
        <ScreenTitle title="Debt" />

        <Card padded>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ gap: 2 }}>
              <Text variant="footnote" tone="textSecondary">
                Debt-free by
              </Text>
              <Text variant="number" tone={plan && plan.months == null ? 'negative' : 'text'}>
                {plan ? (plan.months == null ? 'Never' : payoffLabel(plan.months)) : 'Now'}
              </Text>
            </View>
            <View style={{ gap: 2, alignItems: 'flex-end' }}>
              <Text variant="footnote" tone="textSecondary">
                Owed now
              </Text>
              <Money cents={ledger.debtTotal} whole weight="600" style={{ fontSize: 16, lineHeight: 20 }} />
              {comparison && comparison.interestSaved > 0 ? (
                <Text variant="footnote" tone="positive">
                  Saves {formatMoney(comparison.interestSaved, { whole: true })} vs minimums
                </Text>
              ) : plan && plan.months == null ? (
                <Text variant="footnote" tone="negative">
                  Payments don’t cover the interest
                </Text>
              ) : null}
            </View>
          </View>
          {series.length > 0 && horizon > 0 && (
            <LineChart
              height={150}
              series={series}
              xTicks={horizonTicks(horizon)}
              pointLabel={(i) => (i === 0 ? 'Now' : payoffLabel(i))}
              formatValue={(v) => formatMoney(v, { whole: true })}
              formatAxis={axisMoney}
              accessibilityLabel={`Projected balances: ${order
                .map((o) => `${byId.get(o.id)?.name ?? 'Debt'} paid off ${payoffLabel(o.payoffMonth)}`)
                .join(', ')}.`}
            />
          )}
        </Card>

        <Card>
          <TableHeader
            columns={[
              { label: 'Payoff order' },
              { label: 'APR', width: 50, align: 'right' },
              { label: 'Owed', width: 70, align: 'right' },
            ]}
          />
          {ordered.map((a, i) => {
            const owed = -(ledger.balance.get(a.id) ?? 0);
            const result = order.find((o) => o.id === a.id);
            const slips = slipsThisMonth(a.id);
            const credit = creditUse(owed, a.creditLimit);
            const when = result ? payoffLabel(result.payoffMonth) : null;
            const subtitle =
              owed <= 0
                ? 'Paid off'
                : slips > 0
                  ? `${slips} ${slips === 1 ? 'slip' : 'slips'} this month${when ? ` · ${when}` : ''}`
                  : i === 0 && result
                    ? `Up next · paid off ${when}`
                    : result?.payoffMonth
                      ? `Paid off ${when}`
                      : 'Not paid off at this payment';
            return (
              <Pressable
                key={a.id}
                accessibilityRole="button"
                accessibilityLabel={`${i + 1}. ${a.name}, ${formatMoney(owed)} owed. ${subtitle}`}
                onPress={() => router.push(`/debt/${a.id}`)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  paddingHorizontal: spacing.md,
                  paddingVertical: 9,
                  borderBottomWidth: i < ordered.length - 1 ? 1 : 0,
                  borderBottomColor: colors.hairline,
                  backgroundColor: pressed ? colors.control : colors.surface,
                })}
              >
                <MiniCard color={debtColor(debts, a.id)} width={30} />
                <View style={{ flex: 1, minWidth: 0, marginLeft: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text variant="body" weight="600" numberOfLines={1} style={{ flexShrink: 1 }}>
                      {a.name}
                    </Text>
                    {credit && <CreditUsePill use={credit} compact />}
                  </View>
                  <Text
                    variant="footnote"
                    tone={slips > 0 ? 'negative' : owed <= 0 ? 'positive' : 'textSecondary'}
                    numberOfLines={1}
                  >
                    {subtitle}
                  </Text>
                </View>
                <Text
                  variant="row"
                  align="right"
                  tone={a.apr ? 'textSecondary' : 'textTertiary'}
                  style={{ width: 50, fontVariant: ['tabular-nums'] }}
                >
                  {a.apr ? `${(a.apr / 100).toFixed(2)}%` : 'Not set'}
                </Text>
                <Money cents={owed} whole={owed >= 10000} weight="600" style={{ width: 70, textAlign: 'right' }} />
              </Pressable>
            );
          })}
        </Card>
      </Screen>
      {actions}
    </>
  );
}
