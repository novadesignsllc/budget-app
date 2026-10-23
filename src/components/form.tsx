import { Children, isValidElement } from 'react';
import { Pressable, TextInput, View, type TextInputProps } from 'react-native';

import { FLAG_COLORS, type FlagColor } from '@/domain/types';
import { flagHues, radius, spacing, type as typeScale, useColors } from '@/theme';
import { haptic } from '@/utils/haptics';
import { dismissKeyboard } from '@/utils/keyboard';

import { Card } from './card';
import { Icon } from './icon';
import { Text } from './text';

/** Every row in a sheet's card is this tall: inputs, dropdowns, dates, the flag picker. */
export const FORM_ROW_HEIGHT = 46;

/**
 * The one card every sheet uses: rows with the label on the left and the value on the right.
 * It draws the dividers, so rows never draw their own.
 */
export function FormCard({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <Card style={{ borderRadius: radius.menu }}>
      {rows.map((row, i) => (
        <View
          key={row.key ?? i}
          style={{ borderBottomWidth: i < rows.length - 1 ? 1 : 0, borderBottomColor: colors.hairline }}
        >
          {row}
        </View>
      ))}
    </Card>
  );
}

/** A label on the left and anything on the right. */
export function FormRow({ label, children, tone }: { label: string; children?: React.ReactNode; tone?: 'negative' }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: FORM_ROW_HEIGHT,
        paddingHorizontal: spacing.md,
        gap: spacing.sm,
      }}
    >
      <Text variant="body" tone={tone ?? 'textSecondary'} style={{ flex: 1 }} numberOfLines={1}>
        {label}
      </Text>
      {children}
    </View>
  );
}

/** A typed value, right-aligned in its row. */
export function InputRow({
  label,
  ref,
  style,
  ...props
}: TextInputProps & { label: string; ref?: React.Ref<React.ComponentRef<typeof TextInput>> }) {
  const colors = useColors();
  return (
    <FormRow label={label}>
      <TextInput
        ref={ref}
        placeholderTextColor={colors.placeholder}
        accessibilityLabel={label}
        {...props}
        style={[
          typeScale.body,
          {
            flex: 1.6,
            height: FORM_ROW_HEIGHT,
            textAlign: 'right',
            fontWeight: '500',
            color: colors.text,
            fontVariant: ['tabular-nums'],
            outlineWidth: 0,
          },
          style,
        ]}
      />
    </FormRow>
  );
}

/** "85.30" shown as "$85.30"; typing keeps only digits, one point, and a leading minus if allowed. */
function cleanAmount(v: string, negative: boolean) {
  const minus = negative && v.trim().startsWith('-') ? '-' : '';
  const digits = v.replace(/[^0-9.]/g, '');
  const [whole, ...rest] = digits.split('.');
  return minus + (rest.length ? `${whole}.${rest.join('').slice(0, 2)}` : whole);
}

function showAmount(v: string) {
  return v.startsWith('-') ? `-$${v.slice(1)}` : `$${v}`;
}

