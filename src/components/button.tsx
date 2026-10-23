import { ActivityIndicator, Pressable, type StyleProp, type ViewStyle } from 'react-native';

import { haptic } from '@/utils/haptics';
import { radius, spacing, useColors } from '@/theme';

import { Text } from './text';

type Variant = 'primary' | 'ink' | 'secondary' | 'destructive' | 'ghost' | 'tinted';
type Size = 'sm' | 'md' | 'lg';

const heights: Record<Size, number> = { sm: 28, md: 34, lg: 44 };

/** Rectangular buttons (principle 7). Filled for the one main action, outlined for the rest. */
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
  const look: Record<Variant, { bg: string; fg: string; border: string }> = {
    primary: { bg: colors.accent, fg: colors.onInk, border: colors.accent },
    ink: { bg: colors.ink, fg: colors.onInk, border: colors.ink },
    secondary: { bg: colors.surface, fg: colors.text, border: colors.borderStrong },
    destructive: { bg: colors.negativeSoft, fg: colors.negative, border: 'rgba(217,45,32,0.3)' },
    ghost: { bg: 'transparent', fg: colors.accent, border: 'transparent' },
    tinted: { bg: colors.accentSoft, fg: colors.accent, border: colors.accentSoft },
  };
  const l = look[variant];
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
          paddingHorizontal: size === 'sm' ? spacing.md - 1 : spacing.md + 2,
          borderRadius: radius.button,
          borderWidth: 1,
          borderColor: l.border,
          backgroundColor: l.bg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.xs + 2,
          opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={l.fg} />
      ) : (
        <>
          {leading}
          <Text variant={size === 'lg' ? 'body' : 'callout'} weight="600" color={l.fg}>
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}
