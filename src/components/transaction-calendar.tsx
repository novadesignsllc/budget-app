import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { dailyFlow, monthGrid } from '@/domain/calendar';
import { today } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import { monthOf, type MonthKey } from '@/domain/months';
import { useAccounts } from '@/hooks/use-ledger';
import { useStore } from '@/store';
import { isListed, newestFirst } from '@/screens/transactions';
import { spacing, useColors } from '@/theme';

import { Card, CardHeader } from './card';
import { Text } from './text';
import { TransactionRow } from './transaction-row';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const longMonth = new Intl.DateTimeFormat('en-US', { month: 'long' });

/** The calendar shows whole dollars, rounded up. */
const dollars = (cents: number, sign: boolean) => `${sign ? '$' : ''}${Math.ceil(cents / 100).toLocaleString('en-US')}`;

/**
 * Transactions as a month calendar: each day's income (green) and spending (red), the
 * month's totals on top, and the picked day's transactions underneath (or beside it on a
 * computer).
 */
export function TransactionCalendar({ month, wide }: { month: MonthKey; wide?: boolean }) {
  const colors = useColors();
  const transactions = useStore((s) => s.transactions);
  const envelopes = useStore((s) => s.envelopes);
  const { all: accounts } = useAccounts();
  const day = today();
  const thisMonth = monthOf(day) === month;
  const todayNumber = thisMonth ? Number(day.slice(8, 10)) : 0;
  const future = month > monthOf(day);

  const days = useMemo(() => dailyFlow(accounts, transactions, month), [accounts, transactions, month]);
  const weeks = useMemo(() => monthGrid(month), [month]);
  const total = useMemo(() => {
    let income = 0;
    let spending = 0;
    for (const d of days.values()) {
      income += d.income;
      spending += d.spending;
    }
    return { income, spending };
  }, [days]);

  // Today in this month; otherwise the last day with anything, else the 1st.
  const fallback = thisMonth ? todayNumber : Math.max(1, ...days.keys());
  const [picked, setPicked] = useState<{ month: MonthKey; day: number } | null>(null);
  const selected = picked?.month === month ? picked.day : fallback;

  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const envelopeById = useMemo(() => new Map(envelopes.map((e) => [e.id, e])), [envelopes]);
  const date = `${month}-${String(selected).padStart(2, '0')}`;
  const list = useMemo(
    () => transactions.filter((t) => t.date === date && isListed(t)).sort(newestFirst),
    [transactions, date],
  );
  const [y, m] = month.split('-').map(Number);
  const weekday = WEEKDAYS[new Date(y, m - 1, selected).getDay()];
  const flow = days.get(selected);
  const summary = [flow?.income ? `${formatMoney(flow.income)} in` : '', flow?.spending ? `${formatMoney(flow.spending)} out` : '']
    .filter(Boolean)
    .join(' · ');

  const left = total.income - total.spending;
  const stat = (label: string, value: string, tone?: 'positive' | 'negative') => (
    <View style={{ flex: 1, gap: 1 }}>
      <Text variant="footnote" tone="textSecondary">
        {label}
      </Text>
      <Text
        tone={tone ?? 'text'}
        style={{ fontSize: wide ? 22 : 17, lineHeight: wide ? 28 : 22, fontWeight: '700', fontVariant: ['tabular-nums'] }}
      >
        {value}
      </Text>
    </View>
  );

  const cellHeight = wide ? 88 : 52;
  const grid = (
    <Card>
      <View style={{ padding: wide ? 10 : spacing.sm, gap: wide ? 4 : 3 }}>
        <View style={{ flexDirection: 'row', gap: wide ? 4 : 3, paddingBottom: 2 }}>
          {WEEKDAYS.map((w) => (
            <Text
              key={w}
              variant="label"
              caps={wide}
              tone="textTertiary"
              align={wide ? 'left' : 'center'}
              style={{ flex: 1, paddingLeft: wide ? 8 : 0 }}
            >
              {wide ? w.slice(0, 3) : w[0]}
            </Text>
          ))}
        </View>
        {weeks.map((week, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: wide ? 4 : 3 }}>
            {week.map((n, j) => {
              if (n === null)
                return <View key={j} style={{ flex: 1, height: cellHeight, borderRadius: 8, backgroundColor: wide ? colors.tableHeader : 'transparent' }} />;
              const d = days.get(n);
              const on = n === selected;
              const later = future || (thisMonth && n > todayNumber);
              const isToday = thisMonth && n === todayNumber;
              return (
                <Pressable
                  key={j}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${longMonth.format(new Date(y, m - 1, n))} ${n}${d?.income ? `, ${formatMoney(d.income)} in` : ''}${d?.spending ? `, ${formatMoney(d.spending)} spent` : ''}`}
                  onPress={() => setPicked({ month, day: n })}
                  style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({
                    flex: 1,
                    minWidth: 0,
                    height: cellHeight,
                    paddingHorizontal: wide ? 8 : 1,
                    paddingVertical: wide ? 8 : 4,
                    borderRadius: 8,
                    borderCurve: 'continuous',
                    borderWidth: 1,
                    borderColor: on ? colors.accent : wide ? colors.hairline : 'transparent',
                    backgroundColor: on ? colors.accentSoft : pressed || hovered ? colors.control : colors.surface,
                    alignItems: wide ? 'flex-start' : 'center',
                    gap: wide ? 2 : 1,
                  })}
                >
                  <View
                    style={{
                      minWidth: 20,
                      height: 20,
                      paddingHorizontal: 3,
                      borderRadius: 10,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: isToday ? colors.accent : 'transparent',
                    }}
                  >
                    <Text
                      style={{ fontSize: 12, lineHeight: 15, fontWeight: isToday ? '700' : '600' }}
                      color={isToday ? colors.onInk : later ? colors.disabled : colors.text}
                    >
                      {n}
                    </Text>
                  </View>
                  {d?.income ? (
                    <Text
                      numberOfLines={1}
                      style={{ fontSize: wide ? 12 : 10, lineHeight: wide ? 16 : 12, fontWeight: '600', fontVariant: ['tabular-nums'] }}
                      color={colors.positive}
                    >
                      +{dollars(d.income, !!wide)}
                    </Text>
                  ) : null}
                  {d?.spending ? (
                    <Text
                      numberOfLines={1}
                      style={{ fontSize: wide ? 12 : 10, lineHeight: wide ? 16 : 12, fontWeight: '600', fontVariant: ['tabular-nums'] }}
                      color={colors.negative}
                    >
                      {dollars(d.spending, !!wide)}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </Card>
  );

  const dayCard = (
    <Card>
      <CardHeader title={`${weekday}, ${longMonth.format(new Date(y, m - 1, selected))} ${selected}`} detail={summary || undefined} />
      {list.length === 0 ? (
        <Text variant="callout" tone="textSecondary" style={{ paddingHorizontal: spacing.md + 2, paddingVertical: spacing.md }}>
          Nothing in or out.
        </Text>
      ) : (
        list.map((t, i) => (
          <TransactionRow
            key={t.id}
            t={t}
            account={accountById.get(t.accountId)}
            envelope={t.envelopeId ? envelopeById.get(t.envelopeId) : undefined}
            columns="single"
            showAccount
            last={i === list.length - 1}
          />
        ))
      )}
    </Card>
  );

  return (
    <View style={{ gap: wide ? spacing.lg : spacing.md }}>
      <Card>
        <View style={{ flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.md + 2, paddingVertical: spacing.md }}>
          {stat('Income', dollars(total.income, true), total.income ? 'positive' : undefined)}
          {stat('Spending', dollars(total.spending, true), total.spending ? 'negative' : undefined)}
          {stat('Left over', `${left < 0 ? '-' : '+'}${dollars(Math.abs(left), true)}`)}
        </View>
      </Card>
      {wide ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, alignItems: 'flex-start' }}>
          <View style={{ flexGrow: 999, flexShrink: 1, flexBasis: 560, minWidth: 0 }}>{grid}</View>
          <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 320, maxWidth: 420 }}>{dayCard}</View>
        </View>
      ) : (
        <>
          {grid}
          {dayCard}
        </>
      )}
    </View>
  );
}
