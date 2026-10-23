import { LinearGradient } from 'expo-linear-gradient';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, spacing, useColors } from '@/theme';

/**
 * The one decorative surface: a soft wash behind a screen's most important number.
 * At most one per screen, flat, no shadow.
 */
export function HeroCard({
  children,
  compact,
  style,
}: {
  children: React.ReactNode;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  return (
    <View style={[{ borderRadius: radius.xl, borderCurve: 'continuous', overflow: 'hidden' }, style]}>
      <LinearGradient
        colors={[colors.heroFrom, colors.heroTo]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ padding: compact ? spacing.lg - 2 : spacing.xl - 4, gap: compact ? spacing.xs : spacing.md }}
      >
        {children}
      </LinearGradient>
    </View>
  );
}
