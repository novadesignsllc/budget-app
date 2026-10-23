import { Pressable, View } from 'react-native';

import { addMonthKey, formatMonth, type MonthKey } from '@/domain/months';
import { haptic } from '@/utils/haptics';
import { radius, spacing, useColors } from '@/theme';

import { Icon } from './icon';
import { Text } from './text';

/** ‹ October › . Tap the name to jump back to this month. */
export function MonthSwitcher({
  month,
  current,
  onChange,
}: {
  month: MonthKey;
  current: MonthKey;
  onChange: (month: MonthKey) => void;
}) {
  const colors = useColors();
  const step = (n: number) => {
    haptic('selection');
    onChange(addMonthKey(month, n));
  };
  const arrow = (dir: -1 | 1) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={dir < 0 ? 'Previous month' : 'Next month'}
      hitSlop={6}
      onPress={() => step(dir)}
      style={({ pressed }) => ({
        width: 30,
        height: 30,
        borderRadius: radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? colors.fill : 'transparent',
      })}
    >
      <Icon sf={dir < 0 ? 'chevron.left' : 'chevron.right'} md={dir < 0 ? 'chevron_left' : 'chevron_right'} size={13} weight="bold" />
    </Pressable>
  );
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: radius.full,
        padding: 2,
      }}
    >
      {arrow(-1)}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={month === current ? formatMonth(month) : `${formatMonth(month)}. Tap to go to this month`}
        onPress={() => month !== current && onChange(current)}
        style={{ paddingHorizontal: spacing.xs, minWidth: 84, alignItems: 'center' }}
      >
        <Text variant="callout" weight="600" tone={month === current ? 'text' : 'accent'}>
          {formatMonth(month)}
        </Text>
      </Pressable>
      {arrow(1)}
    </View>
  );
}
