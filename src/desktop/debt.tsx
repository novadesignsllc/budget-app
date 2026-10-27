import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { CreditUsePill } from '@/components/credit-use';
import { Dropdown } from '@/components/dropdown';
import { LineChart } from '@/components/line-chart';
import { Text } from '@/components/text';
import { today } from '@/domain/dates';
import { comparePlan, creditUse, estimateMinPayment, type PlanComparison, type Strategy } from '@/domain/debt';
import { formatMoney } from '@/domain/money';
import { monthOf } from '@/domain/months';
import type { Account } from '@/domain/types';
import { useAccounts, useDebtPlan, useLedger } from '@/hooks/use-ledger';
import { axisMoney, debtColor, endAtPayoff, horizonTicks, payoffLabel } from '@/screens/debt';
import { useStore } from '@/store';
import { spacing, useColors } from '@/theme';

import { Label } from './register';
import { DButton, DCard, DPage, PageTitle, Spacer } from './ui';

const COL = { apr: 80, min: 100, limit: 110, paid: 110, owed: 110 } as const;

/**
 * The debt plan on a computer: the payoff chart large, the numbers that matter beside it,
 * and every debt in payoff order with its rate, minimum and payoff month.
 */
export function DesktopDebt() {
  const colors = useColors();
  const ledger = useLedger();
  const { debts } = useAccounts();
  const settings = useStore((s) => s.settings);
  const transactions = useStore((s) => s.transactions);
  const updateSettings = useStore((s) => s.updateSettings);
  const { inputs, minimums, monthly, comparison } = useDebtPlan();

  const plans = useMemo(() => {
    if (!inputs.length || !comparison) return null;
    const other: Strategy = settings.debtStrategy === 'snowball' ? 'avalanche' : 'snowball';
    return { [settings.debtStrategy]: comparison, [other]: comparePlan(inputs, monthly, other) } as Record<
      Strategy,
      PlanComparison
    >;
  }, [inputs, monthly, settings.debtStrategy, comparison]);

  const addDebt = () => router.push({ pathname: '/new-account', params: { debt: '1' } });
  const header = (
    <>
      <PageTitle>Debt</PageTitle>
      <Spacer />
      {plans && (
        <Dropdown<Strategy>
          variant="compact"
          value={settings.debtStrategy}
          onChange={(v) => updateSettings({ debtStrategy: v })}
          label="Strategy"
          options={[
            {
              value: 'snowball',
              label: 'Snowball',
              description: 'Smallest balance first',
              detail: payoffLabel(plans.snowball.plan.months),
            },
            {
              value: 'avalanche',
              label: 'Avalanche',
              description: 'Highest rate first',
              detail: payoffLabel(plans.avalanche.plan.months),
            },
          ]}
        />
      )}
      {debts.length > 0 && (
        <DButton
          label={`${formatMoney(monthly, { whole: true })} a month`}
          accessibilityLabel={`Each month toward debt: ${formatMoney(monthly, { whole: true })}. Change it`}
          onPress={() => router.push('/debt-plan')}
        />
      )}
      <DButton label="Debt" icon={{ sf: 'plus', md: 'add' }} accessibilityLabel="Add a debt" onPress={addDebt} />
    </>
  );

  if (debts.length === 0) {
    return (
      <DPage title="Debt" header={header}>
        <DCard padded style={{ maxWidth: 560 }}>
          <Text variant="section">Add what you owe</Text>
          <Text variant="callout" tone="textSecondary">
            Credit cards, car and student loans, the mortgage. Enter each balance, rate, and minimum, and you’ll see the
            month you’re debt-free and the interest you save by paying extra.
          </Text>
          <DButton label="Add a debt" variant="accent" onPress={addDebt} style={{ alignSelf: 'flex-start' }} />
        </DCard>
      </DPage>
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
  const extra = Math.max(0, monthly - minimums);

  return (
    <DPage title="Debt" header={header}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, alignItems: 'stretch' }}>
        <DCard padded style={{ flexGrow: 3, flexShrink: 1, flexBasis: 560, minWidth: 0 }}>
          <Text variant="callout" weight="700">
            Payoff plan
          </Text>
          {series.length > 0 && horizon > 0 ? (
            <LineChart
              height={260}
              series={series}
              xTicks={horizonTicks(horizon)}
              pointLabel={(i) => (i === 0 ? 'Now' : payoffLabel(i))}
              formatValue={(v) => formatMoney(v, { whole: true })}
              formatAxis={axisMoney}
              accessibilityLabel={`Projected balances: ${order
                .map((o) => `${byId.get(o.id)?.name ?? 'Debt'} paid off ${payoffLabel(o.payoffMonth)}`)
                .join(', ')}.`}
            />
          ) : (
            <Text variant="callout" tone="textSecondary">
              Everything’s paid off.
            </Text>
          )}
        </DCard>

        <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 280, minWidth: 0, gap: spacing.lg }}>
          <DCard padded>
            <Text variant="footnote" tone="textSecondary">
              Debt-free by
            </Text>
            <Text
              style={{ fontSize: 30, lineHeight: 36, fontWeight: '700', letterSpacing: -0.5 }}
              tone={plan && plan.months == null ? 'negative' : 'text'}
            >
              {plan ? (plan.months == null ? 'Never' : payoffLabel(plan.months)) : 'Now'}
            </Text>
            {comparison && comparison.interestSaved > 0 ? (
              <Text variant="callout" weight="600" tone="positive">
                Saves {formatMoney(comparison.interestSaved, { whole: true })} in interest
                {comparison.monthsSaved ? ` and ${comparison.monthsSaved} months` : ''} vs minimums
              </Text>
            ) : plan && plan.months == null ? (
              <Text variant="callout" weight="600" tone="negative">
                Payments don’t cover the interest. Raise the monthly amount.
              </Text>
            ) : null}
          </DCard>
          <DCard padded>
            <Stat label="Owed now" value={formatMoney(ledger.debtTotal, { whole: true })} />
            <Stat label="Each month" value={formatMoney(monthly, { whole: true })} />
            <Stat label="Minimums" value={formatMoney(minimums, { whole: true })} />
            <Stat
              label="Extra on top"
              value={formatMoney(extra, { whole: true })}
              tone={extra > 0 ? 'positive' : 'textSecondary'}
            />
            {plan && <Stat label="Interest to go" value={formatMoney(plan.totalInterest, { whole: true })} />}
          </DCard>
        </View>
      </View>

      <DCard style={{ minWidth: 840 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingHorizontal: 16,
            paddingVertical: 10,
            backgroundColor: colors.tableHeader,
            borderBottomWidth: 1,
            borderBottomColor: colors.separator,
          }}
        >
          <Label width={24}>#</Label>
          <Label flex={1}>Payoff order</Label>
          <Label width={COL.apr} right>
            APR
          </Label>
          <Label width={COL.min} right>
            Minimum
          </Label>
          <Label width={COL.limit} right>
            Limit used
          </Label>
          <Label width={COL.paid} right>
            Paid off
          </Label>
          <Label width={COL.owed} right>
            Owed
          </Label>
        </View>
        {ordered.map((a, i) => {
          const owed = -(ledger.balance.get(a.id) ?? 0);
          const result = order.find((o) => o.id === a.id);
          const slips = slipsThisMonth(a.id);
          const minimum = a.minPayment || estimateMinPayment(owed, a.apr ?? 0);
          const credit = creditUse(owed, a.creditLimit);
          const note =
            owed <= 0
              ? 'Paid off'
              : slips > 0
                ? `${slips} ${slips === 1 ? 'slip' : 'slips'} this month`
                : i === 0 && result
                  ? 'Up next: extra money goes here'
                  : '';
          return (
            <Pressable
              key={a.id}
              accessibilityRole="button"
              accessibilityLabel={`${i + 1}. ${a.name}, ${formatMoney(owed)} owed. Open`}
              onPress={() => router.push(`/debt/${a.id}`)}
              style={({ hovered }: { hovered?: boolean }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                minHeight: 52,
                paddingHorizontal: 16,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: colors.hairline,
                backgroundColor: hovered ? '#FAFBFD' : 'transparent',
              })}
            >
              <Text variant="callout" tone="textTertiary" style={{ width: 24 }}>
                {i + 1}
              </Text>
              <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <View style={{ width: 28, height: 18, borderRadius: 4, backgroundColor: debtColor(debts, a.id) }} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text variant="body" weight="600" numberOfLines={1}>
                    {a.name}
                  </Text>
                  {note ? (
                    <Text
                      variant="footnote"
                      tone={slips > 0 ? 'negative' : owed <= 0 ? 'positive' : 'textSecondary'}
                      numberOfLines={1}
                    >
                      {note}
                    </Text>
                  ) : null}
                </View>
              </View>
              <Text
                variant="body"
                tone={a.apr ? 'textSecondary' : 'textTertiary'}
                align="right"
                style={{ width: COL.apr, fontVariant: ['tabular-nums'] }}
              >
                {a.apr ? `${(a.apr / 100).toFixed(2)}%` : 'Not set'}
              </Text>
              <Text
                variant="body"
                tone="textSecondary"
                align="right"
                style={{ width: COL.min, fontVariant: ['tabular-nums'] }}
              >
                {owed > 0 ? formatMoney(minimum) : '—'}
              </Text>
              <View style={{ width: COL.limit, alignItems: 'flex-end' }}>
                {credit ? (
                  <CreditUsePill use={credit} />
                ) : (
                  <Text variant="body" tone="textTertiary">
                    —
                  </Text>
                )}
              </View>
              <Text variant="body" tone="textSecondary" align="right" style={{ width: COL.paid }}>
                {owed <= 0 ? 'Done' : result ? payoffLabel(result.payoffMonth) : 'Never'}
              </Text>
              <Text
                variant="body"
                weight="700"
                align="right"
                style={{ width: COL.owed, fontVariant: ['tabular-nums'] }}
              >
                {formatMoney(owed)}
              </Text>
            </Pressable>
          );
        })}
      </DCard>
    </DPage>
  );
}

function Stat({
  label,
  value,
  tone = 'text',
}: {
  label: string;
  value: string;
  tone?: 'text' | 'positive' | 'textSecondary';
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <Text variant="callout" tone="textSecondary">
        {label}
      </Text>
      <Text variant="body" weight="600" tone={tone} style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
    </View>
  );
}
