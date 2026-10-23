import { View } from 'react-native';

import { radius, useColors } from '@/theme';

/** A thin bar. `value` is 0 to 1; anything outside is clamped. */
export function ProgressBar({ value, color, height = 4 }: { value: number; color: string; height?: number }) {
  const colors = useColors();
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
      style={{ height, borderRadius: radius.full, backgroundColor: colors.fill, overflow: 'hidden' }}
    >
      <View style={{ width: `${pct * 100}%`, height: '100%', borderRadius: radius.full, backgroundColor: color }} />
    </View>
  );
}
