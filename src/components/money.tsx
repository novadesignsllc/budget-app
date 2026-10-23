import type { TextProps } from 'react-native';

import { formatMoney } from '@/domain/money';
import type { Cents } from '@/domain/types';
import type { TypeVariant } from '@/theme';

import { Text, type TextTone } from './text';

/**
 * Formats cents with tabular figures. `tone="auto"` colors negatives red and leaves
 * positives neutral, so red always means "money problem" across the app.
 */
export function Money({
  cents,
  variant = 'body',
  tone = 'text',
  signed,
  whole,
  weight,
  style,
  ...props
}: Omit<TextProps, 'children'> & {
  cents: Cents;
  variant?: TypeVariant;
  tone?: TextTone | 'auto';
  signed?: boolean;
  whole?: boolean;
  weight?: '400' | '500' | '600' | '700';
}) {
  const resolved: TextTone = tone === 'auto' ? (cents < 0 ? 'negative' : 'text') : tone;
  return (
    <Text
      variant={variant}
      tone={resolved}
      weight={weight}
      selectable
      style={[{ fontVariant: ['tabular-nums'] }, style]}
      {...props}
    >
      {formatMoney(cents, { signed, whole })}
    </Text>
  );
}
