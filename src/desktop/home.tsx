import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { useBudgetCheck } from '@/components/home-cards';
import { ChartLegend, LineChart } from '@/components/line-chart';
import { Text } from '@/components/text';
import { useToast } from '@/components/toast';
import { addDays, daysBetween, formatDay, fromISODate, today } from '@/domain/dates';
import { budgetHealth } from '@/domain/health';
import { averageMonthlyIncome } from '@/domain/history';
import { formatDollars, formatMoney } from '@/domain/money';
import { dueForApproval, recurringMonthly, upcoming } from '@/domain/recurring';
import { isCashAccount, type Recurring } from '@/domain/types';
import { currentMonth, useBudgetMonth } from '@/hooks/use-budget-month';
import { useAccounts, useDebtPlan, useLedger } from '@/hooks/use-ledger';
import { useWealthChart } from '@/hooks/use-wealth-chart';
import { payoffLabel } from '@/screens/debt';
import { Home, todayTitle } from '@/screens/home';
import { isListed, newestFirst } from '@/screens/transactions';
import { useStore } from '@/store';
import { chartCash, chartDebt, spacing, useColors } from '@/theme';

import { DesktopBankQueue } from './bank-queue';
import { shortDate } from './budget';
import { DButton, DCard, DPage, PageTitle } from './ui';

const monthName = new Intl.DateTimeFormat('en-US', { month: 'long' });
const k = (cents: number) => `$${Math.round(cents / 100000)}k`;

/**
 * Home on a computer: one summary strip on top, then what needs a look (the bank, recent
 * spending) on the left and what's coming (bills, this month, cash and debt) on the right.
 */
