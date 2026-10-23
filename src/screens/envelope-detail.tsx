import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { Field } from '@/components/field';
import { HeaderButton } from '@/components/header-button';
import { HeroCard } from '@/components/hero-card';
import { ICON_INSET, Section } from '@/components/list';
import { Money } from '@/components/money';
import { ProgressBar } from '@/components/progress-bar';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { useToast } from '@/components/toast';
import { TransactionRow } from '@/components/transaction-row';
import { today } from '@/domain/dates';
import { formatMoney, parseMoney } from '@/domain/money';
import { addMonthKey, assignDateFor, formatMonth, monthOf, type MonthKey } from '@/domain/months';
import type { Transaction } from '@/domain/types';
import { currentMonth, useBudgetMonth } from '@/hooks/use-budget-month';
import { useAccounts, useLedger } from '@/hooks/use-ledger';
import { useStore } from '@/store';
import { spacing, useColors, useGroupHue } from '@/theme';
import { envelopeStatus } from '@/utils/envelope-status';
import { haptic } from '@/utils/haptics';

export function EnvelopeDetail({ id, month: monthParam }: { id: string; month?: MonthKey }) {
  const colors = useColors();
  const month = monthParam ?? currentMonth();
  const budget = useBudgetMonth(month);
  const ledger = useLedger();
  const envelope = useStore((s) => s.envelopes.find((e) => e.id === id));
  const envelopes = useStore((s) => s.envelopes);
  const transactions = useStore((s) => s.transactions);
  const accounts = useStore((s) => s.accounts);
  const assign = useStore((s) => s.assign);
  const moveMoney = useStore((s) => s.moveMoney);
  const showToast = useToast((s) => s.show);
  const { all: openAccounts } = useAccounts();
  const hue = useGroupHue(envelope?.group ?? 'Everyday');
  const [amountText, setAmountText] = useState('');
  const [showAll, setShowAll] = useState(false);

  // Every transaction for this envelope, newest first, grouped by month.
  const months = useMemo(() => {
    const rows = transactions
      .filter((t) => t.envelopeId === id)
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
    const byMonth = new Map<MonthKey, Transaction[]>();
    for (const t of rows) {
      const k = monthOf(t.date);
      byMonth.set(k, [...(byMonth.get(k) ?? []), t]);
    }
    return [...byMonth.entries()];
  }, [transactions, id]);

  if (!envelope) {
    return (
      <Screen>
        <Text variant="body">This envelope is gone.</Text>
      </Screen>
    );
  }

  const row = budget.envelopes.get(id) ?? { assigned: 0, activity: 0, spent: 0, carriedIn: 0, available: 0 };
  const debtAccount = accounts.find((a) => a.id === envelope.debtAccountId);
  const status = envelopeStatus(
    envelope,
    row,
    month,
    debtAccount ? { owed: -(ledger.balance.get(debtAccount.id) ?? 0), minPayment: debtAccount.minPayment } : undefined,
  );
  const rta = budget.readyToAssign;
  const date = assignDateFor(month, today());
  const amount = parseMoney(amountText);
  const accountById = new Map(openAccounts.map((a) => [a.id, a]));
  const cutoff = addMonthKey(currentMonth(), -11);
  const visibleMonths = showAll ? months : months.filter(([k]) => k >= cutoff);

  const donors = envelopes
    .filter((e) => e.id !== id && !e.hidden && (budget.envelopes.get(e.id)?.available ?? 0) > 0)
    .sort((a, b) => (budget.envelopes.get(b.id)?.available ?? 0) - (budget.envelopes.get(a.id)?.available ?? 0))
    .slice(0, 6);

  function apply(cents: number, label: string) {
    assign(id, cents, date);
    haptic('success');
    setAmountText('');
    showToast({ message: label });
  }

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: envelope.name,
          headerLargeTitleEnabled: false,
          headerRight: envelope.debtAccountId
            ? undefined
            : () => <HeaderButton sf="slider.horizontal.3" md="tune" label="Edit envelope" onPress={() => router.push({ pathname: '/envelope/[id]', params: { id, month } })} />,
        }}
      />

      <HeroCard>
        <Text variant="footnote" weight="500" tone="textSecondary">
          Available in {formatMonth(month)}
        </Text>
        <Money cents={row.available} variant="display" tone={row.available < 0 ? 'negative' : 'text'} />
        <Text variant="callout" tone={status.tone === 'textSecondary' ? 'textSecondary' : status.tone}>
          {status.subtitle}
        </Text>
        <ProgressBar value={status.progress} color={status.overspent ? colors.negative : hue.fg} height={5} />
        <View style={{ flexDirection: 'row', gap: spacing.lg }}>
          <Stat label="Carried in" cents={row.carriedIn} />
          <Stat label="Assigned" cents={row.assigned} />
          <Stat label="Spent" cents={-row.spent} />
        </View>
      </HeroCard>

      <View style={{ gap: spacing.md }}>
        <Field
          label={`Assign in ${formatMonth(month)}`}
          value={amountText}
          onChangeText={setAmountText}
          placeholder="0.00"
          keyboardType="decimal-pad"
          inputMode="decimal"
          hint={`Ready to assign: ${formatMoney(rta)}`}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2 }}>
          {status.need > 0 && rta > 0 && (
            <Chip
              label={`${status.fillLabel} +${formatMoney(Math.min(status.need, rta))}`}
              onPress={() => apply(Math.min(status.need, rta), status.fillLabel === 'Cover' ? 'Covered' : 'Filled')}
            />
          )}
          {rta > 0 && <Chip label={`All of it +${formatMoney(rta)}`} onPress={() => apply(rta, 'Assigned')} />}
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button
            title="Assign"
            style={{ flex: 1 }}
            disabled={!amount || amount <= 0}
            onPress={() => amount && apply(amount, `Assigned ${formatMoney(amount)}`)}
          />
          <Button
            title="Take back"
            variant="secondary"
            style={{ flex: 1 }}
            disabled={!amount || amount <= 0}
            onPress={() => amount && apply(-amount, `Took back ${formatMoney(amount)}`)}
          />
        </View>
      </View>

      {row.available < 0 && donors.length > 0 && (
        <View style={{ gap: spacing.sm }}>
          <Text variant="headline">Cover it from</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2 }}>
            {donors.map((d) => {
              const take = Math.min(budget.envelopes.get(d.id)?.available ?? 0, -row.available);
              return (
                <Chip
                  key={d.id}
                  label={`${d.name} ${formatMoney(take)}`}
                  onPress={() => {
                    moveMoney(d.id, id, take, date);
                    haptic('success');
                    showToast({ message: `Moved ${formatMoney(take)} from ${d.name}` });
                  }}
                />
              );
            })}
          </View>
        </View>
      )}

      {visibleMonths.length === 0 && (
        <Text variant="callout" tone="textSecondary">
          No transactions in this envelope yet.
        </Text>
      )}
      {visibleMonths.map(([k, list]) => {
        const spent = list.reduce((a, t) => a + (t.amount < 0 ? -t.amount : 0), 0);
        return (
          <Section key={k} title={formatMonth(k)} detail={`${formatMoney(spent)} spent`} inset={ICON_INSET}>
            {list.map((t) => (
              <TransactionRow key={t.id} t={t} account={accountById.get(t.accountId)} envelope={envelope} />
            ))}
          </Section>
        );
      })}
      {!showAll && months.length > visibleMonths.length && (
        <Button title="Show older months" variant="secondary" onPress={() => setShowAll(true)} />
      )}
    </Screen>
  );
}

function Stat({ label, cents }: { label: string; cents: number }) {
  return (
    <View style={{ gap: 1 }}>
      <Text variant="caption" tone="textSecondary">
        {label}
      </Text>
      <Money cents={cents} variant="callout" weight="600" />
    </View>
  );
}
