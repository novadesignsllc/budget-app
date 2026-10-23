import { Pressable, View } from 'react-native';

import { haptic } from '@/utils/haptics';
import { radius, spacing, useColors } from '@/theme';

import { useDock } from './dock';
import { Icon } from './icon';
import { Text } from './text';

/**
 * The screen's search, add and selectors, bottom right just above quick-add, so the
 * app works one-handed (principle 5a). Render it as the last child of a screen.
 */
export function ScreenActions({ children }: { children: React.ReactNode }) {
  const { floatBottom } = useDock();
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        right: spacing.md,
        left: spacing.md + 40,
        bottom: floatBottom,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {children}
    </View>
  );
}

/** A button for the action bar: an icon square, or an icon with a label. */
export function ActionButton({
  icon,
  label,
  onPress,
  variant = 'outline',
  accessibilityLabel,
  disabled,
}: {
  icon?: { sf: Parameters<typeof Icon>[0]['sf']; md: Parameters<typeof Icon>[0]['md'] };
  label?: string;
  onPress: () => void;
  variant?: 'outline' | 'ink' | 'accent';
  accessibilityLabel?: string;
  disabled?: boolean;
}) {
  const colors = useColors();
  const bg = variant === 'ink' ? colors.ink : variant === 'accent' ? colors.accent : colors.surface;
  const fg = variant === 'outline' ? colors.text : colors.onInk;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled}
      onPress={() => {
        haptic('light');
        onPress();
      }}
      style={({ pressed }) => ({
        height: 34,
        minWidth: 34,
        paddingHorizontal: label ? spacing.md - 1 : 0,
        borderRadius: radius.button,
        borderWidth: variant === 'outline' ? 1 : 0,
        borderColor: colors.borderStrong,
        backgroundColor: bg,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
      })}
    >
      {icon && <Icon sf={icon.sf} md={icon.md} size={label ? 12 : 14} color={fg} weight="semibold" />}
      {label && (
        <Text variant="callout" weight="600" color={fg}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}
