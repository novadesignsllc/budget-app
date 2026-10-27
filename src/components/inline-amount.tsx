import { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { textCents } from '@/domain/keypad';
import { formatDollars } from '@/domain/money';
import type { Cents } from '@/domain/types';
import { type as typeScale, useColors } from '@/theme';

import { useIsDesktop } from './dock';
import { Caret, useKeypadField, type KeypadAction } from './keypad';
import { Text } from './text';
import { TypedAmount } from './typed-amount';

/** Inner padding of the box; the box reaches this far past the column so the digits line up. */
const PAD = 6;

/**
 * A whole-dollar amount you tap to edit in place: a soft purple chip that brings up the
 * app's number pad (with + and − for quick math). Only Done saves; tapping anywhere else
 * puts it back.
 */
export function InlineAmount({
  cents,
  onCommit,
  onEditingChange,
  accessibilityLabel,
  width = 76,
  align = 'right',
  variant = 'row',
  muted,
  actions,
  exact,
}: {
  cents: Cents;
  onCommit: (cents: Cents) => void;
  /** Called with the row's view when editing starts, so the screen can scroll it into view. */
  onEditingChange?: (editing: boolean, view: React.ComponentRef<typeof View> | null) => void;
  accessibilityLabel: string;
  width?: number;
  /** Right for table columns; left for a stat under a label. */
  align?: 'left' | 'right' | 'center';
  variant?: 'row' | 'callout';
  /** Grey instead of purple (a past month). */
  muted?: boolean;
  /** Shortcuts above the keys, like Fill target. */
  actions?: KeypadAction[];
  /** The box is exactly `width` (a table cell), instead of reaching past it to line digits up with a label. */
  exact?: boolean;
}) {
  const colors = useColors();
  const desktop = useIsDesktop();
  const [typing, setTyping] = useState(false);
  const box = useRef<React.ComponentRef<typeof View>>(null);
  // Can be negative when money was taken back out this month.
  const whole = Math.floor(cents / 100);
  const pad = useKeypadField({
    value: String(Math.max(0, whole)),
    mode: 'whole',
    live: false,
    actions,
    onDone: (next) => {
      const value = Math.max(0, next ?? 0);
      if (value !== cents) onCommit(value);
    },
    onClose: () => onEditingChange?.(false, null),
  });

  // One fixed box in both states, so tapping changes nothing but the border and caret.
  // The text lines up with the column edge.
  const boxStyle = {
    width: exact ? width : width + PAD,
    height: 24,
    ...(exact ? {} : align === 'right' ? { marginRight: -PAD } : { marginLeft: -PAD }),
    paddingHorizontal: PAD - 1.5,
    borderRadius: 6,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start',
  } as const;
  const textStyle = {
    ...typeScale[variant],
    fontWeight: variant === 'callout' ? '600' : '400',
    fontVariant: ['tabular-nums'],
    color: colors.text,
  } as const;

  // On a computer you just type in the box (math works too); Enter or Tab saves, Escape puts it back.
  if (desktop) {
    const shown = String(Math.max(0, whole));
    return (
      <View ref={box} collapsable={false} style={{ width, alignItems: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start' }}>
        <View
          style={[
            boxStyle,
            typing
              ? { borderColor: muted ? colors.textSecondary : colors.accent, backgroundColor: colors.surface }
              : { borderColor: 'transparent', backgroundColor: muted ? colors.control : colors.accentSoft },
          ]}
        >
          <TypedAmount
            value={shown}
            mode="whole"
            accessibilityLabel={`${accessibilityLabel}, ${formatDollars(cents)}`}
            onFocusChange={(on) => {
              setTyping(on);
              onEditingChange?.(on, box.current);
            }}
            onCommit={(text) => {
              if (text === shown) return;
              const value = Math.max(0, textCents(text, 'whole') ?? 0);
              if (value !== cents) onCommit(value);
            }}
            style={[textStyle, { flex: 1, height: 20, padding: 0, textAlign: align }]}
          />
        </View>
      </View>
    );
  }

  return (
    <View ref={box} collapsable={false} style={{ width, alignItems: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${accessibilityLabel}, ${formatDollars(cents)}. Edit`}
        hitSlop={8}
        onPress={() => {
          pad.open();
          onEditingChange?.(true, box.current);
        }}
        style={({ pressed }) => [
          boxStyle,
          pad.active
            ? { borderColor: muted ? colors.textSecondary : colors.accent, backgroundColor: colors.surface }
            : {
                borderColor: 'transparent',
                backgroundColor: pressed ? colors.fill : muted ? colors.control : colors.accentSoft,
              },
        ]}
      >
        <Text numberOfLines={1} adjustsFontSizeToFit style={[textStyle, { flexShrink: 1 }]}>
          {pad.active ? pad.text || '$0' : (whole < 0 ? '-$' : '$') + Math.abs(whole).toLocaleString('en-US')}
        </Text>
        {pad.active && <Caret height={15} />}
      </Pressable>
    </View>
  );
}