export function DesktopHome() {
  const colors = useColors();
  const ledger = useLedger();
  const { all } = useAccounts();
  const transactions = useStore((s) => s.transactions);
  const recurring = useStore((s) => s.recurring);
  const envelopes = useStore((s) => s.envelopes);
  const approve = useStore((s) => s.approveRecurring);
  const showToast = useToast((s) => s.show);
  const thisMonth = useBudgetMonth(currentMonth());
  const { comparison } = useDebtPlan();
  const wealth = useWealthChart(3);
  const check = useBudgetCheck();
  const costs = useMemo(() => recurringMonthly(recurring), [recurring]);
  const income = useMemo(() => averageMonthlyIncome({ accounts: all, transactions }, today()), [all, transactions]);

  // No accounts yet: the phone's getting-started card works here too.
  if (all.length === 0) return <Home />;

  const day = today();
  const now = fromISODate(day);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - now.getDate();
  const health = budgetHealth(ledger);
  const soon = [...dueForApproval(recurring, day), ...upcoming(recurring, day, 7)];
  const accountById = new Map(all.map((a) => [a.id, a]));
  const envelopeById = new Map(envelopes.map((e) => [e.id, e]));
  const recent = transactions
    .filter((t) => isListed(t) && t.date >= addDays(day, -6) && t.date <= day)
    .sort(newestFirst)
    .slice(0, 10);
  const plan = comparison?.plan;
  const toAssign = thisMonth.pools ? thisMonth.pools.spending.readyToAssign : ledger.readyToAssign;

  function approveItem(r: Recurring) {
    approve(r.id);
    showToast({ message: `Added ${r.name} · ${formatMoney(r.amount)}` });
  }

  const cell = (label: string, value: string, opts: { tone?: 'negative' | 'text'; note?: string; onPress?: () => void; last?: boolean } = {}) => (
    <Pressable
      key={label}
      accessibilityRole={opts.onPress ? 'link' : undefined}
      disabled={!opts.onPress}
      onPress={opts.onPress}
      style={({ hovered }: { hovered?: boolean }) => ({
        flexGrow: 1,
        flexBasis: 150,
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 2,
        borderRightWidth: opts.last ? 0 : 1,
        borderRightColor: colors.separator,
        backgroundColor: hovered && opts.onPress ? colors.tableHeader : 'transparent',
      })}
    >
      <Text variant="footnote" tone="textSecondary">
        {label}
      </Text>
      <Text style={{ fontSize: 19, lineHeight: 24, fontWeight: '700', fontVariant: ['tabular-nums'] }} tone={opts.tone ?? 'text'}>
        {value}
      </Text>
      {opts.note ? (
        <Text variant="caption" tone="textSecondary">
          {opts.note}
        </Text>
      ) : null}
    </Pressable>
  );

  const row = (left: string, right: string, last?: boolean) => (
    <View
      key={left}
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 9,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.hairline,
      }}
    >
      <Text variant="callout" tone="textSecondary">
        {left}
      </Text>
      <Text variant="callout" style={{ fontVariant: ['tabular-nums'] }}>
        {right}
      </Text>
    </View>
  );

  return (
    <DPage
      title="Home"
      header={
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.md }}>
          <PageTitle>Home</PageTitle>
          <Text variant="callout" tone="textSecondary">
            {todayTitle(now)} ·{' '}
            {daysLeft === 0
              ? `last day of ${monthName.format(now)}`
              : `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left in ${monthName.format(now)}`}
          </Text>
        </View>
      }
      contentStyle={{ maxWidth: 1400, width: '100%' }}
    >
      {health.short > 0 && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.negativeBorder,
            backgroundColor: colors.negativeSoft,
          }}
        >
          <Text variant="callout" weight="600" tone="negative" style={{ flex: 1 }}>
            Your accounts are {formatMoney(health.short)} short. Checking and savings hold less than your envelopes.
          </Text>
          <DButton label="Fix in Budget" onPress={() => router.navigate('/budget')} style={{ height: 30 }} />
        </View>
      )}

      <DCard style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        <View
          style={{
            flexGrow: 1.4,
            flexBasis: 220,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderRightWidth: 1,
            borderRightColor: colors.separator,
          }}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="footnote" tone="textSecondary">
              Ready to assign
            </Text>
            <Text
              style={{ fontSize: 19, lineHeight: 24, fontWeight: '700', fontVariant: ['tabular-nums'] }}
              tone={toAssign < 0 ? 'negative' : 'text'}
            >
              {formatDollars(toAssign)}
            </Text>
            {thisMonth.pools ? (
              <Text variant="caption" tone={thisMonth.pools.savings.readyToAssign < 0 ? 'negative' : 'textSecondary'}>
                Savings {formatDollars(thisMonth.pools.savings.readyToAssign)}
              </Text>
            ) : null}
          </View>
          <DButton label="Assign" variant="accent" onPress={() => router.navigate('/budget')} style={{ height: 30 }} />
        </View>
        {cell('Cash', formatDollars(ledger.cashTotal))}
        {cell('Debt', formatDollars(ledger.debtTotal), { onPress: () => router.navigate('/debt') })}
        {cell('Where you stand', formatDollars(ledger.cashTotal - ledger.debtTotal), {
          tone: ledger.cashTotal - ledger.debtTotal < 0 ? 'negative' : 'text',
        })}
        {cell('Debt-free by', plan ? (plan.months == null ? 'Never' : payoffLabel(plan.months)) : '—', {
          onPress: () => router.navigate('/debt'),
          last: true,
        })}
      </DCard>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, alignItems: 'flex-start' }}>
        <View style={{ flexGrow: 2, flexShrink: 1, flexBasis: 620, minWidth: 0, gap: spacing.lg }}>
          <DesktopBankQueue />

          <DCard>
            <CardTop title="Recent" link={{ label: 'All transactions', onPress: () => router.navigate('/transactions') }} />
            {recent.length === 0 ? (
              <Empty>Nothing in the last week.</Empty>
            ) : (
              <>
                <View
                  style={{
                    flexDirection: 'row',
                    gap: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 7,
                    backgroundColor: colors.tableHeader,
                    borderTopWidth: 1,
                    borderBottomWidth: 1,
                    borderColor: colors.separator,
                  }}
                >
                  <Label width={56}>Date</Label>
                  <Label flex>Payee</Label>
                  <Label width={160}>Envelope</Label>
                  <Label width={140}>Account</Label>
                  <Label width={100} right>
                    Amount
                  </Label>
                </View>
                {recent.map((t) => {
                  const envelope = t.envelopeId ? envelopeById.get(t.envelopeId) : undefined;
                  const slip = t.kind === 'slip';
                  const env = envelope?.name ?? (t.kind === 'income' ? 'Ready to assign' : t.kind === 'transfer' ? 'Transfer' : '');
                  return (
                    <Pressable
                      key={t.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${t.payee}, ${formatMoney(t.amount)}. Edit`}
                      onPress={() => router.push(`/transaction/${t.id}`)}
                      style={({ hovered }: { hovered?: boolean }) => ({
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                        minHeight: 36,
                        paddingHorizontal: 16,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.hairline,
                        backgroundColor: hovered ? colors.tableHeader : 'transparent',
                      })}
                    >
                      <Text variant="callout" tone="textSecondary" style={{ width: 56 }}>
                        {shortDate(t.date)}
                      </Text>
                      <Text variant="callout" weight="600" numberOfLines={1} style={{ flex: 1 }}>
                        {t.payee}
                      </Text>
                      <Text
                        variant="callout"
                        numberOfLines={1}
                        tone={t.kind === 'income' ? 'positive' : slip ? 'negative' : 'textSecondary'}
                        style={{ width: 160 }}
                      >
                        {env}
                        {slip ? ' · slip' : ''}
                      </Text>
                      <Text variant="callout" tone="textSecondary" numberOfLines={1} style={{ width: 140 }}>
                        {accountById.get(t.accountId)?.name ?? ''}
                      </Text>
                      <Text
                        variant="callout"
                        align="right"
                        color={t.amount > 0 ? colors.positive : slip ? colors.negative : colors.text}
                        style={{ width: 100, fontVariant: ['tabular-nums'] }}
                      >
                        {formatMoney(t.amount, { signed: t.amount > 0 })}
                      </Text>
                    </Pressable>
                  );
                })}
              </>
            )}
          </DCard>
        </View>

        <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 300, maxWidth: 440, minWidth: 0, gap: spacing.lg }}>
          <DCard>
            <CardTop title="Upcoming" link={{ label: 'Recurring', onPress: () => router.navigate('/recurring') }} border />
            {soon.length === 0 ? (
              <Empty>Nothing due this week.</Empty>
            ) : (
              soon.map((r, i) => {
                const account = accountById.get(r.accountId);
                const onCard = !!account && !isCashAccount(account);
                const days = daysBetween(day, r.nextDue);
                const isDue = r.nextDue <= day;
                const when =
                  days < 0
                    ? `Due ${formatDay(r.nextDue, day).toLowerCase()}`
                    : days === 0
                      ? 'Due today'
                      : days === 1
                        ? 'Tomorrow'
                        : `In ${days} days`;
                return (
                  <View
                    key={r.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.md,
                      paddingHorizontal: 16,
                      paddingVertical: 7,
                      borderBottomWidth: i === soon.length - 1 ? 0 : 1,
                      borderBottomColor: colors.hairline,
                      backgroundColor: onCard ? colors.negativeTint : 'transparent',
                    }}
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${r.name}, ${formatMoney(r.amount)}, ${when}`}
                      onPress={() => router.push({ pathname: '/edit-recurring', params: { id: r.id } })}
                      style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
                    >
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text variant="callout" weight="600" tone={onCard ? 'negative' : 'text'} numberOfLines={1}>
                          {r.name}
                        </Text>
                        <Text variant="caption" tone={onCard ? 'negative' : isDue ? 'orange' : 'textSecondary'} numberOfLines={1}>
                          {onCard ? `${when} · slip on ${account?.name ?? 'a card'}` : when}
                        </Text>
                      </View>
                      <Text variant="callout" weight="600" tone={onCard ? 'negative' : 'text'} style={{ fontVariant: ['tabular-nums'] }}>
                        {formatMoney(r.amount)}
                      </Text>
                    </Pressable>
                    {isDue && <DButton label="Approve" onPress={() => approveItem(r)} style={{ height: 28 }} />}
                  </View>
                );
              })
            )}
          </DCard>

          <DCard>
            <CardTop title="This month" border />
            <Pressable
              accessibilityRole="link"
              onPress={() => router.navigate('/budget')}
              style={({ hovered }: { hovered?: boolean }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                paddingHorizontal: 16,
                paddingVertical: 9,
                borderBottomWidth: 1,
                borderBottomColor: colors.hairline,
                backgroundColor: hovered ? colors.tableHeader : 'transparent',
              })}
            >
              <View
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: check.overspent.length ? colors.negativeStrong : check.unfunded ? colors.cautionDot : colors.positive,
                }}
              />
              <Text
                variant="callout"
                weight="600"
                style={{ flex: 1 }}
                color={check.overspent.length ? colors.negative : check.unfunded ? colors.caution : colors.positive}
              >
                {check.overspent.length
                  ? check.overspent.length === 1
                    ? `${check.overspent[0].name} is overspent`
                    : `${check.overspent.length} envelopes are overspent`
                  : check.unfunded
                    ? `${check.unfunded} ${check.unfunded === 1 ? 'target needs' : 'targets need'} ${formatDollars(check.need)}`
                    : 'Every target is funded'}
              </Text>
              <Text variant="footnote" weight="600" tone="accent">
                Budget
              </Text>
            </Pressable>
            {row('Bills', `${formatDollars(costs.bills)} a month`)}
            {row('Subscriptions', `${formatDollars(costs.subscriptions)} a month`)}
            {row('Income, on average', formatDollars(income), true)}
          </DCard>

          {wealth && (
            <DCard padded style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                <Text variant="body" weight="700" style={{ flex: 1 }}>
                  Cash and debt
                </Text>
                <Text variant="caption" tone="textSecondary">
                  Next 3 months
                </Text>
              </View>
              <ChartLegend
                items={[
                  { label: 'Cash', color: chartCash, value: formatMoney(wealth.latest.cash, { whole: true }) },
                  { label: 'Debt', color: chartDebt, value: formatMoney(wealth.latest.debt, { whole: true }) },
                ]}
              />
              <LineChart
                height={130}
                series={wealth.series}
                projectFrom={wealth.projectFrom}
                directLabels={false}
                xTicks={wealth.ticks}
                pointLabel={wealth.pointLabel}
                formatValue={(v) => formatMoney(v, { whole: true })}
                formatAxis={k}
                accessibilityLabel={wealth.accessibilityLabel}
              />
            </DCard>
          )}
        </View>
      </View>
    </DPage>
  );
}

function Label({ children, width, flex, right }: { children: string; width?: number; flex?: boolean; right?: boolean }) {
  return (
    <Text variant="label" caps tone="textTertiary" align={right ? 'right' : 'left'} style={flex ? { flex: 1 } : { width }}>
      {children}
    </Text>
  );
}

function CardTop({ title, link, border }: { title: string; link?: { label: string; onPress: () => void }; border?: boolean }) {
  const colors = useColors();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        ...(border ? { borderBottomWidth: 1, borderBottomColor: colors.separator } : {}),
      }}
    >
      <Text variant="body" weight="700" style={{ flex: 1 }}>
        {title}
      </Text>
      {link ? (
        <Pressable accessibilityRole="link" onPress={link.onPress} hitSlop={6}>
          <Text variant="footnote" weight="600" tone="accent">
            {link.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Empty({ children }: { children: string }) {
  return (
    <Text variant="callout" tone="textSecondary" style={{ paddingHorizontal: 18, paddingBottom: 16 }}>
      {children}
    </Text>
  );
}
