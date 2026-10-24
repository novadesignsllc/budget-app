import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View, useWindowDimensions } from 'react-native';
import Animated, { Keyframe, useReducedMotion } from 'react-native-reanimated';

import { haptic } from '@/utils/haptics';
import { keyboardTop, rememberFocus } from '@/utils/keyboard';
import { cardFaces, radius, spacing, type as typeScale, useColors } from '@/theme';

import { FieldLabel } from './field';
import { Icon } from './icon';
import { FORM_ROW_HEIGHT } from './form';
import { useMenuHost } from './menu-host';
import { Text } from './text';

export type DropdownOption<T extends string> = {
  value: T;
  label: string;
  /** Right-aligned detail, e.g. a balance. */
  detail?: string;
  /** A second line under the label. */
  description?: string;
  /** A colored dot (envelope group). */
  dot?: string;
  /** A mini card face index (accounts). */
  face?: number;
  /** A solid swatch color (debts, matching their chart line). */
  swatch?: string;
  tone?: 'negative';
  /** Options with the same section are grouped under its label. */
  section?: string;
  disabled?: boolean;
};

type Variant = 'field' | 'row' | 'compact' | 'inline' | 'title';

function Leading<T extends string>({ o }: { o: DropdownOption<T> }) {
  if (o.face !== undefined) {
    const f = cardFaces[o.face % cardFaces.length];
    return (
      <LinearGradient
        colors={[f.from, f.to]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ width: 20, height: 13, borderRadius: 3 }}
      />
    );
  }
  if (o.swatch)
    return (
      <View
        style={{
          width: 20,
          height: 13,
          borderRadius: 3,
          backgroundColor: o.swatch,
        }}
      />
    );
  if (o.dot) return <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: o.dot }} />;
  return null;
}

function Chevrons({ color, size = 10 }: { color: string; size?: number }) {
  return <Icon sf="chevron.up.chevron.down" md="unfold_more" size={size} color={color} weight="semibold" />;
}

/** The menu grows out of its field: a quick fade with a small scale and slide. */
const menuIn = (fromY: number) =>
  new Keyframe({
    0: { opacity: 0, transform: [{ translateY: fromY }, { scale: 0.97 }] },
    100: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
  }).duration(170);

/**
 * Every selector in the app (principle 3). A labeled field with ⇅ that opens a menu
 * card under (or above) it: section labels, a check on the current choice, optional
 * search. `variant` decides how the closed state looks where it sits.
 */
