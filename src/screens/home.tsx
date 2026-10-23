import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { inDemo } from '@/backend';
import { AnimatedNumber } from '@/components/animated-number';
import { Button } from '@/components/button';
import { Card, CardHeader } from '@/components/card';
import { ChartLegend, LineChart } from '@/components/line-chart';
import { Icon } from '@/components/icon';
import { MiniCard } from '@/components/mini-card';
import { Money } from '@/components/money';
import { Screen } from '@/components/screen';
import { ScreenTitle } from '@/components/screen-title';
import { Text } from '@/components/text';
import { useToast } from '@/components/toast';
import { daysBetween, formatDay, fromISODate, today } from '@/domain/dates';
import { budgetHealth } from '@/domain/health';
import { balanceHistory } from '@/domain/history';
import { formatDollars, formatMoney } from '@/domain/money';
import { dueForApproval } from '@/domain/recurring';
import { isCashAccount, type Recurring } from '@/domain/types';
import { useAccounts, useLedger } from '@/hooks/use-ledger';
import { useStore } from '@/store';
import { loadSampleData } from '@/store/sample-data';
import { chartCash, chartDebt, spacing, useColors } from '@/theme';
import { haptic } from '@/utils/haptics';

const RECONCILE_EVERY_DAYS = 7;
const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
const monthShort = new Intl.DateTimeFormat('en-US', { month: 'short' });
const monthLong = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
const k = (cents: number) => `$${Math.round(cents / 100000)}k`;

function monthDate(key: string) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1);
}

export function Home() {
  const colors = useColors();
  const ledger = useLedger();
  const { cash, all } = useAccounts();
  const accounts = useStore((s) => s.accounts);
  const transactions = useStore((s) => s.transactions);
  const recurring = useStore((s) => s.recurring);
  const approve = useStore((s) => s.approveRecurring);
  const showToast = useToast((s) => s.show);

  const day = today();
  const due = dueForApproval(recurring, day);
  const health = budgetHealth(ledger);
  const history = balanceHistory({ accounts, transactions }, 12, day);
  const accountById = new Map(all.map((a) => [a.id, a]));
  const context = weekday.format(fromISODate(day));

  if (all.length === 0) {
    return (
      <Screen>
        <ScreenTitle title="Home" context={context} />
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
  // Every month when there are few; otherwise five evenly spaced.
  const ticks =
    history.length <= 7 ? history : [0, 0.25, 0.5, 0.75, 1].map((f) => history[Math.round(f * (history.length - 1))]);

  function approveItem(r: Recurring) {
    approve(r.id);
    haptic('success');
    showToast({ message: `Added ${r.name} · ${formatMoney(r.amount)}` });
  }

  return (
    <Screen>
      <ScreenTitle title="Home" context={context} />

      {health.short > 0 && (
        <Card tone="urgent">
          <View style={{ flexDirection: 'row', gap: 10, padding: spacing.md + 2, backgroundColor: colors.negativeSoft }}>
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

      {history.length > 1 && (
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
                { label: 'Cash', color: chartCash, value: formatMoney(latest.cash, { whole: true }) },
                { label: 'Debt', color: chartDebt, value: formatMoney(latest.debt, { whole: true }) },
              ]}
            />
          </View>
          <LineChart
            series={[
              { id: 'debt', label: 'Debt', color: chartDebt, values: history.map((h) => h.debt) },
              { id: 'cash', label: 'Cash', color: chartCash, values: history.map((h) => h.cash) },
            ]}
            directLabels={false}
            xTicks={ticks.map((t) => monthShort.format(monthDate(t.month)))}
            pointLabel={(i) => monthLong.format(monthDate(history[i].month))}
            formatValue={(v) => formatMoney(v, { whole: true })}
            formatAxis={k}
            accessibilityLabel={`Cash went from ${formatMoney(first.cash, { whole: true })} to ${formatMoney(latest.cash, { whole: true })} and debt from ${formatMoney(first.debt, { whole: true })} to ${formatMoney(latest.debt, { whole: true })} over the last ${history.length} months.`}
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
          <Text variant="callout" weight="600" tone="accent">
            Assign ›
          </Text>
        </Pressable>
      </Card>

      {due.length > 0 && (
        <Card>
          <CardHeader
            title="To approve"
            detail={`${due.length} due`}
            icon={{ sf: 'calendar', md: 'calendar_month', color: colors.orange, bg: colors.orangeSoft }}
          />
          {due.map((r, i) => {
            const account = accountById.get(r.accountId);
            const onCard = !!account && !isCashAccount(account);
            const overdue = r.nextDue < day;
            return (
              <View
                key={r.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  paddingRight: spacing.lg,
                  borderBottomWidth: i < due.length - 1 ? 1 : 0,
                  borderBottomColor: colors.hairline,
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/edit-recurring', params: { id: r.id } })}
                  style={({ pressed }) => ({
                    flex: 1,
                    gap: 1,
                    paddingLeft: spacing.lg,
                    paddingVertical: 9,
                    backgroundColor: pressed ? colors.control : colors.surface,
                  })}
                >
                  <Text variant="body" weight="500" tone={onCard ? 'negative' : 'text'}>
                    {r.name}
                  </Text>
                  <Text
                    variant="footnote"
                    tone={onCard ? 'negative' : overdue ? 'orange' : 'textSecondary'}
                    numberOfLines={1}
                  >
                    {[formatDay(r.nextDue), formatMoney(r.amount), account?.name, onCard ? 'slip' : null]
                      .filter(Boolean)
                      .join(' \u00b7 ')}
                  </Text>
                </Pressable>
                <Button title="Approve" variant="secondary" size="sm" onPress={() => approveItem(r)} />
              </View>
            );
          })}
        </Card>
      )}

      <Card>
        <CardHeader title="Accounts" detail="Tap one to reconcile" />
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

      {/* Settings lives at the bottom of Home instead of in the tab bar. */}
      <Card>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Settings"
          onPress={() => router.push('/settings')}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            backgroundColor: pressed ? colors.control : colors.surface,
          })}
        >
          <View
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              backgroundColor: colors.control,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon sf="gearshape" md="settings" size={16} color={colors.textSecondary} />
          </View>
          <View style={{ flex: 1, gap: 1 }}>
            <Text variant="section">Settings</Text>
            <Text variant="footnote" tone="textSecondary">
              Payees, demo, sign out
            </Text>
          </View>
          <Icon sf="chevron.right" md="chevron_right" size={12} color={colors.textTertiary} weight="semibold" />
        </Pressable>
      </Card>
    </Screen>
  );
}
