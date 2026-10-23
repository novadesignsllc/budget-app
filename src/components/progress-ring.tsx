import Svg, { Circle } from 'react-native-svg';
import { View } from 'react-native';

import { useColors } from '@/theme';

import { Text } from './text';

/** A ring that fills clockwise from the top, with the percent in the middle. */
export function ProgressRing({ value, size = 76, stroke = 9, color }: { value: number; size?: number; stroke?: number; color: string }) {
  const colors = useColors();
  const pct = Math.max(0, Math.min(1, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.fill} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
        <Text variant="headline" weight="700">
          {pct > 0 && pct < 0.01 ? '<1%' : `${Math.round(pct * 100)}%`}
        </Text>
      </View>
    </View>
  );
}
