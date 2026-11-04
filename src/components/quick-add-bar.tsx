import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState, Pressable, View } from 'react-native';
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
    let swap: ReturnType<typeof setTimeout> | undefined;
    const id = setInterval(() => {
      // Nothing to show while the app is in the background.
      if (AppState.currentState !== 'active') return;
      if (reduceMotion) return setIndex((i) => (i + 1) % EXAMPLES.length);
      setVisible(false);
      swap = setTimeout(() => {
        setIndex((i) => (i + 1) % EXAMPLES.length);
        setVisible(true);
      }, 280);
    }, 3200);
    return () => {
      clearInterval(id);
      clearTimeout(swap);
    };
  }, [reduceMotion]);
  return { text: EXAMPLES[index], visible };
}

/** Quick-add on every screen. The bar opens the keyboard; the mic starts listening. */
export function QuickAddBar() {
  const colors = useColors();
  const example = useCyclingExample();
  const box = {
    height: 40,
    borderRadius: radius.control,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  } as const;

  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add a transaction"
        onPress={() => {
          haptic('light');
          router.push('/add');
        }}
        style={({ pressed }) => [
          box,
          { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        {/* A plain cross-fade between examples: no movement. */}
        <Animated.View
          style={{
            flex: 1,
            opacity: example.visible ? 1 : 0,
            transitionProperty: 'opacity',
            transitionDuration: 260,
            transitionTimingFunction: 'ease-in-out',
          }}
        >
          <Text variant="body" tone="placeholder" numberOfLines={1}>
            {example.text}
          </Text>
        </Animated.View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Say a transaction"
        onPress={() => {
          haptic('medium');
          router.push({ pathname: '/add', params: { voice: '1' } });
        }}
        style={({ pressed }) => [box, { width: 40, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 }]}
      >
        <Icon sf="mic.fill" md="mic" size={15} color={colors.text} />
      </Pressable>
    </View>
  );
}

/** Spacer that keeps the dock's height when something needs to sit in its place. */
export const QUICK_ADD_GAP = spacing.sm;
