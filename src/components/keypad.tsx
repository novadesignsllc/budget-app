import { createContext, use, useEffect, useId, useImperativeHandle, useRef } from 'react';
import { BackHandler, Keyboard, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import {
  exprFrom,
  hasMath,
  keypadDisplay,
  keypadText,
  keypadValue,
  press,
  textCents,
  type KeypadKey,
  type KeypadMode,
  type KeypadUnit,
} from '@/domain/keypad';
import type { Cents } from '@/domain/types';
import { radius, spacing, useColors } from '@/theme';
import { haptic } from '@/utils/haptics';
import { setKeypadHeight } from '@/utils/keyboard';

import { Icon } from './icon';
import { Text } from './text';

/** A shortcut above the keys, like Fill target on the budget. */
export type KeypadAction = {
  label: string;
  icon: { sf: Parameters<typeof Icon>[0]['sf']; md: Parameters<typeof Icon>[0]['md'] };
  onPress: () => void;
  disabled?: boolean;
};

type Session = {
  field: string;
  host: string;
  mode: KeypadMode;
  unit: KeypadUnit;
  negative: boolean;
  expr: string;
  /** Just opened on an existing value: the first digit replaces it. */
  fresh: boolean;
  /**
   * Live fields (forms) change with every key. Draft fields (budget amounts) only change
   * on Done; closing any other way puts them back.
   */
  live: boolean;
  onChange?: (text: string) => void;
  /** Done on a draft field: the new amount in cents (null when cleared). */
  onDone?: (cents: Cents | null) => void;
  /** The pad closed for this field, however it closed, with the field's final text. */
  onClose?: (text: string) => void;
  actions?: KeypadAction[];
  /** A line above the keys saying what the number is for. */
  title?: string;
  /** Show the amount being typed on the pad itself, for numbers that have no field on screen. */
  showValue?: boolean;
};

const useKeypadStore = create<{ session: Session | null }>()(() => ({ session: null }));

function end(commit: boolean) {
  const s = useKeypadStore.getState().session;
  if (!s) return;
  useKeypadStore.setState({ session: null });
  setKeypadHeight(0);
  if (commit && !s.live) s.onDone?.(/\d/.test(s.expr) ? keypadValue(s.expr, s.mode) : null);
  s.onClose?.(keypadText(s.expr, s.mode));
}

/** Closes the pad. A budget amount being typed is put back; form fields keep what was typed. */
export function closeKeypad() {
  end(false);
}

function pressKey(key: KeypadKey) {
  const s = useKeypadStore.getState().session;
  if (!s) return;
  haptic('selection');
  const expr = press(s.expr, key, s.mode, { fresh: s.fresh, negative: s.negative });
  useKeypadStore.setState({ session: { ...s, expr, fresh: false } });
  if (s.live) s.onChange?.(keypadText(expr, s.mode));
}

function done() {
  const s = useKeypadStore.getState().session;
  if (!s) return;
  haptic('light');
  // Finish any math first, so "12+5" saves as 17.
  const expr = hasMath(s.expr) ? press(s.expr, '=', s.mode) : s.expr;
  if (s.live) s.onChange?.(keypadText(expr, s.mode));
  useKeypadStore.setState({ session: { ...s, expr } });
  end(true);
}

const HostContext = createContext<string>('root');

/**
 * Where the pad draws: one at the root for the tabs, one inside each sheet (a sheet sits
 * above the root, so the root's pad would be hidden behind it). Fields use the nearest.
 */
export function KeypadHost({ children }: { children: React.ReactNode }) {
  const id = useId();
  return (
    <HostContext value={id}>
      <View style={{ flex: 1 }}>
        {children}
        <KeypadLayer host={id} />
      </View>
    </HostContext>
  );
}

function KeypadLayer({ host }: { host: string }) {
  const session = useKeypadStore((s) => (s.session?.host === host ? s.session : null));
  const open = !!session;

  // The phone's keyboard coming up for a name or note closes the pad, and Android's back button does too.
  useEffect(() => {
    if (!open) return;
    const kb = Keyboard.addListener(process.env.EXPO_OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', closeKeypad);
    const back = BackHandler.addEventListener('hardwareBackPress', () => (closeKeypad(), true));
    return () => {
      kb.remove();
      back.remove();
    };
  }, [open]);

  // On the web, the computer's keyboard types into the pad too.
  useEffect(() => {
    if (!open || process.env.EXPO_OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) pressKey(e.key as KeypadKey);
      else if (e.key === '+' || e.key === '-' || e.key === '=') pressKey(e.key as KeypadKey);
      else if (e.key === 'Backspace') pressKey('back');
      else if (e.key === 'Enter') done();
      else if (e.key === 'Escape') closeKeypad();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!session) return null;
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {/* A budget amount is a draft: tapping anywhere else puts it back. */}
      {!session.live && (
        <Pressable accessibilityLabel="Cancel" onPress={closeKeypad} style={StyleSheet.absoluteFill} />
      )}
      <KeypadPanel session={session} />
    </View>
  );
}

function KeypadPanel({ session }: { session: Session }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const math = hasMath(session.expr);

  const key = (k: KeypadKey, content: React.ReactNode, label: string) => (
    <Pressable
      key={k}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => pressKey(k)}
      style={({ pressed }) => ({
        flex: 1,
        height: 52,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        borderCurve: 'continuous',
        backgroundColor: pressed ? colors.control : 'transparent',
      })}
    >
      {content}
    </Pressable>
  );
  const digit = (d: KeypadKey) =>
    key(
      d,
      <Text style={{ fontSize: 26, lineHeight: 32, fontWeight: '500', color: colors.text, fontVariant: ['tabular-nums'] }}>
        {d}
      </Text>,
      d,
    );
  const op = (k: '+' | '-' | '=', glyph: string, label: string) =>
    key(k, <Text style={{ fontSize: 28, lineHeight: 32, fontWeight: '500', color: colors.accent }}>{glyph}</Text>, label);

  return (
    <View
      onLayout={(e) => setKeypadHeight(e.nativeEvent.layout.height)}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingTop: spacing.sm,
        paddingHorizontal: spacing.sm,
        paddingBottom: Math.max(insets.bottom, spacing.sm),
        gap: 2,
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.separator,
      }}
    >
      {session.actions?.length ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm, paddingHorizontal: 4, paddingBottom: 6 }}>
          {session.actions.map((a) => (
            <Pressable
              key={a.label}
              accessibilityRole="button"
              disabled={a.disabled}
              onPress={a.onPress}
              style={({ pressed }) => ({
                flex: 1,
                height: 38,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                borderRadius: radius.control,
                borderCurve: 'continuous',
                backgroundColor: pressed ? colors.fill : colors.control,
                opacity: a.disabled ? 0.4 : 1,
              })}
            >
              <Icon sf={a.icon.sf} md={a.icon.md} size={13} color={colors.accent} weight="semibold" />
              <Text variant="callout" weight="600">
                {a.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {/* What the number is for on the left, and the answer while doing math on the right. */}
      <View
        style={{
          height: session.showValue ? 30 : 18,
          paddingHorizontal: spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.sm,
        }}
      >
        <Text variant="footnote" weight="600" tone="textSecondary" numberOfLines={1} style={{ flexShrink: 1 }}>
          {session.title ?? ''}
        </Text>
        {session.showValue ? (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text variant="section" style={{ fontVariant: ['tabular-nums'] }} numberOfLines={1}>
              {keypadDisplay(session.expr, session.mode, session.unit) || keypadDisplay('0', session.mode, session.unit)}
              {math ? (
                <Text variant="footnote" weight="600" tone="accent">
                  {'  = '}
                  {keypadDisplay(press(session.expr, '=', session.mode), session.mode, session.unit)}
                </Text>
              ) : null}
            </Text>
            <Caret height={18} />
          </View>
        ) : math ? (
          <Text variant="footnote" weight="600" tone="accent" style={{ fontVariant: ['tabular-nums'] }}>
            = {keypadDisplay(press(session.expr, '=', session.mode), session.mode, session.unit)}
          </Text>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row' }}>
        {digit('7')}
        {digit('8')}
        {digit('9')}
        {op('-', '−', 'Minus')}
      </View>
      <View style={{ flexDirection: 'row' }}>
        {digit('4')}
        {digit('5')}
        {digit('6')}
        {op('+', '+', 'Plus')}
      </View>
      <View style={{ flexDirection: 'row' }}>
        {digit('1')}
        {digit('2')}
        {digit('3')}
        {op('=', '=', 'Equals')}
      </View>
      <View style={{ flexDirection: 'row' }}>
        {key(
          'clear',
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: colors.fill,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon sf="xmark" md="close" size={12} color={colors.textSecondary} weight="bold" />
          </View>,
          'Clear',
        )}
        {digit('0')}
        {key('back', <Icon sf="delete.left" md="backspace" size={22} color={colors.accent} />, 'Delete')}
        <View style={{ flex: 1, height: 52, padding: 4 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Done"
            onPress={done}
            style={({ pressed }) => ({
              flex: 1,
              borderRadius: 22,
              borderCurve: 'continuous',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.accent,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text variant="body" weight="700" tone="onInk">
              Done
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/** A thin blinking caret after the number being typed. */
export function Caret({ height = 22 }: { height?: number }) {
  const colors = useColors();
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.value = withRepeat(withSequence(withTiming(1, { duration: 450 }), withTiming(0, { duration: 450 })), -1);
  }, [opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[{ width: 2, height, borderRadius: 1, marginLeft: 2, backgroundColor: colors.accent }, style]} />;
}

export type KeypadFieldHandle = { focus: () => void; blur: () => void };

/**
 * Everything a number field needs: `open()` brings up the pad for it, `active` says it's
 * the one being typed in, and `text` is what to show (the math while typing).
 */
export function useKeypadField({
  value,
  onChange,
  mode = 'cents',
  unit = 'money',
  negative = false,
  live = true,
  onDone,
  onClose,
  actions,
  title,
  showValue,
  ref,
  autoFocus,
}: {
  /** The field's text: "43.57", "600", "-12.00", or "" when empty. */
  value: string;
  onChange?: (text: string) => void;
  mode?: KeypadMode;
  unit?: KeypadUnit;
  negative?: boolean;
  live?: boolean;
  onDone?: (cents: Cents | null) => void;
  onClose?: (text: string) => void;
  actions?: KeypadAction[];
  title?: string;
  showValue?: boolean;
  ref?: React.Ref<KeypadFieldHandle>;
  autoFocus?: boolean;
}) {
  const host = use(HostContext);
  const field = useId();
  const active = useKeypadStore((s) => s.session?.field === field);
  const expr = useKeypadStore((s) => (s.session?.field === field ? s.session.expr : ''));
  // Callbacks can change every render; the session reads the latest through this.
  const latest = useRef({ onChange, onDone, onClose });
  useEffect(() => {
    latest.current = { onChange, onDone, onClose };
  });

  const open = () => {
    if (useKeypadStore.getState().session?.field === field) return;
    closeKeypad();
    Keyboard.dismiss();
    useKeypadStore.setState({
      session: {
        field,
        host,
        mode,
        unit,
        negative,
        expr: exprFrom(textCents(value, mode), mode),
        fresh: !!value,
        live,
        onChange: (t) => latest.current.onChange?.(t),
        onDone: (c) => latest.current.onDone?.(c),
        onClose: (t) => latest.current.onClose?.(t),
        actions,
        title,
        showValue,
      },
    });
  };

  useImperativeHandle(ref, () => ({ focus: open, blur: closeKeypad }));

  useEffect(() => {
    if (autoFocus) open();
    // Close the pad if this field goes away while it's open.
    return () => {
      if (useKeypadStore.getState().session?.field === field) closeKeypad();
    };
    // Only on mount and unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shown = active ? keypadDisplay(expr, mode, unit) : value ? keypadDisplay(exprFrom(textCents(value, mode), mode) || '0', mode, unit) : '';
  return { open, active, text: shown };
}

/** Is any number pad open? Screens add room at the bottom so what you're typing stays visible. */
export function useKeypadOpen(): boolean {
  return useKeypadStore((s) => !!s.session);
}
