import { createElement } from 'react';
import { View } from 'react-native';

import type { ISODate } from '@/domain/types';
import { radius, spacing, type as typeScale, useColors } from '@/theme';

import { Text } from './text';

export function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: ISODate;
  onChange: (value: ISODate) => void;
}) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
      <Text variant="body">{label}</Text>
      {createElement('input', {
        type: 'date',
        value,
        'aria-label': label,
        onChange: (e: { target: { value: string } }) => e.target.value && onChange(e.target.value),
        style: {
          ...typeScale.callout,
          color: colors.text,
          background: colors.fill,
          border: 'none',
          borderRadius: radius.sm,
          padding: `${spacing.sm}px ${spacing.md}px`,
          colorScheme: 'light dark',
        },
      })}
    </View>
  );
}
