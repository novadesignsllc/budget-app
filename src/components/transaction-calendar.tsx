import { useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { dailyFlow, monthGrid } from '@/domain/calendar';
import { today } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import { monthOf, type MonthKey } from '@/domain/months';
import { useAccounts } from '@/hooks/use-ledger';
import { useStore } from '@/store';
import { spacing, useColors } from '@/theme';

import { Card } from './card';
import { Text } from './text';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const longMonth = new Intl.DateTimeFormat('en-US', { month: 'long' });

/** A day's change in a phone-width cell: "+$1.8k" past $1,000 so it fits. */
const short = (cents: number) => {
  const d = Math.ceil(Math.abs(cents) / 100);
  if (d < 1000) return dollars(cents, true);
  const k = d >= 10000 ? Math.round(d / 1000) : Math.round(d / 100) / 10;
  return `${cents < 0 ? '-' : '+'}$${k}k`;
};

/** Whole dollars, rounded up, with a sign when asked: "-$1,500", "+$500", "$0". */
const dollars = (cents: number, signed = false) => {
  const text = `$${Math.ceil(Math.abs(cents) / 100).toLocaleString('en-US')}`;
  if (cents < 0) return `-${text}`;
  return signed && cents > 0 ? `+${text}` : text;
};

/**
 * Transactions as a month calendar: each day shows its change (money in minus out), red
 * when it went down and green when it went up. Inflow, outflow and left over sit on top,
 * for the picked day or, with none picked, the whole month. Tapping a day picks it;
 * tapping it again clears it.
 */
export function TransactionCalendar({
  month,
  selected,
  onSelect,
  wide,
}: {
  month: MonthKey;
  /** The picked day of the month, or null for the whole month. */
  selected: number | null;
  onSelect: (day: number | null) => void;
  wide?: boolean;
}) {
  const colors = useColors();
  const transactions = useStore((s) => s.transactions);
  const { all: accounts } = useAccounts();
  const day = today();
  const thisMonth = monthOf(day) === month;
  const todayNumber = thisMonth ? Number(day.slice(8, 10)) : 0;
  const future = month > monthOf(day);

  const days = useMemo(() => dailyFlow(accounts, transactions, month), [accounts, transactions, month]);
  const weeks = useMemo(() => monthGrid(month), [month]);
  const total = useMemo(() => {
    if (selected !== null) return days.get(selected) ?? { inflow: 0, outflow: 0 };
    let inflow = 0;
    let outflow = 0;
    for (const d of days.values()) {
      inflow += d.inflow;
      outflow += d.outflow;
    }
    return { inflow, outflow };
  }, [days, selected]);

  const [y, m] = month.split('-').map(Number);
  const left = total.inflow - total.outflow;
  const scope =
    selected === null
      ? longMonth.format(new Date(y, m - 1, 1))
      : `${WEEKDAYS[new Date(y, m - 1, selected).getDay()]}, ${longMonth.format(new Date(y, m - 1, selected))} ${selected}`;

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

  const cellHeight = wide ? 64 : 46;
  return (
    <View style={{ gap: wide ? spacing.md : spacing.md - 2 }}>
      <Card>
        <View style={{ paddingHorizontal: spacing.md + 2, paddingVertical: spacing.md, gap: spacing.sm }}>
          <Text variant="footnote" weight="600" tone="textSecondary">
            {scope}
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            {stat('Inflow', dollars(total.inflow), total.inflow ? 'positive' : undefined)}
            {stat('Outflow', dollars(total.outflow), total.outflow ? 'negative' : undefined)}
            {stat('Left over', dollars(left, true), left < 0 ? 'negative' : left > 0 ? 'positive' : undefined)}
          </View>
        </View>
      </Card>
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
                // Every cell sits in an equal slot, so a short last week lines up with the rest.
                if (n === null)
                  return (
                    <View key={j} style={{ flex: 1, flexBasis: 0, minWidth: 0 }}>
                      <View style={{ height: cellHeight, borderRadius: 8, backgroundColor: wide ? colors.tableHeader : 'transparent' }} />
                    </View>
                  );
                const d = days.get(n);
                const net = d ? d.inflow - d.outflow : 0;
                const on = n === selected;
                const later = future || (thisMonth && n > todayNumber);
                const isToday = thisMonth && n === todayNumber;
                return (
                  <View key={j} style={{ flex: 1, flexBasis: 0, minWidth: 0 }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`${longMonth.format(new Date(y, m - 1, n))} ${n}${later ? '' : `, ${formatMoney(net, { signed: true })}`}`}
                    onPress={() => onSelect(on ? null : n)}
                    style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({
                      height: cellHeight,
                      paddingHorizontal: wide ? 8 : 1,
                      paddingVertical: wide ? 8 : 4,
                      borderRadius: 8,
                      borderCurve: 'continuous',
                      borderWidth: 1,
                      borderColor: on ? colors.accent : wide ? colors.hairline : 'transparent',
                      backgroundColor: on ? colors.accentSoft : pressed || hovered ? colors.control : colors.surface,
                      alignItems: wide ? 'flex-start' : 'center',
                      gap: wide ? 4 : 2,
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
                    {/* Days still to come have no change yet. */}
                    {!later && (
                      <Text
                        numberOfLines={1}
                        style={{ fontSize: wide ? 13 : 10, lineHeight: wide ? 17 : 12, fontWeight: '600', fontVariant: ['tabular-nums'] }}
                        color={net < 0 ? colors.negative : net > 0 ? colors.positive : colors.textTertiary}
                      >
                        {wide ? dollars(net, true) : short(net)}
                      </Text>
                    )}
                  </Pressable>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </Card>
    </View>
  );
}
