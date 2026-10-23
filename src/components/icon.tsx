import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ColorValue } from 'react-native';

import { useColors } from '@/theme';

type SFName = Extract<SymbolViewProps['name'], string>;
type MaterialName = NonNullable<Exclude<SymbolViewProps['name'], string>['android']>;

/** SF Symbols on iOS, Material Symbols on Android and web. */
export function Icon({
  sf,
  md,
  size = 20,
  color,
  weight,
}: {
  sf: SFName;
  md: MaterialName;
  size?: number;
  color?: ColorValue;
  weight?: 'regular' | 'medium' | 'semibold' | 'bold';
}) {
  const colors = useColors();
  return (
    <SymbolView
      name={{ ios: sf, android: md, web: md }}
      size={size}
      tintColor={color ?? colors.text}
      weight={weight}
      resizeMode="scaleAspectFit"
    />
  );
}