/** The big amount at the top of a sheet. Editable when given `onChangeText`. */
export function AmountHero({
  value,
  onChangeText,
  caption,
  tone,
  allowNegative = false,
  ref,
  ...props
}: Omit<TextInputProps, 'value' | 'onChangeText'> & {
  /** Plain amount text, like "85.30". */
  value: string;
  onChangeText?: (v: string) => void;
  /** A small line above the amount, like the payee in quick-add. */
  caption?: string;
  tone?: 'negative' | 'positive';
  /** For balances that can be below zero. */
  allowNegative?: boolean;
  ref?: React.Ref<React.ComponentRef<typeof TextInput>>;
}) {
  const colors = useColors();
  const color = tone === 'negative' ? colors.negative : tone === 'positive' ? colors.positive : colors.text;
  const style = [typeScale.display, { fontSize: 36, lineHeight: 44, letterSpacing: -0.8, color, textAlign: 'center' as const }];
  return (
    <View style={{ alignItems: 'center', gap: 2, paddingVertical: 2 }}>
      {caption ? (
        <Text variant="callout" tone="textSecondary" numberOfLines={1}>
          {caption}
        </Text>
      ) : null}
      {onChangeText ? (
        <TextInput
          ref={ref}
          value={value ? showAmount(value) : ''}
          onChangeText={(v) => onChangeText(cleanAmount(v, allowNegative))}
          placeholder="$0.00"
          placeholderTextColor={colors.placeholder}
          keyboardType={allowNegative ? 'numbers-and-punctuation' : 'decimal-pad'}
          inputMode="decimal"
          accessibilityLabel="Amount"
          {...props}
          style={[style, { alignSelf: 'stretch', height: 48, outlineWidth: 0 }]}
        />
      ) : (
        <Text style={[style, !value && { color: colors.placeholder }]}>{value ? showAmount(value) : '$0.00'}</Text>
      )}
    </View>
  );
}

/** None plus six colors. The picked one gets a ring and a check. */
export function FlagRow({ value, onChange }: { value: FlagColor | null; onChange: (flag: FlagColor | null) => void }) {
  const colors = useColors();
  const pick = (flag: FlagColor | null) => {
    haptic('selection');
    dismissKeyboard();
    onChange(flag);
  };
  const ring = (color: string, on: boolean) =>
    on ? { outlineWidth: 2, outlineColor: color, outlineOffset: 2, outlineStyle: 'solid' as const } : null;
  return (
    <FormRow label="Flag">
      <View style={{ flexDirection: 'row', gap: 10, paddingVertical: 4 }}>
        <Pressable
          accessibilityRole="radio"
          accessibilityLabel="No flag"
          accessibilityState={{ selected: value === null }}
          hitSlop={4}
          onPress={() => pick(null)}
          style={[
            {
              width: 24,
              height: 24,
              borderRadius: 12,
              borderWidth: 1.5,
              borderColor: colors.borderStrong,
              backgroundColor: colors.surface,
              alignItems: 'center',
              justifyContent: 'center',
            },
            ring(colors.text, value === null),
          ]}
        >
          <View style={{ width: 15, height: 1.5, backgroundColor: colors.textTertiary, transform: [{ rotate: '-45deg' }] }} />
        </Pressable>
        {FLAG_COLORS.map((flag) => {
          const on = value === flag;
          return (
            <Pressable
              key={flag}
              accessibilityRole="radio"
              accessibilityLabel={`${flag} flag`}
              accessibilityState={{ selected: on }}
              hitSlop={4}
              onPress={() => pick(flag)}
              style={[
                {
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: flagHues[flag],
                  alignItems: 'center',
                  justifyContent: 'center',
                },
                ring(flagHues[flag], on),
              ]}
            >
              {on && <Icon sf="checkmark" md="check" size={11} color="#FFFFFF" weight="bold" />}
            </Pressable>
          );
        })}
      </View>
    </FormRow>
  );
}

export type FormAction = { title: string; onPress: () => void; tone?: 'negative'; disabled?: boolean };

/** Secondary actions under Save, one centered line each, in a single card. */
export function ActionList({ actions }: { actions: FormAction[] }) {
  const colors = useColors();
  return (
    <FormCard>
      {actions.map((a) => (
        <Pressable
          key={a.title}
          accessibilityRole="button"
          disabled={a.disabled}
          onPress={a.onPress}
          style={({ pressed }) => ({
            height: FORM_ROW_HEIGHT,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: spacing.md,
            backgroundColor: pressed ? colors.control : colors.surface,
            opacity: a.disabled ? 0.45 : 1,
          })}
        >
          <Text variant="body" weight="500" tone={a.tone === 'negative' ? 'negative' : 'text'} numberOfLines={1}>
            {a.title}
          </Text>
        </Pressable>
      ))}
    </FormCard>
  );
}
