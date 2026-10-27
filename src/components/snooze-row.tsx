import { Switch, View } from 'react-native';

import { formatMonth, type MonthKey } from '@/domain/months';
import { isSnoozed, targetSetFor } from '@/domain/targets';
import type { Envelope } from '@/domain/types';
import { useStore } from '@/store';
import { spacing, useColors } from '@/theme';
import { haptic } from '@/utils/haptics';

import { Text } from './text';

/**
 * "Snooze target in October": the target counts as nothing for just that month (no
 * yellow, Auto-assign skips it) and comes back the month after. Only for envelopes with a
 * target of their own; a debt's payment always aims for its minimum.
 */
export function SnoozeRow({ envelope, month, flat }: { envelope: Envelope; month: MonthKey; flat?: boolean }) {
  const colors = useColors();
  const snoozeTarget = useStore((s) => s.snoozeTarget);
  if (envelope.debtAccountId || !targetSetFor(envelope, month)) return null;
  const on = isSnoozed(envelope, month);
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingHorizontal: flat ? 0 : spacing.md + 2,
        paddingVertical: flat ? 0 : spacing.sm + 2,
        backgroundColor: flat ? 'transparent' : colors.surface,
      }}
    >
      <View style={{ flex: 1, gap: 1 }}>
        <Text variant="body" weight="500">
          Snooze target in {formatMonth(month)}
        </Text>
        <Text variant="footnote" tone="textSecondary">
          {on ? 'Snoozed: no target this month. It’s back next month.' : 'Skip it for this month only.'}
        </Text>
      </View>
      <Switch
        accessibilityLabel={`Snooze target in ${formatMonth(month)}`}
        value={on}
        onValueChange={(v) => {
          haptic('selection');
          snoozeTarget(envelope.id, month, v);
        }}
        trackColor={{ true: colors.accent, false: colors.fill }}
        thumbColor="#FFFFFF"
        {...({ activeThumbColor: '#FFFFFF' } as object)}
      />
    </View>
  );
}
