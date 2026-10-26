import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { AnimatedNumber } from '@/components/animated-number';
import { Button } from '@/components/button';
import { Card, CardHeader, TableHeader } from '@/components/card';
import { Dropdown } from '@/components/dropdown';
import { InlineAmount } from '@/components/inline-amount';
import { debtTarget } from '@/domain/debt';
import { ProgressBar } from '@/components/progress-bar';
import { Screen } from '@/components/screen';
import { ActionButton, ScreenActions } from '@/components/screen-actions';
import { ScreenTitle } from '@/components/screen-title';
import { Text } from '@/components/text';
import { useToast } from '@/components/toast';
import { TransactionRow, TXN_COLUMNS } from '@/components/transaction-row';
import { today } from '@/domain/dates';
import { ceilDollars, floorDollars, formatDollars } from '@/domain/money';
import { addMonthKey, assignDateFor, formatMonth, monthOf, type MonthKey } from '@/domain/months';
import type { Transaction } from '@/domain/types';
import { currentMonth, useBudgetMonth } from '@/hooks/use-budget-month';
import { useAccounts, useLedger } from '@/hooks/use-ledger';
import { newestFirst } from '@/screens/transactions';
import { useStore } from '@/store';
import { groupColor, spacing, useColors } from '@/theme';
import { barLevel, envelopeStatus, moneyLeftBar } from '@/utils/envelope-status';
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
  // The Assigned amount as it's typed, for the live preview.
  const [showAll, setShowAll] = useState(false);
  const [donorId, setDonorId] = useState<string>();

  // Every transaction for this envelope, newest first, grouped by month.
  const months = useMemo(() => {
    const rows = transactions
      .filter((t) => t.envelopeId === id)
      .sort(newestFirst);
    const byMonth = new Map<MonthKey, Transaction[]>();
    for (const t of rows) {
      const k = monthOf(t.date);
      const list = byMonth.get(k);
      if (list) list.push(t);
      else byMonth.set(k, [t]);
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
  const debt = debtAccount
    ? {
        owed: -(ledger.balance.get(debtAccount.id) ?? 0),
        target: debtTarget(debtAccount, -(ledger.balance.get(debtAccount.id) ?? 0)),
      }
    : undefined;
  const status = envelopeStatus(envelope, row, month, debt);
  const past = month < currentMonth();
  const left = moneyLeftBar(row, envelope);
  const level = barLevel(row);
  const barColor = past
    ? colors.textTertiary
    : level === 'over'
      ? colors.negativeStrong
      : level === 'plenty'
        ? colors.positive
        : colors.cautionDot;
  const date = assignDateFor(month, today());
  const accountById = new Map(openAccounts.map((a) => [a.id, a]));
  // The last three months; older ones load on request so the page opens quickly.
  const cutoff = addMonthKey(currentMonth(), -2);
  const visibleMonths = showAll ? months : months.filter(([k]) => k >= cutoff);

  const donors = envelopes
    .filter((e) => e.id !== id && !e.hidden && floorDollars(budget.envelopes.get(e.id)?.available ?? 0) >= 100)
    .sort((a, b) => (budget.envelopes.get(b.id)?.available ?? 0) - (budget.envelopes.get(a.id)?.available ?? 0));
  const donor = donors.find((d) => d.id === donorId) ?? donors[0];
  const take = donor ? Math.min(floorDollars(budget.envelopes.get(donor.id)?.available ?? 0), ceilDollars(-row.available)) : 0;

  return (
    <>
      <Screen>
        <ScreenTitle title={envelope.name} />

        <Card>
          <View style={{ padding: spacing.lg, paddingBottom: spacing.md, gap: spacing.sm }}>
            <View style={{ gap: 2 }}>
              <Text variant="footnote" tone="textSecondary">
                Available
              </Text>
              <AnimatedNumber
                variant="number"
                tone={row.available < 0 ? 'negative' : 'text'}
                value={row.available}
                format={formatDollars}
              />
              <Text variant="footnote" tone={status.tone}>
                {status.subtitle}
              </Text>
            </View>
            <ProgressBar
              value={level === 'over' ? 1 : left.progress}
              color={barColor}
              height={3}
            />
          </View>
          <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.separator }}>
            <Stat label="Carried in">{formatDollars(row.carriedIn)}</Stat>
            <Stat label="Assigned" accent={!past}>
              <InlineAmount
                cents={row.assigned}
                align="left"
                variant="callout"
                width={90}
                muted={past}
                accessibilityLabel={`Assigned to ${envelope.name} in ${formatMonth(month)}`}
                onCommit={(cents) => assign(id, cents - row.assigned, date)}
              />
            </Stat>
            <Stat label="Spent">{formatDollars(row.spent, 'up')}</Stat>
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
                detail: formatDollars(budget.envelopes.get(d.id)?.available ?? 0),
              }))}
            />
            <Button
              title={`Move ${formatDollars(take)}`}
              disabled={take < 100}
              onPress={() => {
                moveMoney(donor.id, id, take, date);
                haptic('success');
                showToast({
                  message: `Moved ${formatDollars(take)} from ${donor.name}`,
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
              <CardHeader title={formatMonth(k)} detail={`${formatDollars(out, 'up')} spent`} />
              <TableHeader
                columns={[
                  { label: 'Date', width: TXN_COLUMNS.date },
  { label: '', width: TXN_COLUMNS.emoji },
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
                  envelope={envelope}
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

function Stat({ label, accent, children }: { label: string; accent?: boolean; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View
      style={{
        flex: 1,
        gap: 2,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md - 2,
        backgroundColor: accent ? '#FAF9FF' : undefined,
        borderLeftWidth: accent ? 1 : 0,
        borderRightWidth: accent ? 1 : 0,
        borderColor: colors.separator,
      }}
    >
      <Text variant="label" caps tone={accent ? 'accent' : 'textTertiary'}>
        {label}
      </Text>
      {typeof children === 'string' ? (
        <Text variant="callout" weight="600" style={{ fontVariant: ['tabular-nums'] }}>
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}
