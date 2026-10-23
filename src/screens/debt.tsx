import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { CardCarousel } from '@/components/card-carousel';
import { CardFace } from '@/components/card-face';
import { CardSwatch } from '@/components/card-swatch';
import { EmptyState } from '@/components/empty-state';
import { Field } from '@/components/field';
import { FloatingAction } from '@/components/floating-action';
import { ICON_INSET, Row, Section } from '@/components/list';
import { Money } from '@/components/money';
import { ProgressRing } from '@/components/progress-ring';
import { Screen } from '@/components/screen';
import { Segmented } from '@/components/segmented';
import { Text } from '@/components/text';
import { addMonths, formatMonthYear, today } from '@/domain/dates';
import { comparePlan, type Strategy } from '@/domain/debt';
import { formatMoney, parseMoney } from '@/domain/money';
import { monthOf } from '@/domain/months';
import { useAccounts, useDebtPlan, useLedger } from '@/hooks/use-ledger';
import { useStore } from '@/store';
import { radius, spacing, useColors } from '@/theme';

export function payoffLabel(months: number | null): string {
  if (months === null) return 'Never at this payment';
  return formatMonthYear(addMonths(today(), months));
}

const short = (months: number | null) => {
  if (months === null) return 'never';
  const label = payoffLabel(months);
  return label.replace(/^(\w{3})\w* /, '$1 ');
};

