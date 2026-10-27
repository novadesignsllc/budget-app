import { View } from 'react-native';

import type { CreditUse } from '@/domain/debt';
import { useColors } from '@/theme';

import { Text } from './text';

/** "79% used", green under 30%, yellow from 30%, red from 90% (or over the limit). */
export function CreditUsePill({ use, compact }: { use: CreditUse; compact?: boolean }) {
  const colors = useColors();
  const look =
    use.level === 'max'
      ? { bg: colors.negativeSoft, fg: colors.negative }
      : use.level === 'high'
        ? { bg: colors.cautionSoft, fg: colors.caution }
        : { bg: colors.positiveSoft, fg: colors.positive };
  const pct = Math.round(use.used * 100);
  return (
    <View
      accessibilityLabel={`${pct}% of the credit limit used`}
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: 7,
        height: compact ? 20 : 22,
        borderRadius: 6,
        justifyContent: 'center',
        backgroundColor: look.bg,
      }}
    >
      <Text
        variant={compact ? 'caption' : 'footnote'}
        weight="600"
        color={look.fg}
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {pct}% used
      </Text>
    </View>
  );
}
