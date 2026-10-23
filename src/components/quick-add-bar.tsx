import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { haptic } from '@/utils/haptics';
import { radius, spacing, useColors } from '@/theme';

import { Icon } from './icon';
import { Text } from './text';

/** What the bar suggests, one at a time. The first line says what the bar is for. */
const EXAMPLES = [
  'Add a quick transaction here',
  'McDonald’s 10.99',
  'Best Buy 47.27',
  'Kroger 54.20 yesterday',
  'Gas 40 Chime',
  'Paycheck 1,842.16',
];

function useCyclingExample() {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const id = setInterval(() => {
      if (reduceMotion) return setIndex((i) => (i + 1) % EXAMPLES.length);
      setVisible(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % EXAMPLES.length);
        setVisible(true);
      }, 220);
    }, 3200);
    return () => clearInterval(id);
  }, [reduceMotion]);
  return { text: EXAMPLES[index], visible };
}

/**
 * The quick-add entry point on every tab. The bar opens the keyboard; the mic button
 * starts listening right away. `compact` is the iOS tab bar's minimized form.
 */
export function QuickAddBar({ compact, floating }: { compact?: boolean; floating?: boolean }) {
  const colors = useColors();
  const example = useCyclingExample();
  const surface = floating
    ? {
        backgroundColor: colors.floating,
        borderWidth: 0.5,
        borderColor: colors.hairline,
      }
    : null;

  return (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add a transaction"
        onPress={() => {
          haptic('light');
          router.push('/add');
        }}
        style={({ pressed }) => [
          {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm + 2,
            height: compact ? 40 : 48,
            paddingLeft: spacing.sm + 1,
            paddingRight: spacing.lg,
            borderRadius: radius.full,
            opacity: pressed ? 0.7 : 1,
          },
          surface,
        ]}
      >
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: radius.full,
            backgroundColor: colors.ink,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon sf="plus" md="add" size={14} color={colors.onInk} weight="bold" />
        </View>
        {!compact && (
          <Animated.View
            style={{
              flex: 1,
              opacity: example.visible ? 1 : 0,
              transform: [{ translateY: example.visible ? 0 : -4 }],
              transitionProperty: ['opacity', 'transform'],
              transitionDuration: 200,
            }}
          >
            <Text variant="body" tone="placeholder" numberOfLines={1}>
              {example.text}
            </Text>
          </Animated.View>
        )}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Say a transaction"
        onPress={() => {
          haptic('medium');
          router.push({ pathname: '/add', params: { voice: '1' } });
        }}
        style={({ pressed }) => [
          {
            width: compact ? 40 : 48,
            height: compact ? 40 : 48,
            borderRadius: radius.full,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.6 : 1,
          },
          surface,
        ]}
      >
        <Icon sf="mic.fill" md="mic" size={18} color={colors.text} />
      </Pressable>
    </View>
  );
}
