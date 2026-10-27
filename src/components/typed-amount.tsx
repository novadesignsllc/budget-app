import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { TextInput, type TextStyle } from 'react-native';

import { fieldExpr, typedText } from '@/domain/amount-text';
import { exprFrom, keypadDisplay, keypadText, textCents, type KeypadMode, type KeypadUnit } from '@/domain/keypad';
import { useColors } from '@/theme';

import type { KeypadFieldHandle } from './keypad';

let focused = 0;
/** Is an amount being typed right now? Escape cancels the amount before it closes a sheet. */
export function amountFieldFocused(): boolean {
  return focused > 0;
}

/** How a field's plain text ("43.57", "600") reads when it isn't being typed in: "$43.57". */
export function amountDisplay(value: string, mode: KeypadMode, unit: KeypadUnit): string {
  const cents = textCents(value, mode);
  if (cents === null) return '';
  return keypadDisplay(exprFrom(cents, mode) || '0', mode, unit);
}

/**
 * A number typed on a computer's keyboard, in place of the phone's number pad. Shows the
 * formatted amount; while focused you type into it, math included ("560+40").
 * Money with cents fills in from the right like the phone's pad and YNAB (4357 is
 * $43.57); whole dollars, rates and days are typed as they read.
 * Enter or leaving the field saves; Escape puts it back.
 */
export function TypedAmount({
  value,
  onChange,
  onCommit,
  mode = 'cents',
  unit = 'money',
  negative = false,
  placeholder,
  style,
  autoFocus,
  accessibilityLabel,
  onFocusChange,
  onCancel,
  ref,
}: {
  /** Plain text: "43.57", "600", or "" when empty. */
  value: string;
  /** Called as you type, with the plain text so far (forms that save with a button). */
  onChange?: (text: string) => void;
  /** Called with the final plain text on Enter or when the field loses focus. */
  onCommit?: (text: string) => void;
  mode?: KeypadMode;
  unit?: KeypadUnit;
  negative?: boolean;
  placeholder?: string;
  style?: TextStyle | TextStyle[];
  autoFocus?: boolean;
  accessibilityLabel: string;
  onFocusChange?: (focused: boolean) => void;
  /** Escape was pressed. */
  onCancel?: () => void;
  ref?: React.Ref<KeypadFieldHandle>;
}) {
  const colors = useColors();
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);
  // What's typed while focused; null shows the saved value, formatted.
  const [draft, setDraft] = useState<string | null>(null);
  const original = useRef(value);
  const cancelled = useRef(false);

  useImperativeHandle(ref, () => ({ focus: () => input.current?.focus(), blur: () => input.current?.blur() }));

  // A menu that just closed hands focus back to its button; take it once that's done.
  useEffect(() => {
    if (!autoFocus) return;
    const t = setTimeout(() => input.current?.focus(), 150);
    return () => clearTimeout(t);
    // Only when the field appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Select everything, so typing replaces the amount (after the formatted text swaps for plain). */
  const selectAll = () =>
    requestAnimationFrame(() => (input.current as unknown as { select?: () => void } | null)?.select?.());

  // Money with cents: digits fill in from the right, and the field shows "$43.57" as you type.
  const fromRight = mode === 'cents' && unit === 'money';
  const show = (expr: string) => (expr ? keypadDisplay(expr, 'cents', 'money') : '');
  const plain = (draftText: string) => {
    if (!fromRight) return typedText(draftText, mode, negative);
    const text = keypadText(fieldExpr(draftText, negative), 'cents');
    return !negative && text.startsWith('-') ? text.slice(1) : text;
  };
  const editable = !value
    ? ''
    : fromRight
      ? show(exprFrom(textCents(value, 'cents'), 'cents'))
      : amountDisplay(value, mode, 'number').replace(/,/g, '');
  const finish = () => {
    if (draft === null) return;
    const wasCancelled = cancelled.current;
    cancelled.current = false;
    setDraft(null);
    // Escape already put the value back.
    if (wasCancelled) return;
    const text = plain(draft);
    onChange?.(text);
    onCommit?.(text);
  };

  return (
    <TextInput
      ref={input}
      value={draft ?? amountDisplay(value, mode, unit)}
      placeholder={placeholder}
      placeholderTextColor={colors.placeholder}
      accessibilityLabel={accessibilityLabel}
      inputMode="decimal"
      autoFocus={autoFocus}
      selectTextOnFocus
      onFocus={() => {
        original.current = value;
        cancelled.current = false;
        setDraft(editable);
        // Typing replaces an amount that's there; an empty field just takes the digits.
        if (editable) selectAll();
        focused += 1;
        onFocusChange?.(true);
      }}
      onChangeText={(t) => {
        setDraft(fromRight ? show(fieldExpr(t, negative)) : t);
        onChange?.(plain(t));
      }}
      onSubmitEditing={() => input.current?.blur()}
      onKeyPress={(e) => {
        if (e.nativeEvent.key === 'Escape') {
          cancelled.current = true;
          onChange?.(original.current);
          input.current?.blur();
          onCancel?.();
        }
      }}
      onBlur={() => {
        focused = Math.max(0, focused - 1);
        finish();
        onFocusChange?.(false);
      }}
      style={[{ color: colors.text, fontVariant: ['tabular-nums'], outlineWidth: 0, minWidth: 0 }, style as TextStyle]}
    />
  );
}
