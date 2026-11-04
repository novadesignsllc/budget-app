import { Children, isValidElement, useRef } from 'react';
import { Pressable, TextInput, View, type TextInputProps } from 'react-native';

import { showAmount } from '@/domain/amount-text';
import type { KeypadMode, KeypadUnit } from '@/domain/keypad';
import { FLAG_COLORS, type FlagColor } from '@/domain/types';
import { flagHues, radius, spacing, type as typeScale, useColors } from '@/theme';
import { haptic } from '@/utils/haptics';

import { Card } from './card';
import { Icon } from './icon';
import { useIsDesktop } from './dock';
import { Caret, useKeypadField, type KeypadFieldHandle } from './keypad';
import { TypedAmount } from './typed-amount';
import { useSheetReveal } from './screen';
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

export { cleanAmount, cleanDollars, showAmount } from '@/domain/amount-text';

/**
 * The big amount at the top of a sheet. Editable when given `onChangeText`: tapping it
 * brings up the number pad (with + and − for quick math).
 */
export function AmountHero({
  value,
  onChangeText,
  caption,
  tone,
  allowNegative = false,
  placeholder = '$0.00',
  autoFocus,
  ref,
}: {
  /** Plain amount text, like "85.30". */
  value: string;
  onChangeText?: (v: string) => void;
  /** A small line above the amount. */
  caption?: string;
  tone?: 'negative' | 'positive';
  /** For balances that can be below zero. */
  allowNegative?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  ref?: React.Ref<KeypadFieldHandle>;
}) {
  const colors = useColors();
  // A computer types straight into the amount; the phone opens the number pad.
  const desktop = useIsDesktop();
  const pad = useKeypadField({
    value,
    onChange: onChangeText,
    negative: allowNegative,
    ref: desktop ? undefined : ref,
    autoFocus: autoFocus && !!onChangeText && !desktop,
  });
  const color = tone === 'negative' ? colors.negative : tone === 'positive' ? colors.positive : colors.text;
  const style = [typeScale.display, { fontSize: 36, lineHeight: 44, letterSpacing: -0.8, color, fontVariant: ['tabular-nums' as const] }];
  if (desktop && onChangeText) {
    return (
      <View style={{ alignItems: 'center', gap: 2, paddingVertical: 2 }}>
        {caption ? (
          <Text variant="callout" tone="textSecondary" numberOfLines={1}>
            {caption}
          </Text>
        ) : null}
        <TypedAmount
          ref={ref}
          value={value}
          onChange={onChangeText}
          negative={allowNegative}
          autoFocus={autoFocus}
          placeholder={placeholder}
          accessibilityLabel={caption ?? 'Amount'}
          style={[...style, { alignSelf: 'stretch', height: 48, textAlign: 'center' }]}
        />
      </View>
    );
  }
  const shown = onChangeText ? pad.text : value ? showAmount(value) : '';
  return (
    <View style={{ alignItems: 'center', gap: 2, paddingVertical: 2 }}>
      {caption ? (
        <Text variant="callout" tone="textSecondary" numberOfLines={1}>
          {caption}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole={onChangeText ? 'button' : 'text'}
        accessibilityLabel={`Amount, ${shown || 'empty'}`}
        disabled={!onChangeText}
        onPress={pad.open}
        style={{ alignSelf: 'stretch', height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={[style, !shown && { color: colors.placeholder }]} numberOfLines={1} adjustsFontSizeToFit>
          {shown || placeholder}
        </Text>
        {pad.active && <Caret height={34} />}
      </Pressable>
    </View>
  );
}

/**
 * A number in a form row: label on the left, the value on the right, typed on the number
 * pad. `onCommit` gets the final text when the pad closes for it (to save right away, like the debt page).
 */
export function AmountRow({
  label,
  value,
  onChange,
  onCommit,
  placeholder = '$0.00',
  mode = 'cents',
  unit = 'money',
  negative = false,
  ref,
}: {
  label: string;
  value: string;
  onChange: (text: string) => void;
  onCommit?: (text: string) => void;
  placeholder?: string;
  mode?: KeypadMode;
  unit?: KeypadUnit;
  negative?: boolean;
  ref?: React.Ref<KeypadFieldHandle>;
}) {
  const colors = useColors();
  const reveal = useSheetReveal();
  const row = useRef<React.ComponentRef<typeof View>>(null);
  const desktop = useIsDesktop();
  const pad = useKeypadField({ value, onChange, mode, unit, negative, onClose: onCommit, ref: desktop ? undefined : ref });
  if (desktop) {
    return (
      <FormRow label={label}>
        <TypedAmount
          ref={ref}
          value={value}
          onChange={onChange}
          onCommit={onCommit}
          mode={mode}
          unit={unit}
          negative={negative}
          placeholder={placeholder}
          accessibilityLabel={label}
          style={[typeScale.body, { fontWeight: '500', textAlign: 'right', height: 30, minWidth: 140 }]}
        />
      </FormRow>
    );
  }
  return (
    <Pressable
      ref={row}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${pad.text || 'empty'}`}
      onPress={() => {
        pad.open();
        // Once the pad is up, scroll so this row sits above it.
        setTimeout(() => reveal(row.current), 120);
      }}
      style={({ pressed }) => ({ backgroundColor: pad.active ? colors.accentSoft : pressed ? colors.control : colors.surface })}
    >
      <FormRow label={label}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text
            variant="body"
            weight="500"
            color={pad.text ? colors.text : colors.placeholder}
            style={{ fontVariant: ['tabular-nums'] }}
            numberOfLines={1}
          >
            {pad.text || placeholder}
          </Text>
          {pad.active && <Caret height={18} />}
        </View>
      </FormRow>
    </Pressable>
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
        style={{ flexDirection: 'row', padding: 2, gap: 2, borderRadius: radius.button, backgroundColor: colors.control }}
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
                borderRadius: radius.chip,
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
