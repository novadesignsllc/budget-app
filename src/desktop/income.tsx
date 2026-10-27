import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { IncomeBars } from '@/components/income-bars';
import { RangePills } from '@/components/range-pills';
import { Text } from '@/components/text';
import { formatDollars, formatMoney } from '@/domain/money';
import { INCOME_RANGES, useIncome, type IncomeRange } from '@/hooks/use-income';
import { lastDay } from '@/screens/income';
import { useStore } from '@/store';
import { spacing, useColors } from '@/theme';

import { shortDate } from './budget';
import { Label } from './register';
import { DCard, DPage, PageTitle, Spacer } from './ui';

const COL = { count: 90, last: 110, total: 120, date: 100, account: 160, amount: 120 } as const;

/** Income on a computer: the averages across the top, the months as bars, then payees and deposits side by side. */
export function DesktopIncome() {
  const colors = useColors();
  const [range, setRange] = useState<IncomeRange>(6);
  const data = useIncome(range);
  const accounts = useStore((s) => s.accounts);
  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  const head = (children: React.ReactNode) => (
    <View
      style={{
        flexDirection: 'row',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: colors.tableHeader,
        borderBottomWidth: 1,
        borderBottomColor: colors.separator,
      }}
    >
      {children}
    </View>
  );
  const row = (i: number) => ({
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    minHeight: 44,
    paddingHorizontal: 16,
    borderTopWidth: i === 0 ? 0 : 1,
    borderTopColor: colors.hairline,
  });

  return (
    <DPage
      title="Income"
      header={
        <>
          <PageTitle>Income</PageTitle>
          <Spacer />
          <RangePills options={INCOME_RANGES} value={range} onChange={setRange} />
        </>
      }
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg }}>
        <Summary label="On average, a month" value={formatDollars(data.average)} positive={data.average > 0} />
        <Summary label="This month" value={formatDollars(data.thisMonth)} />
        <Summary label="Last month" value={formatDollars(data.lastMonth)} />
        <Summary label="This year" value={formatDollars(data.thisYear)} />
      </View>

      {!data.any ? (
        <DCard padded style={{ maxWidth: 560 }}>
          <Text variant="callout" tone="textSecondary">
            No income yet.
          </Text>
        </DCard>
      ) : (
        <>
          <DCard padded>
            <IncomeBars months={data.months} average={data.average} height={200} />
          </DCard>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, alignItems: 'flex-start' }}>
            <DCard style={{ flexGrow: 1, flexBasis: 420 }}>
              {head(
                <>
                  <Label flex={1}>Who pays you</Label>
                  <Label width={COL.count} right>
                    Deposits
                  </Label>
                  <Label width={COL.last} right>
                    Last
                  </Label>
                  <Label width={COL.total} right>
                    Total
                  </Label>
                </>,
              )}
              {data.payees.map((p, i) => (
                <View key={p.payee} style={row(i)}>
                  <Text variant="body" weight="600" numberOfLines={1} style={{ flex: 1 }}>
                    {p.payee}
                  </Text>
                  <Text variant="callout" tone="textSecondary" align="right" style={{ width: COL.count, fontVariant: ['tabular-nums'] }}>
                    {p.count}
                  </Text>
                  <Text variant="callout" tone="textSecondary" align="right" style={{ width: COL.last }}>
                    {lastDay(p.last)}
                  </Text>
                  <Text variant="body" weight="600" tone="positive" align="right" style={{ width: COL.total, fontVariant: ['tabular-nums'] }}>
                    {formatMoney(p.total)}
                  </Text>
                </View>
              ))}
            </DCard>

            <DCard style={{ flexGrow: 1.4, flexBasis: 520 }}>
              {head(
                <>
                  <Label width={COL.date}>Date</Label>
                  <Label flex={1}>Payee</Label>
                  <Label width={COL.account}>Account</Label>
                  <Label width={COL.amount} right>
                    Amount
                  </Label>
                </>,
              )}
              {data.deposits.map((t, i) => (
                <Pressable
                  key={t.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${t.payee}, ${formatMoney(t.amount)}, ${shortDate(t.date)}. Open`}
                  onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: t.id } })}
                  style={({ hovered }: { hovered?: boolean }) => ({
                    ...row(i),
                    backgroundColor: hovered ? colors.control : 'transparent',
                  })}
                >
                  <Text variant="callout" tone="textSecondary" style={{ width: COL.date }}>
                    {shortDate(t.date)}
                  </Text>
                  <Text variant="body" weight="500" numberOfLines={1} style={{ flex: 1 }}>
                    {t.payee}
                  </Text>
                  <Text variant="callout" tone="textSecondary" numberOfLines={1} style={{ width: COL.account }}>
                    {accountById.get(t.accountId)?.name ?? '—'}
                  </Text>
                  <Text variant="body" weight="600" tone="positive" align="right" style={{ width: COL.amount, fontVariant: ['tabular-nums'] }}>
                    {formatMoney(t.amount)}
                  </Text>
                </Pressable>
              ))}
            </DCard>
          </View>
        </>
      )}
    </DPage>
  );
}

function Summary({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <DCard padded style={{ flexGrow: 1, flexShrink: 1, flexBasis: 200, gap: 2 }}>
      <Text variant="footnote" tone="textSecondary">
        {label}
      </Text>
      <Text style={{ fontSize: 22, lineHeight: 28, fontWeight: '700', fontVariant: ['tabular-nums'] }} tone={positive ? 'positive' : 'text'}>
        {value}
      </Text>
    </DCard>
  );
}
