import { TextInput, View, type TextInputProps } from 'react-native';

import { radius, spacing, type as typeScale, useColors } from '@/theme';

import { Text } from './text';

/** A labeled input. Labels are always visible, never placeholder-only. */
export function Field({
  label,
  hint,
  error,
  style,
  ref,
  ...props
}: TextInputProps & { label: string; hint?: string; error?: string; ref?: React.Ref<React.ComponentRef<typeof TextInput>> }) {
    const colors = useColors();
    return (
      <View style={{ gap: spacing.xs }}>
        <Text variant="footnote" weight="500" tone="textSecondary" style={{ paddingHorizontal: spacing.xs }}>
          {label}
        </Text>
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textTertiary}
          style={[
            typeScale.body,
            {
              color: colors.text,
              backgroundColor: colors.fill,
              borderRadius: radius.md,
              borderCurve: 'continuous',
              paddingHorizontal: spacing.lg,
              height: 48,
            },
            error ? { borderWidth: 1, borderColor: colors.negative } : null,
            style,
          ]}
          accessibilityLabel={label}
          {...props}
        />
        {error ? (
          <Text variant="footnote" tone="negative" style={{ paddingHorizontal: spacing.xs }}>
            {error}
          </Text>
        ) : hint ? (
          <Text variant="footnote" tone="textSecondary" style={{ paddingHorizontal: spacing.xs }}>
            {hint}
          </Text>
        ) : null}
      </View>
    );
}
