import { LinearGradient } from 'expo-linear-gradient';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, spacing, useColors } from '@/theme';

/**
 * The one decorative surface in the app: a soft wash behind the most important number
 * on a screen (Ready to Assign, total debt). Used once per screen at most.
 */
export function HeroCard({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const colors = useColors();
  return (
    <View style={[{ borderRadius: radius.lg, borderCurve: 'continuous', overflow: 'hidden' }, style]}>
      <LinearGradient
        colors={[colors.heroFrom, colors.heroTo]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ padding: spacing.xl, gap: spacing.md }}
      >
        {children}
      </LinearGradient>
    </View>
  );
}
