import { TextInput, View, type TextInputProps } from 'react-native';

import { radius, spacing, type as typeScale, useColors } from '@/theme';

import { Text } from './text';

/** The label line used by every form control. "Optional" sits beside it, not under it. */
export function FieldLabel({ label, optional }: { label: string; optional?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.xs + 2, paddingHorizontal: spacing.xs }}>
      <Text variant="footnote" weight="500" tone="textSecondary">
        {label}
      </Text>
      {optional && (
        <Text variant="footnote" tone="textTertiary">
          Optional
        </Text>
      )}
    </View>
  );
}

/** A labeled input. Labels are always visible, never placeholder-only. */
export function Field({
  label,
  optional,
  hint,
  error,
  style,
  ref,
  ...props
}: TextInputProps & {
  label: string;
  optional?: boolean;
  hint?: string;
  error?: string;
  ref?: React.Ref<React.ComponentRef<typeof TextInput>>;
}) {
  const colors = useColors();
  return (
    <View style={{ gap: spacing.xs + 2 }}>
      <FieldLabel label={label} optional={optional} />
      <TextInput
        ref={ref}
        placeholderTextColor={colors.placeholder}
        style={[
          typeScale.body,
          {
            color: colors.text,
            backgroundColor: colors.fill,
            borderRadius: radius.md,
            borderCurve: 'continuous',
            paddingHorizontal: spacing.lg - 2,
            height: 44,
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
