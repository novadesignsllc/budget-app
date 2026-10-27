import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { inDemo } from '@/backend';
import { AnimatedNumber } from '@/components/animated-number';
import { Button } from '@/components/button';
import { Card, CardHeader } from '@/components/card';
import { ChartLegend, LineChart } from '@/components/line-chart';
import { MiniCard } from '@/components/mini-card';
import { Money } from '@/components/money';
import { Screen } from '@/components/screen';
import { ScreenTitle } from '@/components/screen-title';
import { AssignedAheadNote, BudgetCheckCard, MonthlyCard, useAssignedAhead } from '@/components/home-cards';
import { RangePills } from '@/components/range-pills';
import { Text } from '@/components/text';
import { DateBlock, TransactionRow } from '@/components/transaction-row';
import { useToast } from '@/components/toast';
import { addDays, daysBetween, formatDay, fromISODate, today } from '@/domain/dates';
import { budgetHealth } from '@/domain/health';
import { formatDollars, formatMoney } from '@/domain/money';
import { dueForApproval, upcoming } from '@/domain/recurring';
import { isCashAccount, type Recurring } from '@/domain/types';
import { currentMonth, useBudgetMonth } from '@/hooks/use-budget-month';
import { useAccounts, useLedger } from '@/hooks/use-ledger';
import { useWealthChart, type WealthRange } from '@/hooks/use-wealth-chart';
import { useStore } from '@/store';
import { isListed, newestFirst } from '@/screens/transactions';
import { loadSampleData } from '@/store/sample-data';
import { chartCash, chartDebt, spacing, useColors } from '@/theme';
import { envelopeEmoji } from '@/utils/envelope-emoji';
import { haptic } from '@/utils/haptics';

const RECONCILE_EVERY_DAYS = 7;
const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long' });
const monthName = new Intl.DateTimeFormat('en-US', { month: 'long' });

/** "Friday, October 23rd": Home's title is today. */
export function todayTitle(d: Date) {
  const n = d.getDate();
  const suffix =
    n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th';
  return `${weekday.format(d)}, ${monthName.format(d)} ${n}${suffix}`;
}
const monthShort = new Intl.DateTimeFormat('en-US', { month: 'short' });
const k = (cents: number) => `$${Math.round(cents / 100000)}k`;

function monthDate(key: string) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1);
}

