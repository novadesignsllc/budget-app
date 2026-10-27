import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Card, CardHeader } from '@/components/card';
import { IncomeBars } from '@/components/income-bars';
import { Money } from '@/components/money';
import { RangePills } from '@/components/range-pills';
import { Screen } from '@/components/screen';
import { ScreenTitle } from '@/components/screen-title';
import { Text } from '@/components/text';
import { TransactionRow } from '@/components/transaction-row';
import { formatDay } from '@/domain/dates';
import { formatDollars } from '@/domain/money';
import { INCOME_RANGES, useIncome, type IncomeRange } from '@/hooks/use-income';
import { useStore } from '@/store';
import { spacing, useColors } from '@/theme';

const DEPOSITS = 12;

/** "today", "yesterday", "Monday", "Oct 15". */
export function lastDay(iso: string) {
  const d = formatDay(iso);
  return /^(Today|Yesterday|Tomorrow)$/.test(d) ? d.toLowerCase() : d;
}

/** What comes in: the monthly average, month by month, who pays you, and each deposit. */
export function Income() {
  const colors = useColors();
  const [range, setRange] = useState<IncomeRange>(6);
  const [allDeposits, setAllDeposits] = useState(false);
  const data = useIncome(range);
  const accounts = useStore((s) => s.accounts);
  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const deposits = allDeposits ? data.deposits : data.deposits.slice(0, DEPOSITS);
  const stat = (label: string, cents: number) => (
    <View style={{ flex: 1, gap: 1 }}>
      <Text variant="footnote" tone="textSecondary">
        {label}
      </Text>
      <Text style={{ fontSize: 18, lineHeight: 23, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
        {formatDollars(cents)}
      </Text>
    </View>
  );

  return (
    <Screen>
      <ScreenTitle title="Income" />
      <Card>
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <View style={{ gap: 2 }}>
            <Text variant="footnote" tone="textSecondary">
              On average
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <Text
                style={{ fontSize: 32, lineHeight: 38, fontWeight: '700', letterSpacing: -0.5, fontVariant: ['tabular-nums'] }}
                tone={data.average > 0 ? 'positive' : 'text'}
              >
                {formatDollars(data.average)}
              </Text>
              <Text variant="callout" tone="textSecondary">
                a month
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.lg }}>
            {stat('This month', data.thisMonth)}
            {stat('Last month', data.lastMonth)}
            {stat('This year', data.thisYear)}
          </View>
        </View>
      </Card>

      {!data.any ? (
        <Card>
          <Text variant="callout" tone="textSecondary" style={{ padding: spacing.lg }}>
            No income yet.
          </Text>
        </Card>
      ) : (
        <>
          <Card>
            <View style={{ padding: spacing.lg, gap: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text variant="section">By month</Text>
                <RangePills options={INCOME_RANGES} value={range} onChange={setRange} />
              </View>
              <IncomeBars months={data.months} average={data.average} />
            </View>
          </Card>

          <Card>
            <CardHeader title="Who pays you" detail={range === 12 ? 'Last year' : 'Last 6 months'} />
            {data.payees.map((p, i) => (
              <View
                key={p.payee}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.md - 2,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: colors.hairline,
                }}
              >
                <View style={{ flex: 1, gap: 1 }}>
                  <Text variant="body" weight="500" numberOfLines={1}>
                    {p.payee}
                  </Text>
                  <Text variant="footnote" tone="textSecondary">
                    {p.count} {p.count === 1 ? 'deposit' : 'deposits'} · last {lastDay(p.last)}
                  </Text>
                </View>
                <Money cents={p.total} weight="600" tone="positive" />
              </View>
            ))}
          </Card>

          <Card>
            <CardHeader title="Deposits" detail={`${data.deposits.length}`} />
            {deposits.map((t, i) => (
              <TransactionRow
                key={t.id}
                t={t}
                account={accountById.get(t.accountId)}
                columns="single"
                showAccount
                last={i === deposits.length - 1}
              />
            ))}
            {data.deposits.length > DEPOSITS && (
              <Pressable
                accessibilityRole="button"
                onPress={() => setAllDeposits(!allDeposits)}
                style={({ pressed }) => ({
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.md - 2,
                  borderTopWidth: 1,
                  borderTopColor: colors.separator,
                  backgroundColor: pressed ? colors.control : colors.surface,
                })}
              >
                <Text variant="callout" weight="600" tone="accent">
                  {allDeposits ? 'Show fewer' : `Show all ${data.deposits.length} ›`}
                </Text>
              </Pressable>
            )}
          </Card>
        </>
      )}
    </Screen>
  );
}
