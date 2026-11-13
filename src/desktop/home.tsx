import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { ChartLegend, LineChart } from '@/components/line-chart';
import { AssignedAheadNote, BudgetCheckCard, MonthlyCard, useAssignedAhead } from '@/components/home-cards';
import { RangePills } from '@/components/range-pills';
import { Text } from '@/components/text';
import { useToast } from '@/components/toast';
import { addDays, daysBetween, formatDay, fromISODate, today } from '@/domain/dates';
import { budgetHealth } from '@/domain/health';
import { formatDollars, formatMoney } from '@/domain/money';
import { dueForApproval, upcoming } from '@/domain/recurring';
import { isCashAccount, type Recurring } from '@/domain/types';
import { currentMonth, useBudgetMonth } from '@/hooks/use-budget-month';
import { useAccounts, useDebtPlan, useLedger } from '@/hooks/use-ledger';
import { payoffLabel } from '@/screens/debt';
import { Home, todayTitle } from '@/screens/home';
import { isListed, newestFirst } from '@/screens/transactions';
import { useWealthChart, type WealthRange } from '@/hooks/use-wealth-chart';
import { useStore } from '@/store';
import { chartCash, chartDebt, spacing, useColors } from '@/theme';
import { envelopeEmoji } from '@/utils/envelope-emoji';

import { shortDate } from './budget';
import { useLinkBank } from '@/components/bank-links';

import { DesktopBankQueue } from './bank-queue';
import { DButton, DCard, DPage, PageTitle, Spacer } from './ui';

const monthShort = new Intl.DateTimeFormat('en-US', { month: 'short' });
const monthName = new Intl.DateTimeFormat('en-US', { month: 'long' });
const k = (cents: number) => `$${Math.round(cents / 100000)}k`;
function monthDate(key: string) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1);
}

