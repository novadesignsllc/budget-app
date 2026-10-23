import { ActivityIndicator, Pressable, type StyleProp, type ViewStyle } from 'react-native';

import { haptic } from '@/utils/haptics';
import { radius, spacing, useColors } from '@/theme';

import { Text } from './text';

type Variant = 'primary' | 'secondary' | 'accent' | 'destructive' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

const heights: Record<Size, number> = { sm: 34, md: 44, lg: 54 };

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  leading,
  style,
  accessibilityLabel,
}: {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  leading?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const colors = useColors();
  const bg: Record<Variant, string> = {
    primary: colors.ink,
    secondary: colors.fill,
    accent: colors.accent,
    destructive: colors.negativeSoft,
    ghost: 'transparent',
  };
  const fg = {
    primary: 'onInk',
    secondary: 'text',
    accent: 'onInk',
    destructive: 'negative',
    ghost: 'accent',
  } as const;
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={() => {
        haptic('light');
        onPress?.();
      }}
      style={({ pressed }) => [
        {
          height: heights[size],
          paddingHorizontal: size === 'sm' ? spacing.md : spacing.xl,
          borderRadius: radius.full,
          backgroundColor: variant === 'accent' ? colors.accent : bg[variant],
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors[fg[variant]]} />
      ) : (
        <>
          {leading}
          <Text variant={size === 'sm' ? 'callout' : 'headline'} weight="600" tone={fg[variant]}>
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}
