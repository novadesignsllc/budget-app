import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, TextInput, View, type ScrollViewProps, type ViewStyle } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';

import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import { spacing, type as typeScale, useColors } from '@/theme';

/** Corner radius of desktop cards: a touch tighter than the phone's, for denser tables. */
export const D_RADIUS = 14;
/** Page padding beside the content. */
export const D_PAD = 28;

/** The app icon, small, for the sidebar. */
export function SlipMark({ size = 28 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 4, overflow: 'hidden' }}>
      <Svg width={size} height={size} viewBox="0 0 1024 1024">
        <Rect width={1024} height={1024} fill="#15122E" />
        <Line x1={372} y1={318} x2={652} y2={706} stroke="#3D2FB8" strokeWidth={150} strokeLinecap="round" />
        <Line x1={680} y1={318} x2={372} y2={318} stroke="#8F73FF" strokeWidth={150} strokeLinecap="round" />
        <Line x1={652} y1={706} x2={344} y2={706} stroke="#6E5CF5" strokeWidth={150} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

/** A keyboard shortcut hint. */
export function Kbd({ children, onAccent }: { children: string; onAccent?: boolean }) {
  const colors = useColors();
  return (
    <View
      style={{
        paddingHorizontal: 6,
        height: 18,
        borderRadius: 5,
        justifyContent: 'center',
        backgroundColor: onAccent ? 'rgba(255,255,255,0.18)' : colors.control,
      }}
    >
      <Text variant="caption" weight="600" color={onAccent ? colors.onInk : colors.textSecondary}>
        {children}
      </Text>
    </View>
  );
}

/**
 * A desktop page: a header bar across the top (title, controls) and the content
 * scrolling under it.
 */
export function DPage({
  header,
  children,
  scrollRef,
  contentStyle,
  ...props
}: Omit<ScrollViewProps, 'contentContainerStyle'> & {
  header: React.ReactNode;
  children: React.ReactNode;
  scrollRef?: React.Ref<React.ComponentRef<typeof ScrollView>>;
  contentStyle?: ViewStyle;
}) {
  const colors = useColors();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: spacing.md,
          paddingHorizontal: D_PAD,
          paddingVertical: 14,
          minHeight: 64,
          borderBottomWidth: 1,
          borderBottomColor: colors.separator,
        }}
      >
        {header}
      </View>
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[{ padding: D_PAD, paddingTop: 20, gap: spacing.lg }, contentStyle]}
        {...props}
      >
        {children}
      </ScrollView>
    </View>
  );
}

export function PageTitle({ children }: { children: React.ReactNode }) {
  return (
    <Text accessibilityRole="header" style={{ fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.4 }}>
      {children}
    </Text>
  );
}

/** Pushes the controls after it to the right edge of the header. */
export function Spacer() {
  return <View style={{ flex: 1 }} />;
}

/** A white card with the desktop's tighter corners. */
export function DCard({ children, style, padded }: { children: React.ReactNode; style?: ViewStyle; padded?: boolean }) {
  const colors = useColors();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: D_RADIUS,
          overflow: 'hidden',
        },
        padded && { padding: 18, gap: spacing.md },
        style,
      ]}
    >
      {children}
    </View>
  );
}

type IconSpec = { sf: Parameters<typeof Icon>[0]['sf']; md: Parameters<typeof Icon>[0]['md'] };

/** Outline (default) or purple button for headers and cards. */
export function DButton({
  label,
  icon,
  onPress,
  variant = 'outline',
  disabled,
  style,
  accessibilityLabel,
}: {
  label: string;
  icon?: IconSpec;
  onPress: () => void;
  variant?: 'outline' | 'accent';
  disabled?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
}) {
  const colors = useColors();
  const accent = variant === 'accent';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        {
          height: 34,
          paddingHorizontal: 12,
          borderRadius: 9,
          borderWidth: accent ? 0 : 1,
          borderColor: colors.borderStrong,
          backgroundColor: accent ? colors.accent : pressed || hovered ? colors.control : colors.surface,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          opacity: disabled ? 0.45 : pressed && accent ? 0.85 : 1,
        },
        style,
      ]}
    >
      {icon && <Icon sf={icon.sf} md={icon.md} size={13} color={accent ? colors.onInk : colors.accent} weight="semibold" />}
      <Text variant="body" weight="600" color={accent ? colors.onInk : colors.text} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/** The search box that "/" jumps to. Only one page is on screen at a time, so the newest wins. */
const searchFields: React.RefObject<React.ComponentRef<typeof TextInput> | null>[] = [];
export function focusSearch(): boolean {
  const field = searchFields.at(-1)?.current;
  field?.focus();
  return !!field;
}

export function SearchField({
  value,
  onChange,
  placeholder,
  width = 240,
}: {
  value: string;
  onChange: (text: string) => void;
  placeholder: string;
  width?: number;
}) {
  const colors = useColors();
  const ref = useRef<React.ComponentRef<typeof TextInput>>(null);
  useEffect(() => {
    searchFields.push(ref);
    return () => {
      searchFields.splice(searchFields.indexOf(ref), 1);
    };
  }, []);
  return (
    <View
      style={{
        width,
        height: 34,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        borderRadius: 9,
        backgroundColor: colors.surface,
      }}
    >
      <Icon sf="magnifyingglass" md="search" size={13} color={colors.textTertiary} />
      <TextInput
        ref={ref}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        accessibilityLabel={placeholder}
        onKeyPress={(e) => {
          if (e.nativeEvent.key === 'Escape') {
            onChange('');
            ref.current?.blur();
          }
        }}
        style={[typeScale.body, { flex: 1, minWidth: 0, height: 32, color: colors.text, outlineWidth: 0 }]}
      />
      {value ? (
        <Pressable accessibilityLabel="Clear search" onPress={() => onChange('')} hitSlop={6}>
          <Icon sf="xmark.circle.fill" md="cancel" size={14} color={colors.textTertiary} />
        </Pressable>
      ) : (
        <Kbd>/</Kbd>
      )}
    </View>
  );
}

/** True while the user is typing somewhere, so single-key shortcuts stay out of the way. */
export function typingInField(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

/** Calls `handler` for keys pressed on the page (not while typing in a field). Web only. */
export function usePageKeys(handler: (e: KeyboardEvent) => void) {
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || typingInField(e)) return;
      latest.current(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
