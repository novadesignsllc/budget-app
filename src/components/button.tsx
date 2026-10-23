import { ActivityIndicator, Pressable, type StyleProp, type ViewStyle } from 'react-native';

import { haptic } from '@/utils/haptics';
import { radius, spacing, useColors } from '@/theme';

import { Text } from './text';

type Variant = 'primary' | 'secondary' | 'tinted' | 'destructive' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

const heights: Record<Size, number> = { sm: 32, md: 40, lg: 48 };

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
    tinted: colors.accentSoft,
    destructive: colors.negativeSoft,
    ghost: 'transparent',
  };
  const fg = {
    primary: 'onInk',
    secondary: 'text',
    tinted: 'accent',
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
          paddingHorizontal: size === 'sm' ? spacing.md : spacing.lg,
          borderRadius: radius.full,
          backgroundColor: bg[variant],
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.xs + 2,
          opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
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
