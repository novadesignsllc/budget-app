import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { formatDollars } from '@/domain/money';
import type { MonthKey } from '@/domain/months';
import { chartCash, spacing, useColors } from '@/theme';

import { Text } from './text';

const shortMonth = new Intl.DateTimeFormat('en-US', { month: 'short' });
const longMonth = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
const asDate = (m: MonthKey) => new Date(Number(m.slice(0, 4)), Number(m.slice(5)) - 1, 1);

/**
 * Income per month as bars, with the monthly average as a dashed line. Tap (or hover) a
 * month to read its total above the chart; the latest month shows first.
 */
export function IncomeBars({
  months,
  average,
  height = 160,
}: {
  months: { month: MonthKey; total: number }[];
  average: number;
  height?: number;
}) {
  const colors = useColors();
  const [picked, setPicked] = useState<number | null>(null);
  const index = picked !== null && picked < months.length ? picked : months.length - 1;
  const shown = months[index];
  const max = Math.max(1, average, ...months.map((m) => m.total));
  const y = (cents: number) => Math.round((cents / max) * height);

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}>
        <Text style={{ fontSize: 20, lineHeight: 25, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
          {formatDollars(shown?.total ?? 0)}
        </Text>
        <Text variant="footnote" tone="textSecondary">
          {shown ? longMonth.format(asDate(shown.month)) : ''}
        </Text>
      </View>
      <View>
        <View style={{ height, flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
          {months.map((m, i) => (
            <Pressable
              key={m.month}
              accessibilityRole="button"
              accessibilityLabel={`${longMonth.format(asDate(m.month))}: ${formatDollars(m.total)}`}
              accessibilityState={{ selected: i === index }}
              onPress={() => setPicked(i)}
              onHoverIn={() => setPicked(i)}
              style={{ flex: 1, height, justifyContent: 'flex-end', alignItems: 'center' }}
            >
              <View
                style={{
                  width: '100%',
                  maxWidth: 36,
                  height: m.total > 0 ? Math.max(3, y(m.total)) : 0,
                  borderTopLeftRadius: 4,
                  borderTopRightRadius: 4,
                  backgroundColor: chartCash,
                  opacity: i === index ? 1 : 0.55,
                }}
              />
            </Pressable>
          ))}
        </View>
        {/* The average, dashed across every month. */}
        {average > 0 && (
          <View
            pointerEvents="none"
            style={{ position: 'absolute', left: 0, right: 0, bottom: y(average) - 1, flexDirection: 'row', alignItems: 'center' }}
          >
            <View style={{ flex: 1, borderTopWidth: 2, borderStyle: 'dashed', borderColor: colors.textSecondary }} />
          </View>
        )}
        <View style={{ height: 1, backgroundColor: colors.separator }} />
      </View>
      <View style={{ flexDirection: 'row', gap: 6, marginTop: -spacing.xs }}>
        {months.map((m, i) => (
          <Text
            key={m.month}
            variant="caption"
            weight={i === index ? '700' : '500'}
            tone={i === index ? 'text' : 'textTertiary'}
            align="center"
            numberOfLines={1}
            style={{ flex: 1 }}
          >
            {shortMonth.format(asDate(m.month))}
          </Text>
        ))}
      </View>
      {average > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 16, borderTopWidth: 2, borderStyle: 'dashed', borderColor: colors.textSecondary }} />
          <Text variant="footnote" tone="textSecondary">
            Average {formatDollars(average)} a month
          </Text>
        </View>
      )}
    </View>
  );
}
