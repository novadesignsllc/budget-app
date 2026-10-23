import { TextInput, View, type TextInputProps } from 'react-native';

import { radius, spacing, type as typeScale, useColors } from '@/theme';

import { Text } from './text';

/** The label line used by every form control. "Optional" and hints sit beside it. */
export function FieldLabel({ label, optional, note }: { label: string; optional?: boolean; note?: string }) {
  return (
    <Text variant="footnote" tone="textSecondary" style={{ paddingHorizontal: 2 }}>
      {label}
      {optional ? <Text variant="footnote" tone="textTertiary">{'  ·  Optional'}</Text> : null}
      {note ? <Text variant="footnote" tone="textTertiary">{`  ·  ${note}`}</Text> : null}
    </Text>
  );
}

/** A labeled input. Labels are always visible, never placeholder-only. */
export function Field({
  label,
  optional,
  note,
  hint,
  error,
  style,
  ref,
  ...props
}: TextInputProps & {
  label: string;
  optional?: boolean;
  /** Short note beside the label. */
  note?: string;
  hint?: string;
  error?: string;
  ref?: React.Ref<React.ComponentRef<typeof TextInput>>;
}) {
  const colors = useColors();
  return (
    <View style={{ gap: 5 }}>
      <FieldLabel label={label} optional={optional} note={note} />
      <TextInput
        ref={ref}
        placeholderTextColor={colors.placeholder}
        style={[
          typeScale.body,
          {
            color: colors.text,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: error ? colors.negativeStrong : colors.borderStrong,
            borderRadius: radius.control,
            borderCurve: 'continuous',
            paddingHorizontal: spacing.md,
            height: 40,
            fontVariant: ['tabular-nums'],
          },
          style,
        ]}
        accessibilityLabel={label}
        {...props}
      />
      {error ? (
        <Text variant="footnote" tone="negative" style={{ paddingHorizontal: 2 }}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="footnote" tone="textTertiary" style={{ paddingHorizontal: 2 }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
