import { Pressable, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptic } from '@/utils/haptics';
import { radius, spacing, useColors } from '@/theme';

import { Icon } from './icon';
import { Text } from './text';

/** Where floating things sit: just above the quick-add bar, within thumb reach. */
export function useFloatingBottom() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  if (process.env.EXPO_OS === 'web') return width >= 900 ? spacing.xl : 148;
  return insets.bottom + 116;
}

/** The screen's add action, bottom right, above the quick-add bar. */
export function FloatingAction({ label, onPress }: { label: string; onPress: () => void }) {
  const colors = useColors();
  const bottom = useFloatingBottom();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        haptic('light');
        onPress();
      }}
      style={({ pressed }) => ({
        position: 'absolute',
        right: spacing.lg,
        bottom,
        height: 34,
        paddingLeft: spacing.sm + 2,
        paddingRight: spacing.md + 2,
        borderRadius: radius.full,
        backgroundColor: colors.ink,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs + 2,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Icon sf="plus" md="add" size={13} color={colors.onInk} weight="bold" />
      <Text variant="callout" weight="600" tone="onInk">
        {label}
      </Text>
    </Pressable>
  );
}
