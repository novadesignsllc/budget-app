import { Text as RNText, type TextProps } from 'react-native';

import { type Palette, type TypeVariant, type as typeScale, useColors } from '@/theme';

export type TextTone = keyof Pick<
  Palette,
  | 'text'
  | 'textSecondary'
  | 'textTertiary'
  | 'placeholder'
  | 'accent'
  | 'blue'
  | 'orange'
  | 'positive'
  | 'negative'
  | 'warning'
  | 'onInk'
>;

export function Text({
  variant = 'body',
  tone = 'text',
  color,
  weight,
  align,
  caps,
  style,
  ...props
}: TextProps & {
  variant?: TypeVariant;
  tone?: TextTone;
  /** A raw color, for text on a colored surface. */
  color?: string;
  weight?: '400' | '500' | '600' | '700';
  align?: 'left' | 'center' | 'right';
  /** Uppercase, for column labels. */
  caps?: boolean;
}) {
  const colors = useColors();
  return (
    <RNText
      style={[
        typeScale[variant],
        { color: color ?? colors[tone] },
        weight && { fontWeight: weight },
        align && { textAlign: align },
        caps && { textTransform: 'uppercase' },
        style,
      ]}
      {...props}
    />
  );
}
