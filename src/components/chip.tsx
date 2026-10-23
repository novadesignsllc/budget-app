import { Pressable } from 'react-native';

import { haptic } from '@/utils/haptics';
import { radius, spacing, useColors } from '@/theme';

import { Text } from './text';

export function Chip({
  label,
  selected,
  tone = 'default',
  onPress,
  leading,
  accessibilityLabel,
}: {
  label: string;
  selected?: boolean;
  tone?: 'default' | 'negative' | 'muted';
  onPress?: () => void;
  leading?: React.ReactNode;
  accessibilityLabel?: string;
}) {
  const colors = useColors();
  const bg = tone === 'negative' ? colors.negativeSoft : selected ? colors.ink : colors.fill;
  const fg = tone === 'negative' ? 'negative' : selected ? 'onInk' : tone === 'muted' ? 'textSecondary' : 'text';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: !!selected }}
      disabled={!onPress}
      onPress={() => {
        haptic('selection');
        onPress?.();
      }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        height: 30,
        paddingHorizontal: spacing.md,
        borderRadius: radius.full,
        backgroundColor: pressed && !selected ? colors.fillPressed : bg,
      })}
    >
      {leading}
      <Text variant="callout" weight="500" tone={fg} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}
