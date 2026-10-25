import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Keyboard, Pressable, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';

import { formatDollars } from '@/domain/money';
import type { Cents } from '@/domain/types';
import { radius, spacing, type as typeScale, useColors } from '@/theme';
import { haptic } from '@/utils/haptics';

import { Icon } from './icon';
import { Text } from './text';

/** On a phone only Done saves; the web has no bar, so Return or clicking away saves there. */
const native = process.env.EXPO_OS !== 'web';
/** Inner padding of the box; the box reaches this far past the column so the digits line up. */
const PAD = 6;
/** Height of the Cancel / Done bar, so the row being edited can sit above it. */
export const AMOUNT_BAR_HEIGHT = 48;

/** The amount being edited right now, so the bar's buttons reach it, and who's listening. */
let active: { done: () => void; cancel: () => void } | null = null;
const listeners = new Set<() => void>();
function setActive(next: typeof active) {
  active = next;
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const isEditing = () => active !== null;

/** The keyboard's height, from its own show and hide events. */
function useKeyboardHeight() {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const ios = process.env.EXPO_OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}

/**
 * Cancel and Done, drawn by the app right on top of the keyboard while an amount is being
 * edited. Mount it once on any screen with InlineAmounts. It follows the keyboard itself
 * instead of relying on iOS's accessory bar, which sometimes didn't show up.
 */
export function AmountKeyboardBar() {
  const colors = useColors();
  const window = useWindowDimensions();
  const editing = useSyncExternalStore(subscribe, isEditing, isEditing);
  const keyboard = useKeyboardHeight();
  const frame = useRef<React.ComponentRef<typeof View>>(null);
  // How far this screen's bottom edge sits above the bottom of the window (a tab bar, say).
  const [inset, setInset] = useState(0);
  const lift = Math.max(0, keyboard - inset);
  if (!native) return null;
  return (
    <View
      ref={frame}
      pointerEvents="box-none"
      style={StyleSheet.absoluteFill}
      onLayout={() =>
        frame.current?.measureInWindow((_x: number, y: number, _w: number, h: number) =>
          setInset(Math.max(0, window.height - (y + h))),
        )
      }
    >
      {editing && (
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: AMOUNT_BAR_HEIGHT,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: spacing.md,
              backgroundColor: '#F7F7F9',
              borderTopWidth: 1,
              borderTopColor: colors.separator,
            },
            { transform: [{ translateY: -lift }], transitionProperty: 'transform', transitionDuration: 250 },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => active?.cancel()}
            style={{ paddingHorizontal: spacing.xs, height: 36, justifyContent: 'center' }}
          >
            <Text variant="body" tone="textSecondary">
              Cancel
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Done"
            hitSlop={8}
            onPress={() => active?.done()}
            style={({ pressed }) => ({
              height: 36,
              paddingHorizontal: 16,
              borderRadius: radius.button,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: colors.accent,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Icon sf="checkmark" md="check" size={13} color={colors.onInk} weight="bold" />
            <Text variant="body" weight="600" tone="onInk">
              Done
            </Text>
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

/**
 * A whole-dollar amount you tap to edit in place: a soft purple chip that turns into
 * a number field. On iPhone only Done on the keyboard bar saves; Cancel or tapping away
 * puts it back. On the web, Return or clicking away saves and Escape cancels.
 */
export function InlineAmount({
  cents,
  onCommit,
  onEditingChange,
  onDraft,
  accessibilityLabel,
  width = 76,
  align = 'right',
  variant = 'row',
  muted,
}: {
  cents: Cents;
  onCommit: (cents: Cents) => void;
  /** Called with the row's view when editing starts, so the screen can scroll it into view. */
  onEditingChange?: (editing: boolean, view: React.ComponentRef<typeof View> | null) => void;
  /** The amount as it's typed, for live previews. */
  onDraft?: (cents: Cents) => void;
  accessibilityLabel: string;
  width?: number;
  /** Right for table columns; left for a stat under a label. */
  align?: 'left' | 'right';
  variant?: 'row' | 'callout';
  /** Grey instead of purple (a past month). */
  muted?: boolean;
}) {
  const colors = useColors();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const box = useRef<React.ComponentRef<typeof View>>(null);
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);
  const confirmed = useRef(false);
  const needsFocus = useRef(false);
  const editor = useRef<typeof active>(null);

  // Can be negative when money was taken back out this month.
  const whole = Math.floor(cents / 100);
  const draftCents = (parseInt(draft || '0', 10) || 0) * 100;

  function start() {
    haptic('selection');
    confirmed.current = !native;
    needsFocus.current = true;
    const mine = {
      done: () => {
        confirmed.current = true;
        input.current?.blur();
      },
      cancel: () => {
        confirmed.current = false;
        input.current?.blur();
      },
    };
    editor.current = mine;
    setActive(mine);
    setDraft(String(Math.max(0, whole)));
    setEditing(true);
    onDraft?.(Math.max(0, whole) * 100);
    onEditingChange?.(true, box.current);
  }

  function finish() {
    if (!editing) return;
    // Only hide the bar if another amount hasn't already taken over.
    if (active === editor.current) setActive(null);
    setEditing(false);
    onEditingChange?.(false, null);
    if (!confirmed.current) {
      onDraft?.(whole * 100);
      return;
    }
    if (draftCents !== cents) {
      haptic('success');
      onCommit(draftCents);
    }
  }

  // One fixed box in both states, so tapping changes nothing but the border and caret:
  // no size change, nothing appears around it. The text lines up with the column edge.
  const boxStyle = {
    width: width + PAD,
    height: 24,
    ...(align === 'right' ? { marginRight: -PAD } : { marginLeft: -PAD }),
    paddingHorizontal: PAD - 1.5,
    borderRadius: 6,
    borderWidth: 1.5,
    justifyContent: 'center',
  } as const;
  const textStyle = {
    ...typeScale[variant],
    fontWeight: variant === 'callout' ? '600' : '400',
    fontVariant: ['tabular-nums'],
    textAlign: align,
    color: colors.text,
  } as const;

  return (
    <View ref={box} collapsable={false} style={{ width, alignItems: align === 'right' ? 'flex-end' : 'flex-start' }}>
      {editing ? (
        <View style={[boxStyle, { borderColor: muted ? colors.textSecondary : colors.accent, backgroundColor: colors.surface }]}>
          <TextInput
            // autoFocus alone doesn't take on web when the field mounts mid-tap, so focus
            // once, a beat after it appears.
            ref={(el) => {
              input.current = el;
              if (el && needsFocus.current) {
                needsFocus.current = false;
                setTimeout(() => el.focus(), 50);
              }
            }}
            autoFocus
            value={draft}
            onChangeText={(t) => {
              const digits = t.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 7);
              setDraft(digits);
              onDraft?.((parseInt(digits || '0', 10) || 0) * 100);
            }}
            onSubmitEditing={() => {
              confirmed.current = true;
              input.current?.blur();
            }}
            onBlur={finish}
            onKeyPress={(e) => {
              if (e.nativeEvent.key === 'Escape') {
                confirmed.current = false;
                input.current?.blur();
              }
            }}
            keyboardType="number-pad"
            returnKeyType="done"
            selectTextOnFocus
            accessibilityLabel={accessibilityLabel}
            style={[textStyle, { flex: 1, padding: 0, margin: 0, lineHeight: undefined }]}
          />
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${accessibilityLabel}, ${formatDollars(cents)}. Edit`}
          hitSlop={8}
          onPress={start}
          style={({ pressed }) => [
            boxStyle,
            { borderColor: 'transparent', backgroundColor: pressed ? colors.fill : muted ? colors.control : colors.accentSoft },
          ]}
        >
          <Text numberOfLines={1} style={textStyle}>
            {(whole < 0 ? '-$' : '$') + Math.abs(whole).toLocaleString('en-US')}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
