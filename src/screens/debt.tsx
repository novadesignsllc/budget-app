import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Field } from '@/components/field';
import { HeaderButton } from '@/components/header-button';
import { HeroCard } from '@/components/hero-card';
import { Row, Section } from '@/components/list';
import { Money } from '@/components/money';
import { Screen } from '@/components/screen';
import { Segmented } from '@/components/segmented';
import { Text } from '@/components/text';
import { addMonths, formatMonthYear, today } from '@/domain/dates';
import { comparePlan, type Strategy } from '@/domain/debt';
import { formatMoney, parseMoney } from '@/domain/money';
import { useAccounts, useDebtPlan, useLedger } from '@/hooks/use-ledger';
import { useStore } from '@/store';
import { radius, spacing, useColors } from '@/theme';

export function payoffLabel(months: number | null): string {
  if (months === null) return 'Never at this payment';
  return formatMonthYear(addMonths(today(), months));
}

export function Debt() {
  const colors = useColors();
  const ledger = useLedger();
  const { debts } = useAccounts();
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const { inputs, minimums, monthly, comparison } = useDebtPlan();
  // Draft only while editing; otherwise show the saved plan amount.
  const [draft, setDraft] = useState<string | null>(null);
  const monthlyText = draft ?? (monthly / 100).toFixed(2);
  const commitMonthly = () => {
    if (draft !== null) updateSettings({ monthlyDebtPayment: parseMoney(draft) ?? 0 });
    setDraft(null);
  };

  const other: Strategy = settings.debtStrategy === 'snowball' ? 'avalanche' : 'snowball';
  const otherPlan = useMemo(
    () => (inputs.length ? comparePlan(inputs, monthly, other) : null),
    [inputs, monthly, other],
  );

  const startedWith = debts.reduce((a, d) => a + -d.openingBalance, 0);
  const paidDown = Math.max(0, startedWith - ledger.debtTotal);
  const progress = startedWith > 0 ? paidDown / startedWith : 0;

  if (debts.length === 0) {
    return (
      <Screen>
        <EmptyState
          title="Add what you owe"
          body="Credit cards, car and student loans, the mortgage. Enter each balance, rate, and minimum, and you'll see the date you're debt-free and the interest you save by paying extra."
          action={<Button title="Add a debt" onPress={() => router.push({ pathname: '/new-account', params: { debt: '1' } })} />}
        />
      </Screen>
    );
  }

  const plan = comparison?.plan;
  const order = plan?.perDebt ?? [];
  const accountById = new Map(debts.map((a) => [a.id, a]));

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerRight: () => (
            <HeaderButton
              sf="plus"
              md="add"
              label="Add a debt"
              onPress={() => router.push({ pathname: '/new-account', params: { debt: '1' } })}
            />
          ),
        }}
      />

      <HeroCard>
        <Text variant="callout" weight="500" tone="textSecondary">
          Total debt
        </Text>
        <Money cents={ledger.debtTotal} variant="display" />
        {plan && (
          <Text variant="headline">
            {plan.months === null ? 'Not on track to pay off' : `Debt-free by ${payoffLabel(plan.months)}`}
          </Text>
        )}
        {comparison && comparison.interestSaved > 0 && (
          <Text variant="callout" tone="textSecondary">
            Paying {formatMoney(monthly, { whole: true })} a month saves {formatMoney(comparison.interestSaved, { whole: true })} in
            interest
            {comparison.monthsSaved ? ` and ${comparison.monthsSaved} months` : ''} compared to minimums.
          </Text>
        )}
        {startedWith > 0 && (
          <View style={{ gap: spacing.xs, marginTop: spacing.xs }}>
            <View style={{ height: 8, borderRadius: radius.full, backgroundColor: colors.surface, overflow: 'hidden' }}>
              <View
                style={{
                  width: `${Math.round(progress * 100)}%`,
                  height: '100%',
                  borderRadius: radius.full,
                  backgroundColor: colors.ink,
                }}
              />
            </View>
            <Text variant="footnote" tone="textSecondary">
              {formatMoney(paidDown, { whole: true })} paid down since you started
            </Text>
          </View>
        )}
      </HeroCard>

      <Section title="Your plan">
        <View style={{ padding: spacing.lg, gap: spacing.lg }}>
          <Segmented
            value={settings.debtStrategy}
            onChange={(v) => updateSettings({ debtStrategy: v })}
            options={[
              { value: 'snowball', label: 'Snowball' },
              { value: 'avalanche', label: 'Avalanche' },
            ]}
          />
          <Text variant="callout" tone="textSecondary">
            {settings.debtStrategy === 'snowball'
              ? 'Smallest balance first. Quick wins keep you going.'
              : 'Highest interest rate first. Costs the least overall.'}
          </Text>
          <Field
            label="Each month toward debt"
            hint={`Minimums add up to ${formatMoney(minimums)}. Anything above that goes to the first debt in line.`}
            value={monthlyText}
            onChangeText={setDraft}
            keyboardType="decimal-pad"
            inputMode="decimal"
            onBlur={commitMonthly}
            onSubmitEditing={commitMonthly}
          />
        </View>
        {comparison && otherPlan && (
          <View style={{ flexDirection: 'row', padding: spacing.lg, gap: spacing.lg }}>
            {[
              { label: settings.debtStrategy === 'snowball' ? 'Snowball' : 'Avalanche', c: comparison, active: true },
              { label: other === 'snowball' ? 'Snowball' : 'Avalanche', c: otherPlan, active: false },
            ].map(({ label, c, active }) => (
              <View key={label} style={{ flex: 1, gap: spacing.xxs }}>
                <Text variant="footnote" weight="600" tone={active ? 'text' : 'textSecondary'}>
                  {label}
                  {active ? ' (yours)' : ''}
                </Text>
                <Text variant="body" tone={active ? 'text' : 'textSecondary'}>
                  {payoffLabel(c.plan.months)}
                </Text>
                <Text variant="footnote" tone="textSecondary">
                  {formatMoney(c.plan.totalInterest, { whole: true })} interest
                </Text>
              </View>
            ))}
          </View>
        )}
      </Section>

      <Section title="Payoff order">
        {order.map((r, i) => {
          const a = accountById.get(r.id);
          if (!a) return null;
          return (
            <Row
              key={r.id}
              href={`/debt/${r.id}`}
              title={a.name}
              subtitle={[
                i === 0 ? 'Up next' : null,
                a.apr ? `${(a.apr / 100).toFixed(2)}%` : 'No rate set',
                r.payoffMonth ? `paid off ${payoffLabel(r.payoffMonth)}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              trailing={<Money cents={-(ledger.balance.get(r.id) ?? 0)} weight="500" />}
              chevron
            />
          );
        })}
        {debts
          .filter((a) => !order.some((o) => o.id === a.id))
          .map((a) => (
            <Row key={a.id} href={`/debt/${a.id}`} title={a.name} subtitle="Paid off" trailing={<Money cents={0} tone="positive" />} chevron />
          ))}
      </Section>
    </Screen>
  );
}
