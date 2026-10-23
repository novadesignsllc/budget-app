import { createElement } from 'react';
import { View } from 'react-native';

import { radius, spacing, type as typeScale, useColors } from '@/theme';

import { FieldLabel } from './field';
import { Icon } from './icon';

export type SelectOption<T extends string> = { value: T; label: string };

/** A labeled dropdown: a real <select>, styled to match the other fields. */
export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
}) {
  const colors = useColors();
  return (
    <View style={{ gap: spacing.xs + 2 }}>
      <FieldLabel label={label} />
      <View style={{ position: 'relative' }}>
        {createElement(
          'select',
          {
            value,
            'aria-label': label,
            onChange: (e: { target: { value: string } }) => onChange(e.target.value as T),
            style: {
              ...typeScale.body,
              lineHeight: 'normal',
              width: '100%',
              height: 44,
              appearance: 'none',
              WebkitAppearance: 'none',
              border: 'none',
              borderRadius: radius.md,
              background: colors.fill,
              color: colors.text,
              padding: `0 ${spacing.xxxl}px 0 ${spacing.lg - 2}px`,
              cursor: 'pointer',
            },
          },
          options.map((o) => createElement('option', { key: o.value, value: o.value }, o.label)),
        )}
        <View pointerEvents="none" style={{ position: 'absolute', right: spacing.md, top: 14 }}>
          <Icon sf="chevron.up.chevron.down" md="unfold_more" size={16} color={colors.textSecondary} />
        </View>
      </View>
    </View>
  );
}