export function Dropdown<T extends string>({
  value,
  options,
  onChange,
  variant = 'field',
  label,
  placeholder = 'Choose',
  note,
  searchable,
  accessibilityLabel,
}: {
  value: T | undefined;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  variant?: Variant;
  /** Field label above (field), or the left label (row). */
  label?: string;
  placeholder?: string;
  note?: string;
  searchable?: boolean;
  accessibilityLabel?: string;
}) {
  const colors = useColors();
  const reduceMotion = useReducedMotion();
  const window = useWindowDimensions();
  const triggerRef = useRef<React.ComponentRef<typeof View>>(null);
  const [open, setOpen] = useState(false);
  const [frame, setFrame] = useState({ x: 0, y: 0, w: 0, h: 0 });
  // The keyboard stays up while a menu is open, so the menu fits in the space above it.
  const [floor, setFloor] = useState(window.height);
  const [containerHeight, setContainerHeight] = useState(window.height);
  const restoreFocus = useRef<() => void>(() => {});
  // Inside a sheet the menu draws in the sheet's own layer, so the keyboard stays up.
  const host = useMenuHost();
  const layerKey = useId();
  const [query, setQuery] = useState('');
  const selected = options.find((o) => o.value === value);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const openMenu = () => {
    haptic('selection');
    restoreFocus.current = rememberFocus();
    // Positions are relative to whatever the menu draws in: the sheet's layer or the window.
    const inContainer = (cb: (c: { x: number; y: number; h: number }) => void) => {
      if (host?.ref.current)
        host.ref.current.measureInWindow((x: number, y: number, _w: number, h: number) => cb({ x, y, h }));
      else cb({ x: 0, y: 0, h: window.height });
    };
    triggerRef.current?.measureInWindow((x: number, y: number, w: number, h: number) =>
      inContainer((c) => {
        setFrame({ x: x - c.x, y: y - c.y, w, h });
        setContainerHeight(c.h);
        setFloor(Math.min(c.h, keyboardTop(window.height) - c.y));
        setQuery('');
        setOpen(true);
      }),
    );
  };

  const close = () => {
    setOpen(false);
    // Searching inside the menu moves the cursor; hand it back to the field you were in.
    setTimeout(() => restoreFocus.current(), 0);
  };

  const pick = (o: DropdownOption<T>) => {
    if (o.disabled) return;
    haptic('selection');
    close();
    if (o.value !== value) onChange(o.value);
  };

  // Menu placement: under the trigger when it fits above the keyboard, otherwise
  // whichever side has more room, shrunk to fit.
  const rowHeight = options.some((o) => o.description) ? 48 : 36;
  const sections = new Set(options.map((o) => o.section).filter(Boolean)).size;
  const estimate = Math.min(360, visible.length * rowHeight + sections * 22 + (searchable ? 44 : 0) + 12);
  const roomBelow = floor - 12 - (frame.y + frame.h + 6);
  const roomAbove = frame.y - 6 - 54;
  const menuWidth = Math.min(
    window.width - spacing.lg * 2,
    Math.max(variant === 'compact' || variant === 'inline' || variant === 'title' ? 240 : frame.w, 220),
  );
  const below = estimate <= roomBelow || roomBelow >= roomAbove;
  const maxHeight = Math.max(120, Math.min(360, below ? roomBelow : roomAbove));
  const alignRight = variant === 'compact' || frame.x + menuWidth > window.width - spacing.lg;
  const left = alignRight ? Math.max(spacing.lg, frame.x + frame.w - menuWidth) : frame.x;
  const position = below ? { top: frame.y + frame.h + 6 } : { bottom: containerHeight - frame.y + 6 };

  const valueText = selected?.label ?? placeholder;
  const valueTone = selected ? (selected.tone === 'negative' ? 'negative' : 'text') : 'placeholder';
  const a11y = accessibilityLabel ?? `${label ?? 'Choose'}: ${selected?.label ?? 'none'}`;

  let trigger: React.ReactNode;
  if (variant === 'row') {
    trigger = (
      <Pressable
        ref={triggerRef}
        accessibilityRole="button"
        accessibilityLabel={a11y}
        onPress={openMenu}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          height: FORM_ROW_HEIGHT,
          paddingHorizontal: spacing.md,
          gap: spacing.sm,
          backgroundColor: open ? colors.accentSoft : pressed ? colors.control : colors.surface,
        })}
      >
        <Text variant="body" tone="textSecondary" style={{ flex: 1 }} numberOfLines={1}>
          {label}
        </Text>
        {selected && <Leading o={selected} />}
        <Text variant="body" weight="500" tone={valueTone} numberOfLines={1} style={{ maxWidth: '60%' }}>
          {valueText}
        </Text>
        <Chevrons color={open ? colors.accent : colors.textSecondary} />
      </Pressable>
    );
  } else if (variant === 'compact') {
    trigger = (
      <Pressable
        ref={triggerRef}
        accessibilityRole="button"
        accessibilityLabel={a11y}
        onPress={openMenu}
        style={({ pressed }) => ({
          height: 34,
          paddingHorizontal: spacing.sm + 2,
          borderRadius: radius.button,
          borderWidth: 1,
          borderColor: open ? colors.accent : colors.borderStrong,
          backgroundColor: pressed ? colors.control : colors.surface,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
        })}
      >
        <Text variant="callout" weight="600" numberOfLines={1}>
          {valueText}
        </Text>
        <Chevrons color={colors.textSecondary} />
      </Pressable>
    );
  } else if (variant === 'inline') {
    trigger = (
      <Pressable
        ref={triggerRef}
        accessibilityRole="button"
        accessibilityLabel={a11y}
        onPress={openMenu}
        style={({ pressed }) => ({
          height: 30,
          paddingHorizontal: 9,
          borderRadius: radius.button,
          borderWidth: 1,
          borderColor: open ? colors.accent : colors.borderStrong,
          backgroundColor: pressed ? colors.fill : colors.control,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        })}
      >
        {selected && <Leading o={selected} />}
        <Text variant="callout" tone={valueTone} numberOfLines={1} style={{ flex: 1 }}>
          {valueText}
        </Text>
        <Chevrons color={colors.textSecondary} size={9} />
      </Pressable>
    );
  } else if (variant === 'title') {
    trigger = (
      <Pressable
        ref={triggerRef}
        accessibilityRole="button"
        accessibilityLabel={a11y}
        onPress={openMenu}
        hitSlop={8}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
      >
        <Text variant="section">{valueText}</Text>
        <Chevrons color={colors.textSecondary} />
      </Pressable>
    );
  } else {
    trigger = (
      <View style={{ gap: 5 }}>
        {label && <FieldLabel label={label} note={note} />}
        <Pressable
          ref={triggerRef}
          accessibilityRole="button"
          accessibilityLabel={a11y}
          onPress={openMenu}
          style={({ pressed }) => ({
            height: 40,
            paddingHorizontal: spacing.md,
            borderRadius: radius.control,
            borderCurve: 'continuous',
            borderWidth: 1,
            borderColor: open ? colors.accent : colors.borderStrong,
            backgroundColor: pressed ? colors.control : colors.surface,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm + 2,
          })}
        >
          {selected && <Leading o={selected} />}
          <Text variant="body" weight="500" tone={valueTone} style={{ flex: 1 }} numberOfLines={1}>
            {valueText}
          </Text>
          <Chevrons color={open ? colors.accent : colors.textSecondary} />
        </Pressable>
      </View>
    );
  }
  const menu = (
    <Pressable
      accessibilityLabel="Close menu"
      onPress={close}
      style={{ flex: 1, backgroundColor: 'rgba(11,18,32,0.06)' }}
    >
      <Animated.View
        entering={reduceMotion ? undefined : menuIn('top' in position ? -6 : 6)}
        style={{
          position: 'absolute',
          left,
          width: menuWidth,
          maxHeight,
          ...position,
        }}
      >
        <Pressable
          onPress={() => {}}
          accessibilityRole="menu"
          style={{
            maxHeight,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: 'rgba(20,40,80,0.14)',
            borderRadius: radius.menu,
            borderCurve: 'continuous',
            padding: 5,
            overflow: 'hidden',
          }}
        >
          {searchable && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 7,
                height: 34,
                margin: 2,
                marginBottom: 5,
                paddingHorizontal: 9,
                borderRadius: radius.button,
                backgroundColor: colors.control,
              }}
            >
              <Icon sf="magnifyingglass" md="search" size={12} color={colors.textTertiary} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search"
                placeholderTextColor={colors.placeholder}
                autoFocus={process.env.EXPO_OS === 'web'}
                accessibilityLabel="Search options"
                style={[typeScale.callout, { flex: 1, color: colors.text, height: 34 }]}
              />
            </View>
          )}
          {/* The list gets its own cap: the card's padding and border, and the search field, come off the top. */}
          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={{ flexGrow: 0, flexShrink: 1, maxHeight: maxHeight - 12 - (searchable ? 41 : 0) }}
          >
            {visible.length === 0 && (
              <Text variant="callout" tone="textSecondary" style={{ padding: spacing.md }}>
                Nothing matches.
              </Text>
            )}
            {visible.map((o, i) => {
              const header = o.section && o.section !== visible[i - 1]?.section ? o.section : null;
              const isSelected = o.value === value;
              return (
                <View key={o.value}>
                  {header && (
                    <Text
                      variant="label"
                      tone="textTertiary"
                      caps
                      style={{
                        paddingHorizontal: 9,
                        paddingTop: 7,
                        paddingBottom: 3,
                      }}
                    >
                      {header}
                    </Text>
                  )}
                  <Pressable
                    accessibilityRole="menuitem"
                    accessibilityState={{
                      selected: isSelected,
                      disabled: o.disabled,
                    }}
                    disabled={o.disabled}
                    onPress={() => pick(o)}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 9,
                      minHeight: o.description ? 48 : 36,
                      paddingHorizontal: 9,
                      borderRadius: radius.button,
                      backgroundColor: isSelected ? colors.accentSoft : pressed ? colors.control : 'transparent',
                      opacity: o.disabled ? 0.45 : 1,
                    })}
                  >
                    <Leading o={o} />
                    <View style={{ flex: 1, gap: 1 }}>
                      <Text
                        variant="body"
                        weight={isSelected ? '500' : '400'}
                        tone={o.tone === 'negative' ? 'negative' : 'text'}
                        numberOfLines={1}
                      >
                        {o.label}
                      </Text>
                      {o.description && (
                        <Text variant="footnote" tone="textSecondary" numberOfLines={1}>
                          {o.description}
                        </Text>
                      )}
                    </View>
                    {o.detail && (
                      <Text
                        variant="footnote"
                        tone={o.tone === 'negative' ? 'negative' : 'textSecondary'}
                        style={{ fontVariant: ['tabular-nums'] }}
                      >
                        {o.detail}
                      </Text>
                    )}
                    <View style={{ width: 13 }}>
                      {isSelected && <Icon sf="checkmark" md="check" size={13} color={colors.accent} weight="bold" />}
                    </View>
                  </Pressable>
                </View>
              );
            })}
          </ScrollView>
        </Pressable>
      </Animated.View>
    </Pressable>
  );

  useEffect(() => {
    if (host) host.set(layerKey, open ? menu : null);
  });
  useEffect(() => () => host?.set(layerKey, null), [host, layerKey]);

  return (
    <>
      {trigger}
      {!host && (
        <Modal visible={open} transparent animationType="none" onRequestClose={close}>
          {menu}
        </Modal>
      )}
    </>
  );
}
