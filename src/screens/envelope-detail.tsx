import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { Card, CardHeader, TableHeader } from '@/components/card';
import { Dropdown } from '@/components/dropdown';
import { Field } from '@/components/field';
import { Money } from '@/components/money';
import { ProgressBar } from '@/components/progress-bar';
import { Screen } from '@/components/screen';
import { ActionButton, ScreenActions } from '@/components/screen-actions';
import { ScreenTitle } from '@/components/screen-title';
import { Text } from '@/components/text';
import { useToast } from '@/components/toast';
import { TransactionRow, TXN_COLUMNS } from '@/components/transaction-row';
import { today } from '@/domain/dates';
import { formatMoney, parseMoney } from '@/domain/money';
import { addMonthKey, assignDateFor, formatMonth, monthOf, type MonthKey } from '@/domain/months';
import type { Transaction } from '@/domain/types';
import { currentMonth, useBudgetMonth } from '@/hooks/use-budget-month';
import { useAccounts, useLedger } from '@/hooks/use-ledger';
import { useStore } from '@/store';
import { groupColor, spacing, useColors } from '@/theme';
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
  const [amountText, setAmountText] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [donorId, setDonorId] = useState<string>();

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
        <ScreenTitle title="Envelope" />
        <Text variant="body" tone="textSecondary" align="center">
          This envelope is gone.
        </Text>
      </Screen>
    );
  }

  const row = budget.envelopes.get(id) ?? {
    assigned: 0,
    activity: 0,
    spent: 0,
    carriedIn: 0,
    available: 0,
  };
  const debtAccount = accounts.find((a) => a.id === envelope.debtAccountId);
  const status = envelopeStatus(
    envelope,
    row,
    month,
    debtAccount
      ? {
          owed: -(ledger.balance.get(debtAccount.id) ?? 0),
          minPayment: debtAccount.minPayment,
        }
      : undefined,
  );
  const rta = budget.readyToAssign;
  const date = assignDateFor(month, today());
  const amount = parseMoney(amountText);
  const accountById = new Map(openAccounts.map((a) => [a.id, a]));
  const cutoff = addMonthKey(currentMonth(), -11);
  const visibleMonths = showAll ? months : months.filter(([k]) => k >= cutoff);

  const donors = envelopes
    .filter((e) => e.id !== id && !e.hidden && (budget.envelopes.get(e.id)?.available ?? 0) > 0)
    .sort((a, b) => (budget.envelopes.get(b.id)?.available ?? 0) - (budget.envelopes.get(a.id)?.available ?? 0));
  const donor = donors.find((d) => d.id === donorId) ?? donors[0];
  const take = donor ? Math.min(budget.envelopes.get(donor.id)?.available ?? 0, -row.available) : 0;

  function apply(cents: number, label: string) {
    assign(id, cents, date);
    haptic('success');
    setAmountText('');
    showToast({ message: label });
  }

  return (
    <>
      <Screen>
        <ScreenTitle title={envelope.name} context={formatMonth(month)} />

        <Card padded>
          <View style={{ gap: 2 }}>
            <Text variant="footnote" tone="textSecondary">
              Available
            </Text>
            <Money cents={row.available} variant="number" tone="auto" />
            <Text variant="footnote" tone={status.tone}>
              {status.subtitle}
            </Text>
          </View>
          <ProgressBar
            value={status.progress}
            color={status.overspent ? colors.negativeStrong : groupColor(envelope.group)}
            height={3}
          />
          <View style={{ flexDirection: 'row' }}>
            <Stat label="Carried in" cents={row.carriedIn} />
            <Stat label="Assigned" cents={row.assigned} />
            <Stat label="Spent" cents={row.spent} />
          </View>
        </Card>

        <Card padded>
          <Field
            label={`Assign in ${formatMonth(month)}`}
            note={`${formatMoney(rta)} ready`}
            value={amountText}
            onChangeText={setAmountText}
            placeholder="0.00"
            keyboardType="decimal-pad"
            inputMode="decimal"
          />
          {rta > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {status.need > 0 && (
                <Button
                  title={`${status.fillLabel} ${formatMoney(Math.min(status.need, rta))}`}
                  variant="secondary"
                  size="sm"
                  onPress={() => apply(Math.min(status.need, rta), status.fillLabel === 'Cover' ? 'Covered' : 'Filled')}
                />
              )}
              <Button
                title={`All of it ${formatMoney(rta)}`}
                variant="secondary"
                size="sm"
                onPress={() => apply(rta, 'Assigned')}
              />
            </View>
          )}
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
        </Card>

        {row.available < 0 && donor && (
          <Card padded>
            <Dropdown
              label="Cover it from"
              value={donor.id}
              onChange={setDonorId}
              searchable={donors.length > 8}
              options={donors.map((d) => ({
                value: d.id,
                label: d.name,
                dot: groupColor(d.group),
                section: d.group,
                detail: formatMoney(budget.envelopes.get(d.id)?.available ?? 0),
              }))}
            />
            <Button
              title={`Move ${formatMoney(take)}`}
              onPress={() => {
                moveMoney(donor.id, id, take, date);
                haptic('success');
                showToast({
                  message: `Moved ${formatMoney(take)} from ${donor.name}`,
                });
              }}
            />
          </Card>
        )}

        {visibleMonths.length === 0 && (
          <Text variant="footnote" tone="textSecondary" align="center">
            No transactions in this envelope yet.
          </Text>
        )}
        {visibleMonths.map(([k, list]) => {
          const out = list.reduce((a, t) => a + (t.amount < 0 ? -t.amount : 0), 0);
          return (
            <Card key={k}>
              <CardHeader title={formatMonth(k)} detail={`${formatMoney(out)} spent`} />
              <TableHeader
                columns={[
                  { label: 'Date', width: TXN_COLUMNS.date },
                  { label: 'Payee' },
                  { label: 'Out', width: TXN_COLUMNS.money, align: 'right' },
                  { label: 'In', width: TXN_COLUMNS.money, align: 'right' },
                ]}
              />
              {/* No envelope name on these rows: every one is this envelope. */}
              {list.map((t, i) => (
                <TransactionRow
                  key={t.id}
                  t={t}
                  account={accountById.get(t.accountId)}
                  showAccount
                  last={i === list.length - 1}
                />
              ))}
            </Card>
          );
        })}
        {!showAll && months.length > visibleMonths.length && (
          <Button title="Show older months" variant="ghost" onPress={() => setShowAll(true)} />
        )}
      </Screen>

      {!envelope.debtAccountId && (
        <ScreenActions>
          <ActionButton
            icon={{ sf: 'slider.horizontal.3', md: 'tune' }}
            label="Edit"
            accessibilityLabel="Edit envelope"
            onPress={() => router.push({ pathname: '/envelope/[id]', params: { id, month } })}
          />
        </ScreenActions>
      )}
    </>
  );
}

function Stat({ label, cents }: { label: string; cents: number }) {
  return (
    <View style={{ flex: 1, gap: 1 }}>
      <Text variant="caption" tone="textSecondary">
        {label}
      </Text>
      <Money cents={cents} variant="callout" weight="600" />
    </View>
  );
}
