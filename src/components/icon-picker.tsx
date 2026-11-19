import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { TABLER_ICONS, type TablerIcon } from '@/data/tabler-icons';
import { radius, spacing, type as typeScale, useColors } from '@/theme';
import { haptic } from '@/utils/haptics';
import { dismissKeyboard } from '@/utils/keyboard';

import { TablerGlyph } from './group-mark';
import { Icon } from './icon';
import { Text } from './text';

const COLUMNS = 8;
const CELL = 40;
const ROW = CELL + 2;
const HEIGHT = ROW * 5 + 26;
/** Rows drawn above and below what's on screen, so fast scrolling doesn't show gaps. */
const BUFFER = ROW * 4;

function rows(icons: TablerIcon[]) {
  const out: { key: string; top: number; icons: TablerIcon[] }[] = [];
  for (let i = 0; i < icons.length; i += COLUMNS) {
    out.push({ key: icons[i].name, top: (i / COLUMNS) * ROW + 6, icons: icons.slice(i, i + COLUMNS) });
  }
  return out;
}

const ALL = rows(TABLER_ICONS);

/**
 * Tabler icons in a grid of eight, with search, built like the emoji picker. The chosen
 * icon gets a purple ring and takes the picked color.
 */
export function IconPicker({ value, color, onChange }: { value?: string; color: string; onChange: (icon: string) => void }) {
  const colors = useColors();
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [query, setQuery] = useState('');
  const [y, setY] = useState(0);

  const searching = query.trim().length > 0;
  const view = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return ALL;
    return rows(
      TABLER_ICONS.filter((i) => {
        const own = `${i.name.replace(/-/g, ' ')} ${i.tags}`.split(' ');
        return words.every((w) => own.some((k) => k.startsWith(w)));
      }),
    );
  }, [query]);
  const height = view.length ? view[view.length - 1].top + ROW + 6 : 0;
  const visible = view.filter((r) => r.top + ROW >= y - BUFFER && r.top <= y + HEIGHT + BUFFER);

  function pick(name: string) {
    dismissKeyboard();
    haptic('selection');
    onChange(name);
  }

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.menu,
        borderCurve: 'continuous',
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          paddingHorizontal: spacing.sm + 2,
          paddingTop: spacing.sm,
          paddingBottom: spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: colors.separator,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            height: 34,
            paddingHorizontal: spacing.sm + 2,
            borderRadius: radius.button,
            borderCurve: 'continuous',
            backgroundColor: colors.control,
          }}
        >
          <Icon sf="magnifyingglass" md="search" size={13} color={colors.textTertiary} />
          <TextInput
            value={query}
            onChangeText={(t) => {
              setQuery(t);
              setY(0);
              scroll.current?.scrollTo({ y: 0, animated: false });
            }}
            placeholder="Search icons"
            placeholderTextColor={colors.placeholder}
            accessibilityLabel="Search icons"
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            style={[typeScale.body, { flex: 1, color: colors.text, padding: 0 }]}
          />
          {searching && (
            <Pressable accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={8} onPress={() => setQuery('')}>
              <Icon sf="xmark.circle.fill" md="cancel" size={14} color={colors.textTertiary} />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView
        ref={scroll}
        style={{ height: HEIGHT }}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={32}
        onScroll={(e) => setY(e.nativeEvent.contentOffset.y)}
        contentContainerStyle={{ height: Math.max(height, HEIGHT) }}
      >
        {!view.length && (
          <Text variant="callout" tone="textSecondary" align="center" style={{ paddingTop: spacing.xl }}>
            No icon matches “{query.trim()}”.
          </Text>
        )}
        {visible.map((row) => (
          <View
            key={row.key}
            style={{ position: 'absolute', top: row.top, left: 6, right: 6, height: ROW, flexDirection: 'row', gap: 2 }}
          >
            {Array.from({ length: COLUMNS }, (_, i) => {
              const icon = row.icons[i];
              if (!icon) return <View key={i} style={{ flex: 1 }} />;
              const on = icon.name === value;
              return (
                <Pressable
                  key={icon.name}
                  accessibilityRole="button"
                  accessibilityLabel={icon.name.replace(/-/g, ' ')}
                  accessibilityState={{ selected: on }}
                  onPress={() => pick(icon.name)}
                  style={({ pressed }) => ({
                    flex: 1,
                    height: CELL,
                    borderRadius: 10,
                    borderCurve: 'continuous',
                    borderWidth: 2,
                    borderColor: on ? colors.accent : 'transparent',
                    backgroundColor: on ? colors.accentSoft : pressed ? colors.control : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                  })}
                >
                  <TablerGlyph name={icon.name} size={22} color={on ? color : colors.text} />
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