export function Debt() {
  const colors = useColors();
  const ledger = useLedger();
  const { debts } = useAccounts();
  const settings = useStore((s) => s.settings);
  const transactions = useStore((s) => s.transactions);
  const updateSettings = useStore((s) => s.updateSettings);
  const { inputs, minimums, monthly, comparison } = useDebtPlan();
  const [draft, setDraft] = useState<string | null>(null);
  const monthlyText = draft ?? (monthly / 100).toFixed(2);
  const commitMonthly = () => {
    if (draft !== null) updateSettings({ monthlyDebtPayment: parseMoney(draft) ?? 0 });
    setDraft(null);
  };

  const plans = useMemo(() => {
    if (!inputs.length) return null;
    const other: Strategy = settings.debtStrategy === 'snowball' ? 'avalanche' : 'snowball';
    return { [settings.debtStrategy]: comparison!, [other]: comparePlan(inputs, monthly, other) } as Record<
      Strategy,
      NonNullable<typeof comparison>
    >;
  }, [inputs, monthly, settings.debtStrategy, comparison]);

  const startedWith = debts.reduce((a, d) => a + -d.openingBalance, 0);
  const paidDown = Math.max(0, startedWith - ledger.debtTotal);
  const thisMonth = monthOf(today());

  if (debts.length === 0) {
    return (
      <Screen>
        <EmptyState
          title="Add what you owe"
          body="Credit cards, car and student loans, the mortgage. Enter each balance, rate, and minimum, and you’ll see the date you’re debt-free and the interest you save by paying extra."
          action={<Button title="Add a debt" onPress={() => router.push({ pathname: '/new-account', params: { debt: '1' } })} />}
        />
      </Screen>
    );
  }

  const plan = comparison?.plan;
  const order = plan?.perDebt ?? [];
  const accountById = new Map(debts.map((a) => [a.id, a]));
  const ordered = [
    ...order.map((o) => accountById.get(o.id)).filter((a): a is NonNullable<typeof a> => !!a),
    ...debts.filter((a) => !order.some((o) => o.id === a.id)),
  ];
  const faceOf = (id: string) => debts.findIndex((d) => d.id === id) + 0;
  const slipsThisMonth = (id: string) =>
    transactions.filter((t) => t.accountId === id && t.kind === 'slip' && monthOf(t.date) === thisMonth).length;

  return (
    <>
      <Screen>
        <View style={{ gap: 2 }}>
          <Text variant="footnote" weight="500" tone="textSecondary">
            Total debt
          </Text>
          <Money cents={ledger.debtTotal} variant="display" />
        </View>

        <CardCarousel
          items={ordered}
          keyOf={(a) => a.id}
          dots
          renderCard={(a, width) => {
            const owed = -(ledger.balance.get(a.id) ?? 0);
            const result = order.find((o) => o.id === a.id);
            const slips = slipsThisMonth(a.id);
            const first = order[0]?.id === a.id;
            return (
              <CardFace
                face={faceOf(a.id)}
                width={width}
                title={a.name}
                caption={[first ? 'Up next' : null, a.apr ? `${(a.apr / 100).toFixed(2)}%` : null].filter(Boolean).join(' · ')}
                amount={formatMoney(owed)}
                footnote={
                  slips > 0
                    ? `${slips} ${slips === 1 ? 'slip' : 'slips'} this month`
                    : owed <= 0
                      ? 'Paid off'
                      : result?.payoffMonth
                        ? `Paid off ${payoffLabel(result.payoffMonth)}`
                        : undefined
                }
                footnoteTone={slips > 0 ? 'bad' : owed <= 0 ? 'good' : 'muted'}
                onPress={() => router.push(`/debt/${a.id}`)}
                accessibilityLabel={`${a.name}, ${formatMoney(owed)} owed`}
              />
            );
          }}
        />

        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: radius.lg,
            borderCurve: 'continuous',
            padding: spacing.lg,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.lg,
          }}
        >
          <ProgressRing value={startedWith > 0 ? paidDown / startedWith : 0} color={colors.accent} />
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text variant="headline">
              {plan?.months == null ? 'Not on track to pay off' : `Debt-free by ${payoffLabel(plan.months)}`}
            </Text>
            <Text variant="callout" tone="textSecondary">
              {comparison && comparison.interestSaved > 0
                ? `${formatMoney(monthly, { whole: true })} a month saves ${formatMoney(comparison.interestSaved, { whole: true })} in interest${comparison.monthsSaved ? ` and ${comparison.monthsSaved} months` : ''} over minimums.`
                : `${formatMoney(paidDown, { whole: true })} paid down since you started.`}
            </Text>
          </View>
        </View>

        <View style={{ gap: spacing.md }}>
          {plans && (
            <Segmented
              value={settings.debtStrategy}
              onChange={(v) => updateSettings({ debtStrategy: v })}
              options={[
                { value: 'snowball', label: `Snowball · ${short(plans.snowball.plan.months)}` },
                { value: 'avalanche', label: `Avalanche · ${short(plans.avalanche.plan.months)}` },
              ]}
            />
          )}
          <Text variant="footnote" tone="textSecondary" style={{ paddingHorizontal: spacing.xs }}>
            {settings.debtStrategy === 'snowball'
              ? 'Smallest balance first. Quick wins keep you going.'
              : 'Highest interest rate first. Costs the least overall.'}
          </Text>
          <Field
            label="Each month toward debt"
            hint={`Minimums add up to ${formatMoney(minimums)}. The rest goes to the debt that’s up next.`}
            value={monthlyText}
            onChangeText={setDraft}
            keyboardType="decimal-pad"
            inputMode="decimal"
            onBlur={commitMonthly}
            onSubmitEditing={commitMonthly}
          />
        </View>

        <Section title="Payoff order" inset={ICON_INSET}>
          {ordered.map((a, i) => {
            const owed = -(ledger.balance.get(a.id) ?? 0);
            const result = order.find((o) => o.id === a.id);
            const slips = slipsThisMonth(a.id);
            return (
              <Row
                key={a.id}
                href={`/debt/${a.id}`}
                leading={<CardSwatch face={faceOf(a.id)} />}
                title={a.name}
                subtitle={[
                  a.apr ? `${(a.apr / 100).toFixed(2)}%` : 'No rate set',
                  slips ? `${slips} ${slips === 1 ? 'slip' : 'slips'} this month` : result?.payoffMonth ? payoffLabel(result.payoffMonth) : owed <= 0 ? 'Paid off' : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                subtitleTone={slips ? 'negative' : 'textSecondary'}
                trailing={<Money cents={owed} weight="600" whole={owed >= 100000} />}
                accessibilityLabel={`${i + 1}. ${a.name}`}
              />
            );
          })}
        </Section>
      </Screen>
      <FloatingAction label="Add debt" onPress={() => router.push({ pathname: '/new-account', params: { debt: '1' } })} />
    </>
  );
}