export function Home() {
  const colors = useColors();
  const ledger = useLedger();
  const { cash, all } = useAccounts();
  const transactions = useStore((s) => s.transactions);
  const recurring = useStore((s) => s.recurring);
  const envelopes = useStore((s) => s.envelopes);
  const approve = useStore((s) => s.approveRecurring);
  const showToast = useToast((s) => s.show);
  const thisMonth = useBudgetMonth(currentMonth());

  const day = today();
  // Anything waiting for approval, then the next week of bills and subscriptions.
  const soon = [...dueForApproval(recurring, day), ...upcoming(recurring, day, 7)];
  const health = budgetHealth(ledger);
  const [range, setRange] = useState<WealthRange>(3);
  const wealth = useWealthChart(range);
  const ahead = useAssignedAhead();
  const history = wealth?.history ?? [];
  const accountById = new Map(all.map((a) => [a.id, a]));
  const envelopeById = new Map(envelopes.map((e) => [e.id, e]));
  const title = todayTitle(fromISODate(day));
  // The last 7 days, today included.
  const weekAgo = addDays(day, -6);
  const recent = transactions.filter((t) => isListed(t) && t.date >= weekAgo && t.date <= day).sort(newestFirst);

  if (all.length === 0) {
    return (
      <Screen>
        <ScreenTitle title={title} />
        <Card padded>
          <Text variant="section">Start with your checking account</Text>
          <Text variant="callout" tone="textSecondary">
            Add the account your debit card uses and type in today’s balance from your bank app. Every dollar in it
            becomes money you can give a job.
          </Text>
          <Button title="Add account" onPress={() => router.push('/new-account')} style={{ alignSelf: 'flex-start' }} />
        </Card>
        {__DEV__ && !inDemo && <Button title="Load sample data" variant="ghost" onPress={loadSampleData} />}
      </Screen>
    );
  }

  const first = history[0];
  const latest = history[history.length - 1];
  const standing = latest ? latest.cash - latest.debt : ledger.cashTotal - ledger.debtTotal;
  const change = first && latest ? standing - (first.cash - first.debt) : 0;

  function approveItem(r: Recurring) {
    approve(r.id);
    haptic('success');
    showToast({ message: `Added ${r.name} · ${formatMoney(r.amount)}` });
  }

  return (
    <Screen>
      <ScreenTitle title={title} />

      {health.short > 0 && (
        <Card tone="urgent">
          <View
            style={{ flexDirection: 'row', gap: 10, padding: spacing.md + 2, backgroundColor: colors.negativeSoft }}
          >
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: colors.negativeStrong,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text variant="body" weight="700" tone="onInk">
                !
              </Text>
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text variant="body" weight="600" tone="negative">
                Your accounts are {formatMoney(health.short)} short
              </Text>
              <Text variant="callout" color="#7A271A">
                Checking and savings hold less than your envelopes. Take money back from envelopes until they match.
              </Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.navigate('/budget')}
            style={{ paddingVertical: spacing.md - 2, paddingHorizontal: spacing.md + 2 }}
          >
            <Text variant="callout" weight="600" tone="negative">
              Fix in Budget ›
            </Text>
          </Pressable>
        </Card>
      )}

      {wealth && (
        <Card padded>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ gap: 2 }}>
              <Text variant="footnote" tone="textSecondary">
                Where you stand
              </Text>
              <AnimatedNumber variant="number" value={standing} format={(v) => formatMoney(v)} />
              {change !== 0 && (
                <Text variant="footnote" tone={change > 0 ? 'positive' : 'negative'}>
                  {change > 0 ? 'Up' : 'Down'} {formatMoney(Math.abs(change), { whole: true })} since{' '}
                  {monthShort.format(monthDate(first.month))}
                </Text>
              )}
            </View>
            <ChartLegend
              items={[
                { label: 'Cash', color: chartCash, value: formatMoney(wealth.latest.cash, { whole: true }) },
                { label: 'Debt', color: chartDebt, value: formatMoney(wealth.latest.debt, { whole: true }) },
                { label: 'Projected', color: colors.textTertiary, dashed: true },
              ]}
            />
          </View>
          <RangePills
            options={[
              { value: 3, label: 'Next 3 months' },
              { value: 6, label: '6 months' },
              { value: 12, label: '1 year' },
            ]}
            value={range}
            onChange={setRange}
          />
          <LineChart
            series={wealth.series}
            projectFrom={wealth.projectFrom}
            directLabels={false}
            xTicks={wealth.ticks}
            pointLabel={wealth.pointLabel}
            formatValue={(v) => formatMoney(v, { whole: true })}
            formatAxis={k}
            accessibilityLabel={wealth.accessibilityLabel}
          />
        </Card>
      )}

      <Card>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.navigate('/budget')}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            backgroundColor: pressed ? colors.control : colors.surface,
          })}
        >
          {thisMonth.pools ? (
            // Spending (checking) and savings, each with what's waiting for a job.
            (['spending', 'savings'] as const).map((p) => (
              <View key={p} style={{ flex: 1 }}>
                <Text variant="footnote" tone="textSecondary">
                  {p === 'spending' ? 'Spending to assign' : 'Savings to assign'}
                </Text>
                <AnimatedNumber
                  variant="title"
                  weight="600"
                  tone={thisMonth.pools![p].readyToAssign < 0 ? 'negative' : 'text'}
                  value={thisMonth.pools![p].readyToAssign}
                  format={formatDollars}
                />
              </View>
            ))
          ) : (
            <View style={{ flex: 1 }}>
              <Text variant="footnote" tone="textSecondary">
                Ready to assign
              </Text>
              <AnimatedNumber
                variant="title"
                weight="600"
                tone={ledger.readyToAssign < 0 ? 'negative' : 'text'}
                value={ledger.readyToAssign}
                format={formatDollars}
              />
            </View>
          )}
          <Text variant="callout" weight="600" tone="accent">
            Assign ›
          </Text>
        </Pressable>
        {ahead && (
          <View style={{ paddingHorizontal: spacing.lg, paddingBottom: 12, marginTop: -6 }}>
            <AssignedAheadNote />
          </View>
        )}
      </Card>

      <BudgetCheckCard />

      <MonthlyCard />

      {soon.length > 0 && (
        <Card>
          <CardHeader title="Upcoming" detail="Next 7 days" />
          {soon.map((r, i) => {
            const account = accountById.get(r.accountId);
            const onCard = !!account && !isCashAccount(account);
            const isDue = r.nextDue <= day;
            const days = daysBetween(day, r.nextDue);
            const envelope = r.envelopeId ? envelopeById.get(r.envelopeId) : undefined;
            const amount = formatMoney(r.amount);
            const when =
              days < 0
                ? `Due ${formatDay(r.nextDue, day).toLowerCase()}`
                : days === 0
                  ? 'Due today'
                  : days === 1
                    ? 'Tomorrow'
                    : `In ${days} days`;
            const sub = onCard ? `Slip on ${account?.name ?? 'a card'}` : when;
            const ink = onCard ? 'negative' : 'text';
            return (
              <View
                key={r.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingRight: isDue ? spacing.md : spacing.lg,
                  borderBottomWidth: i < soon.length - 1 ? 1 : 0,
                  borderBottomColor: colors.hairline,
                  backgroundColor: onCard ? colors.negativeSoft : colors.surface,
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${r.name}, ${amount}, ${when}`}
                  onPress={() => router.push({ pathname: '/edit-recurring', params: { id: r.id } })}
                  style={({ pressed }) => ({
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    paddingLeft: spacing.sm,
                    paddingRight: spacing.sm,
                    paddingVertical: 8,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <DateBlock date={r.nextDue} tone={onCard ? 'negative' : undefined} />
                  <Text style={{ fontSize: 17, lineHeight: 22 }}>{envelopeEmoji(envelope ?? { name: r.name })}</Text>
                  <View style={{ flex: 1, gap: 1 }}>
                    <Text variant="row" weight="600" tone={ink} numberOfLines={1}>
                      {r.name}
                    </Text>
                    <Text
                      variant="footnote"
                      tone={onCard ? 'negative' : isDue ? 'orange' : 'textSecondary'}
                      numberOfLines={1}
                    >
                      {sub}
                    </Text>
                  </View>
                  <Text variant="row" tone={ink} style={{ fontVariant: ['tabular-nums'] }}>
                    {amount}
                  </Text>
                </Pressable>
                {isDue && <Button title="Approve" variant="secondary" size="sm" onPress={() => approveItem(r)} />}
              </View>
            );
          })}
          <Pressable
            accessibilityRole="button"
            onPress={() => router.navigate('/recurring')}
            style={({ pressed }) => ({
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md - 2,
              borderTopWidth: 1,
              borderTopColor: colors.separator,
              backgroundColor: pressed ? colors.control : colors.surface,
            })}
          >
            <Text variant="callout" weight="600" tone="accent">
              All recurring ›
            </Text>
          </Pressable>
        </Card>
      )}

      <Card>
        <CardHeader title="Accounts" />
        {cash.map((a, i) => {
          const since = a.lastReconciledOn ? daysBetween(a.lastReconciledOn, day) : null;
          const stale = since === null || since >= RECONCILE_EVERY_DAYS;
          const balance = ledger.balance.get(a.id) ?? 0;
          return (
            <Pressable
              key={a.id}
              accessibilityRole="button"
              accessibilityLabel={`${a.name}, ${formatMoney(balance)}`}
              onPress={() => router.push(`/account/${a.id}`)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingHorizontal: spacing.lg,
                paddingVertical: 9,
                borderBottomWidth: i < cash.length - 1 ? 1 : 0,
                borderBottomColor: colors.hairline,
                backgroundColor: pressed ? colors.control : colors.surface,
              })}
            >
              <MiniCard face={a.order} />
              <View style={{ flex: 1, gap: 1 }}>
                <Text variant="body" weight="500" numberOfLines={1}>
                  {a.name}
                </Text>
                <Text variant="footnote" tone={stale ? 'orange' : 'textSecondary'}>
                  {since === null
                    ? 'Never reconciled'
                    : stale
                      ? `Not reconciled in ${since} days`
                      : since === 0
                        ? 'Reconciled today'
                        : `Reconciled ${since} ${since === 1 ? 'day' : 'days'} ago`}
                </Text>
              </View>
              <Money cents={balance} weight="600" tone="auto" />
            </Pressable>
          );
        })}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/new-account')}
          style={({ pressed }) => ({
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md - 2,
            borderTopWidth: 1,
            borderTopColor: colors.separator,
            backgroundColor: pressed ? colors.control : colors.surface,
          })}
        >
          <Text variant="callout" weight="600" tone="accent">
            Add account
          </Text>
        </Pressable>
      </Card>

      {recent.length > 0 && (
        <Card>
          <CardHeader title="Recent" detail="Last 7 days" />
          {recent.map((t) => (
            <TransactionRow
              key={t.id}
              t={t}
              account={accountById.get(t.accountId)}
              envelope={t.envelopeId ? envelopeById.get(t.envelopeId) : undefined}
              columns="single"
              showAccount
            />
          ))}
          <Pressable
            accessibilityRole="button"
            onPress={() => router.navigate('/transactions')}
            style={({ pressed }) => ({
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md - 2,
              borderTopWidth: 1,
              borderTopColor: colors.separator,
              backgroundColor: pressed ? colors.control : colors.surface,
            })}
          >
            <Text variant="callout" weight="600" tone="accent">
              All transactions ›
            </Text>
          </Pressable>
        </Card>
      )}

    </Screen>
  );
}
