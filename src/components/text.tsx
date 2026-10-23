import { Text as RNText, type TextProps } from 'react-native';

import { type Palette, type TypeVariant, type as typeScale, useColors } from '@/theme';

export type TextTone = keyof Pick<
  Palette,
  'text' | 'textSecondary' | 'textTertiary' | 'accent' | 'positive' | 'negative' | 'warning' | 'onInk'
>;

export function Text({
  variant = 'body',
  tone = 'text',
  weight,
  align,
  style,
  ...props
}: TextProps & {
  variant?: TypeVariant;
  tone?: TextTone;
  weight?: '400' | '500' | '600' | '700';
  align?: 'left' | 'center' | 'right';
}) {
  const colors = useColors();
  return (
    <RNText
      style={[
        typeScale[variant],
        { color: colors[tone] },
        weight && { fontWeight: weight },
        align && { textAlign: align },
        style,
      ]}
      {...props}
    />
  );
}
