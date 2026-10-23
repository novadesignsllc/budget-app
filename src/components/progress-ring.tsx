import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useColors } from '@/theme';

/** A ring that fills clockwise from the top. Used on the Budget summary only. */
export function ProgressRing({
  value,
  size = 70,
  stroke = 10,
  color,
  accessibilityLabel,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color: string;
  accessibilityLabel?: string;
}) {
  const colors = useColors();
  const pct = Math.max(0, Math.min(1, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <View
      style={{ width: size, height: size }}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
    >
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.fill} strokeWidth={stroke} fill="none" />
        {pct > 0 && (
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
        )}
      </Svg>
    </View>
  );
}
