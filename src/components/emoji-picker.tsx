import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text as RNText, TextInput, View } from 'react-native';

import { EMOJI_CATEGORIES } from '@/data/emoji';
import { radius, spacing, type as typeScale, useColors } from '@/theme';
import { haptic } from '@/utils/haptics';
import { dismissKeyboard } from '@/utils/keyboard';

import { Icon } from './icon';
import { Text } from './text';

const COLUMNS = 8;
const CELL = 40;
const ROW = CELL + 2;
const LABEL = 26;
const HEIGHT = LABEL + ROW * 5;
/** Rows drawn above and below what's on screen, so fast scrolling doesn't show gaps. */
const BUFFER = ROW * 4;

type Line = { key: string; top: number } & ({ kind: 'label'; text: string } | { kind: 'row'; emojis: [string, string][] });

/** Section labels and rows of eight, each with its fixed offset, so only nearby rows render. */
function layout(sections: { id: string; label: string; emojis: [string, string][] }[]) {
  const lines: Line[] = [];
  const starts: Record<string, number> = {};
  let top = 0;
  for (const s of sections) {
    starts[s.id] = top;
    lines.push({ key: `${s.id}-label`, kind: 'label', text: s.label, top });
    top += LABEL;
    for (let i = 0; i < s.emojis.length; i += COLUMNS) {
      lines.push({ key: `${s.id}-${i}`, kind: 'row', emojis: s.emojis.slice(i, i + COLUMNS), top });
      top += ROW;
    }
  }
  return { lines, starts, height: top };
}

const ALL = layout(EMOJI_CATEGORIES);

function matches(words: string[], keywords: string) {
  const own = keywords.split(' ');
  return words.every((w) => own.some((k) => k.startsWith(w)));
}

/**
 * Our own emoji picker, not the keyboard's: search, category tabs that jump to their
 * section, and a grid of eight across. The chosen emoji gets a purple ring.
 */
export function EmojiPicker({ value, onChange }: { value?: string; onChange: (emoji: string) => void }) {
  const colors = useColors();
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [query, setQuery] = useState('');
  const [y, setY] = useState(0);

  const searching = query.trim().length > 0;
  const view = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return ALL;
    const found = EMOJI_CATEGORIES.flatMap((c) => c.emojis.filter(([, k]) => matches(words, k)));
    return layout([{ id: 'results', label: found.length ? 'Results' : '', emojis: found }]);
  }, [query]);

  // The tab for whichever section is at the top of the grid.
  const active = searching
    ? undefined
    : [...EMOJI_CATEGORIES].reverse().find((c) => ALL.starts[c.id] <= y + 1)?.id ?? EMOJI_CATEGORIES[0].id;
  const visible = view.lines.filter((l) => l.top + ROW >= y - BUFFER && l.top <= y + HEIGHT + BUFFER);

  function pick(emoji: string) {
    dismissKeyboard();
    haptic('selection');
    onChange(emoji);
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
      <View style={{ paddingHorizontal: spacing.sm + 2, paddingTop: spacing.sm, paddingBottom: 6 }}>
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
            placeholder="Search emoji"
            placeholderTextColor={colors.placeholder}
            accessibilityLabel="Search emoji"
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

      {!searching && (
        <View
          accessibilityRole="tablist"
          style={{
            flexDirection: 'row',
            paddingHorizontal: 6,
            borderBottomWidth: 1,
            borderBottomColor: colors.separator,
          }}
        >
          {EMOJI_CATEGORIES.map((c) => {
            const on = c.id === active;
            return (
              <Pressable
                key={c.id}
                accessibilityRole="tab"
                accessibilityLabel={c.label}
                accessibilityState={{ selected: on }}
                onPress={() => {
                  haptic('selection');
                  setY(ALL.starts[c.id]);
                  scroll.current?.scrollTo({ y: ALL.starts[c.id], animated: true });
                }}
                style={{
                  flex: 1,
                  height: 34,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderBottomWidth: 2,
                  borderBottomColor: on ? colors.accent : 'transparent',
                  opacity: on ? 1 : 0.55,
                }}
              >
                <RNText style={{ fontSize: 17 }}>{c.icon}</RNText>
              </Pressable>
            );
          })}
        </View>
      )}

      <ScrollView
        ref={scroll}
        style={{ height: HEIGHT }}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={32}
        onScroll={(e) => setY(e.nativeEvent.contentOffset.y)}
        contentContainerStyle={{ height: Math.max(view.height, HEIGHT) + spacing.sm }}
      >
        {searching && view.lines.length <= 1 && (
          <Text variant="callout" tone="textSecondary" align="center" style={{ paddingTop: spacing.xl }}>
            No emoji matches “{query.trim()}”.
          </Text>
        )}
        {visible.map((line) =>
          line.kind === 'label' ? (
            line.text ? (
              <Text
                key={line.key}
                variant="label"
                caps
                tone="textTertiary"
                style={{ position: 'absolute', top: line.top + 9, left: spacing.sm + 2 }}
              >
                {line.text}
              </Text>
            ) : null
          ) : (
            <View
              key={line.key}
              style={{
                position: 'absolute',
                top: line.top,
                left: 6,
                right: 6,
                height: ROW,
                flexDirection: 'row',
                gap: 2,
              }}
            >
              {Array.from({ length: COLUMNS }, (_, i) => {
                const item = line.emojis[i];
                if (!item) return <View key={i} style={{ flex: 1 }} />;
                const [emoji, keywords] = item;
                const on = emoji === value;
                return (
                  <Pressable
                    key={emoji}
                    accessibilityRole="button"
                    accessibilityLabel={keywords.split(' ')[0]}
                    accessibilityState={{ selected: on }}
                    onPress={() => pick(emoji)}
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
                    <RNText style={{ fontSize: 24, lineHeight: 30 }}>{emoji}</RNText>
                  </Pressable>
                );
              })}
            </View>
          ),
        )}
      </ScrollView>
    </View>
  );
}