/** Home on a computer: everything at once in a grid instead of one long column. */
export function DesktopHome() {
  const linkBank = useLinkBank();
  const colors = useColors();
  const ledger = useLedger();
  const { all } = useAccounts();
  const transactions = useStore((s) => s.transactions);
  const recurring = useStore((s) => s.recurring);
  const envelopes = useStore((s) => s.envelopes);
  const settings = useStore((s) => s.settings);
  const approve = useStore((s) => s.approveRecurring);
  const showToast = useToast((s) => s.show);
  const thisMonth = useBudgetMonth(currentMonth());
  const { comparison } = useDebtPlan();
  const [range, setRange] = useState<WealthRange>(3);
  const wealth = useWealthChart(range);
  const ahead = useAssignedAhead();

  // No accounts yet: the phone's getting-started card works here too.
  if (all.length === 0) return <Home />;

  const day = today();
  const now = fromISODate(day);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - now.getDate();
  const health = budgetHealth(ledger);
  const history = wealth?.history ?? [];
  const soon = [...dueForApproval(recurring, day), ...upcoming(recurring, day, 7)];
  const accountById = new Map(all.map((a) => [a.id, a]));
  const envelopeById = new Map(envelopes.map((e) => [e.id, e]));
  const recent = transactions
    .filter((t) => isListed(t) && t.date >= addDays(day, -6) && t.date <= day)
    .sort(newestFirst)
    .slice(0, 8);

  const first = history[0];
  const latest = history[history.length - 1];
  const standing = latest ? latest.cash - latest.debt : ledger.cashTotal - ledger.debtTotal;
  const change = first && latest ? standing - (first.cash - first.debt) : 0;

  const plan = comparison?.plan;
  const nextDebt = plan?.perDebt
    .filter((d) => d.payoffMonth !== null)
    .sort((a, b) => (a.payoffMonth ?? 0) - (b.payoffMonth ?? 0))[0];
  const nextName = nextDebt ? accountById.get(nextDebt.id)?.name : undefined;
  const debtPaid = first && latest ? first.debt - latest.debt : 0;

  function approveItem(r: Recurring) {
    approve(r.id);
    showToast({ message: `Added ${r.name} · ${formatMoney(r.amount)}` });
  }

  return (
    <DPage
      title="Home"
      header={
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.md }}>
          <PageTitle>{todayTitle(now)}</PageTitle>
          <Text variant="callout" tone="textSecondary">
            {daysLeft === 0
              ? `Last day of ${monthName.format(now)}`
              : `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left in ${monthName.format(now)}`}
          </Text>
          <Spacer />
          <DButton label={linkBank.busy ? 'Opening…' : 'Link a bank'} onPress={() => void linkBank.start()} />
        </View>
      }
    >
      {health.short > 0 && (
        <DCard padded style={{ backgroundColor: colors.negativeSoft, borderColor: colors.negativeBorder }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Text variant="body" weight="600" tone="negative" style={{ flex: 1 }}>
              Your accounts are {formatMoney(health.short)} short. Checking and savings hold less than your envelopes.
            </Text>
            <DButton label="Fix in Budget" onPress={() => router.navigate('/budget')} />
          </View>
        </DCard>
      )}

      <DesktopBankQueue />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, alignItems: 'flex-start' }}>
        {wealth && (
          <DCard padded style={{ flexGrow: 2, flexShrink: 1, flexBasis: 560, minWidth: 0 }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: spacing.md,
              }}
            >
              <View style={{ gap: 2 }}>
                <Text variant="footnote" tone="textSecondary">
                  Where you stand
                </Text>
                <Text
                  style={{
                    fontSize: 30,
                    lineHeight: 36,
                    fontWeight: '700',
                    letterSpacing: -0.5,
                    color: colors.text,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {formatMoney(standing)}
                </Text>
                {change !== 0 && (
                  <Text variant="callout" weight="600" tone={change > 0 ? 'positive' : 'negative'}>
                    {change > 0 ? 'Up' : 'Down'} {formatMoney(Math.abs(change), { whole: true })} since{' '}
                    {monthShort.format(monthDate(first.month))}
                  </Text>
                )}
              </View>
              <ChartLegend
                items={[
                  { label: 'Cash', color: chartCash, value: formatMoney(latest.cash, { whole: true }) },
                  { label: 'Debt', color: chartDebt, value: formatMoney(latest.debt, { whole: true }) },
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
              height={220}
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

        <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 300, minWidth: 0, gap: spacing.lg }}>
          <BudgetCheckCard padding={18} />
          <MonthlyCard padding={18} />
          <DCard>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.navigate('/budget')}
              style={({ hovered }: { hovered?: boolean }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                padding: 18,
                backgroundColor: hovered ? colors.control : colors.surface,
              })}
            >
              {(thisMonth.pools
                ? (['spending', 'savings'] as const).map((p) => ({
                    key: p,
                    label: p === 'spending' ? 'Spending to assign' : 'Savings to assign',
                    cents: thisMonth.pools![p].readyToAssign,
                  }))
                : [{ key: 'all', label: 'Ready to assign', cents: ledger.readyToAssign }]
              ).map((x) => (
                <View key={x.key} style={{ flex: 1 }}>
                  <Text variant="footnote" tone="textSecondary">
                    {x.label}
                  </Text>
                  <Text
                    style={{ fontSize: 22, lineHeight: 28, fontWeight: '700', fontVariant: ['tabular-nums'] }}
                    tone={x.cents < 0 ? 'negative' : 'text'}
                  >
                    {formatDollars(x.cents)}
                  </Text>
                </View>
              ))}
              <Text variant="callout" weight="600" tone="accent">
                Assign ›
              </Text>
            </Pressable>
            {ahead && (
              <View style={{ paddingHorizontal: 18, paddingBottom: 12, marginTop: -6 }}>
                <AssignedAheadNote />
              </View>
            )}
          </DCard>
        </View>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, alignItems: 'flex-start' }}>
        <DCard style={{ flexGrow: 1, flexShrink: 1, flexBasis: 320, minWidth: 0 }}>
          <CardTop title="Upcoming" detail="Next 7 days" />
          {soon.length === 0 ? (
            <Empty>Nothing due this week.</Empty>
          ) : (
            soon.map((r) => {
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
              const envelope = r.envelopeId ? envelopeById.get(r.envelopeId) : undefined;
              return (
                <View
                  key={r.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.md,
                    paddingHorizontal: 18,
                    paddingVertical: 9,
                    borderTopWidth: 1,
                    borderTopColor: colors.hairline,
                    backgroundColor: onCard ? colors.negativeSoft : 'transparent',
                  }}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${r.name}, ${formatMoney(r.amount)}, ${when}`}
                    onPress={() => router.push({ pathname: '/edit-recurring', params: { id: r.id } })}
                    style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
                  >
                    <Text style={{ fontSize: 16, lineHeight: 20 }}>{envelopeEmoji(envelope ?? { name: r.name })}</Text>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text variant="body" weight="600" tone={onCard ? 'negative' : 'text'} numberOfLines={1}>
                        {r.name}
                      </Text>
                      <Text
                        variant="footnote"
                        tone={onCard ? 'negative' : isDue ? 'orange' : 'textSecondary'}
                        numberOfLines={1}
                      >
                        {onCard ? `Slip on ${account?.name ?? 'a card'}` : when}
                      </Text>
                    </View>
                    <Text variant="body" tone={onCard ? 'negative' : 'text'} style={{ fontVariant: ['tabular-nums'] }}>
                      {formatMoney(r.amount)}
                    </Text>
                  </Pressable>
                  {isDue && <DButton label="Approve" onPress={() => approveItem(r)} style={{ height: 28 }} />}
                </View>
              );
            })
          )}
          <CardLink label="All recurring ›" onPress={() => router.navigate('/recurring')} />
        </DCard>

        {plan && (
          <DCard padded style={{ flexGrow: 1, flexShrink: 1, flexBasis: 280, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="footnote" tone="textSecondary">
                Debt-free by
              </Text>
              <Pressable accessibilityRole="link" onPress={() => router.navigate('/debt')}>
                <Text variant="callout" weight="600" tone="accent">
                  Plan ›
                </Text>
              </Pressable>
            </View>
            <Text
              style={{ fontSize: 26, lineHeight: 32, fontWeight: '700', letterSpacing: -0.4 }}
              tone={plan.months == null ? 'negative' : 'text'}
            >
              {plan.months == null ? 'Never at this payment' : payoffLabel(plan.months)}
            </Text>
            <Text variant="callout" tone="textSecondary">
              {debtPaid > 0
                ? `${formatMoney(debtPaid, { whole: true })} paid since ${monthShort.format(monthDate(first.month))} · `
                : ''}
              {settings.debtStrategy === 'avalanche' ? 'Avalanche' : 'Snowball'} ·{' '}
              {formatMoney(settings.monthlyDebtPayment, { whole: true })} a month
            </Text>
            {comparison && comparison.interestSaved > 0 && (
              <Text variant="callout" weight="600" tone="positive">
                Saves {formatMoney(comparison.interestSaved, { whole: true })} in interest vs minimums
              </Text>
            )}
            {nextName && nextDebt && (
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  gap: spacing.md,
                  paddingTop: 12,
                  borderTopWidth: 1,
                  borderTopColor: colors.separator,
                }}
              >
                <Text variant="callout">
                  Up next:{' '}
                  <Text variant="callout" weight="700">
                    {nextName}
                  </Text>
                </Text>
                <Text variant="callout" tone="textSecondary">
                  paid off {payoffLabel(nextDebt.payoffMonth)}
                </Text>
              </View>
            )}
          </DCard>
        )}

        <DCard style={{ flexGrow: 1, flexShrink: 1, flexBasis: 320, minWidth: 0 }}>
          <CardTop title="Recent" detail="Last 7 days" />
          {recent.length === 0 ? (
            <Empty>Nothing in the last week.</Empty>
          ) : (
            recent.map((t) => {
              const envelope = t.envelopeId ? envelopeById.get(t.envelopeId) : undefined;
              const slip = t.kind === 'slip';
              return (
                <Pressable
                  key={t.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${t.payee}, ${formatMoney(t.amount)}. Edit`}
                  onPress={() => router.push(`/transaction/${t.id}`)}
                  style={({ hovered }: { hovered?: boolean }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.md,
                    paddingHorizontal: 18,
                    paddingVertical: 8,
                    borderTopWidth: 1,
                    borderTopColor: colors.hairline,
                    backgroundColor: hovered ? colors.tableHeader : 'transparent',
                  })}
                >
                  <Text variant="footnote" tone="textSecondary" style={{ width: 48 }}>
                    {shortDate(t.date)}
                  </Text>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text variant="callout" weight="600" numberOfLines={1}>
                      {t.payee}
                    </Text>
                    <Text variant="footnote" tone={slip ? 'negative' : 'textSecondary'} numberOfLines={1}>
                      {envelope?.name ?? (t.kind === 'income' ? 'Ready to assign' : '')}
                      {slip ? ' · slip' : ''}
                    </Text>
                  </View>
                  <Text
                    variant="callout"
                    color={t.amount > 0 ? colors.positive : slip ? colors.negative : colors.text}
                    style={{ fontVariant: ['tabular-nums'] }}
                  >
                    {formatMoney(t.amount)}
                  </Text>
                </Pressable>
              );
            })
          )}
          <CardLink label="All transactions ›" onPress={() => router.navigate('/transactions')} />
        </DCard>
      </View>
    </DPage>
  );
}

function CardTop({ title, detail }: { title: string; detail?: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 18,
        paddingTop: 16,
        paddingBottom: 10,
      }}
    >
      <Text variant="body" weight="700">
        {title}
      </Text>
      {detail ? (
        <Text variant="footnote" tone="textSecondary">
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

function CardLink({ label, onPress }: { label: string; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="link"
      onPress={onPress}
      style={({ hovered }: { hovered?: boolean }) => ({
        paddingHorizontal: 18,
        paddingVertical: 11,
        borderTopWidth: 1,
        borderTopColor: colors.separator,
        backgroundColor: hovered ? colors.control : 'transparent',
      })}
    >
      <Text variant="callout" weight="600" tone="accent">
        {label}
      </Text>
    </Pressable>
  );
}

function Empty({ children }: { children: string }) {
  return (
    <Text variant="callout" tone="textSecondary" style={{ paddingHorizontal: 18, paddingBottom: 16 }}>
      {children}
    </Text>
  );
}
