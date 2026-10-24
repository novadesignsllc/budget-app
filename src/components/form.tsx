import { Children, isValidElement } from 'react';
import { Pressable, TextInput, View, type TextInputProps } from 'react-native';

import { FLAG_COLORS, type FlagColor } from '@/domain/types';
import { flagHues, radius, spacing, type as typeScale, useColors } from '@/theme';
import { haptic } from '@/utils/haptics';

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

/**
 * Money is typed the way YNAB does it: digits fill in from the right, so 4 is $0.04 and
 * 4, 3, 5, 7 is $43.57. Returns plain text like "43.57" (or "" when empty). With
 * `negative`, typing a minus flips the sign.
 */
export function cleanAmount(v: string, negative = false) {
  const minus = negative && (v.match(/-/g)?.length ?? 0) % 2 === 1 ? '-' : '';
  const digits = v.replace(/\D/g, '').replace(/^0+/, '').slice(0, 9);
  if (!digits) return '';
  return minus + (parseInt(digits, 10) / 100).toFixed(2);
}

/** Whole dollars only, for budget amounts like targets: "600". */
export function cleanDollars(v: string) {
  return v.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 7);
}

/** "43.57" as "$43.57", "-12.00" as "-$12.00", with thousands commas. */
export function showAmount(v: string) {
  const negative = v.startsWith('-');
  const [whole, cents] = (negative ? v.slice(1) : v).split('.');
  const text = `$${Number(whole || 0).toLocaleString('en-US')}${cents !== undefined ? `.${cents}` : ''}`;
  return negative ? `-${text}` : text;
}

/** Props for a TextInput that takes money typed from the right. */
export function amountInputProps(value: string, onChange: (v: string) => void, negative = false) {
  return {
    value: value ? showAmount(value) : '',
    onChangeText: (v: string) => onChange(cleanAmount(v, negative)),
    keyboardType: negative ? ('numbers-and-punctuation' as const) : ('number-pad' as const),
    inputMode: 'numeric' as const,
    // Digits always land at the end, so keep the caret there.
    selection: value ? { start: showAmount(value).length, end: showAmount(value).length } : undefined,
  };
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
          {...amountInputProps(value, onChangeText, allowNegative)}
          placeholder="$0.00"
          placeholderTextColor={colors.placeholder}
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

/** Two choices side by side inside a row, like Outflow and Inflow. */
export function SegmentRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; tone?: 'negative' | 'positive' }[];
  onChange: (v: T) => void;
}) {
  const colors = useColors();
  return (
    <FormRow label={label}>
      <View
        accessibilityRole="radiogroup"
        style={{ flexDirection: 'row', padding: 2, gap: 2, borderRadius: 9, backgroundColor: colors.control }}
      >
        {options.map((o) => {
          const on = o.value === value;
          const tint = o.tone === 'negative' ? colors.negative : o.tone === 'positive' ? colors.positive : colors.text;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityLabel={o.label}
              accessibilityState={{ selected: on }}
              onPress={() => {
                if (on) return;
                haptic('selection');
                onChange(o.value);
              }}
              style={{
                height: 30,
                minWidth: 72,
                paddingHorizontal: spacing.md,
                borderRadius: 7,
                borderCurve: 'continuous',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: on ? colors.surface : 'transparent',
                borderWidth: on ? 1 : 0,
                borderColor: colors.borderStrong,
              }}
            >
              <Text variant="callout" weight={on ? '600' : '500'} color={on ? tint : colors.textSecondary}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </FormRow>
  );
}
