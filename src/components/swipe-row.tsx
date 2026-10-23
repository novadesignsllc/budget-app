import { createContext, useContext, useRef } from 'react';
import { View } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import { haptic } from '@/utils/haptics';
import { spacing } from '@/theme';

import { Icon } from './icon';
import { Text } from './text';

type Action = {
  label: string;
  sf: Parameters<typeof Icon>[0]['sf'];
  md: Parameters<typeof Icon>[0]['md'];
  color: string;
  onTrigger: () => void;
};

const ACTION_WIDTH = 74;

/**
 * True while the row is being dragged. Native cancels the row's tap when a swipe starts;
 * web doesn't, so a row inside SwipeRow checks this before acting on a press.
 */
const SwipeGuard = createContext<() => boolean>(() => false);
export function useSwipeGuard() {
  return useContext(SwipeGuard);
}

function ActionPanel({ action }: { action: Action }) {
  return (
    <View
      style={{
        width: ACTION_WIDTH,
        backgroundColor: action.color,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        alignSelf: 'stretch',
        paddingHorizontal: spacing.xs,
      }}
    >
      <Icon sf={action.sf} md={action.md} size={13} color="#FFFFFF" weight="bold" />
      <Text variant="caption" weight="600" color="#FFFFFF" numberOfLines={1}>
        {action.label}
      </Text>
    </View>
  );
}

/**
 * A row that slides to reveal a flat, square, full-height action, like Mail. Swipe far
 * enough and the action runs; the row springs back on its own.
 */
export function SwipeRow({ children, left, right }: { children: React.ReactNode; left?: Action; right?: Action }) {
  const ref = useRef<SwipeableMethods>(null);
  const dragged = useRef(false);
  return (
    <SwipeGuard.Provider value={() => dragged.current}>
      <ReanimatedSwipeable
        ref={ref}
        friction={1.6}
        overshootLeft={false}
        overshootRight={false}
        leftThreshold={ACTION_WIDTH * 0.7}
        rightThreshold={ACTION_WIDTH * 0.7}
        renderLeftActions={left ? () => <ActionPanel action={left} /> : undefined}
        renderRightActions={right ? () => <ActionPanel action={right} /> : undefined}
        onSwipeableOpenStartDrag={() => (dragged.current = true)}
        onSwipeableCloseStartDrag={() => (dragged.current = true)}
        onSwipeableClose={() => (dragged.current = false)}
        onSwipeableOpen={(direction) => {
          // The direction the row moved (RNGH 3): moving right reveals the left action.
          const action = direction === 'right' ? left : right;
          if (!action) return;
          haptic('medium');
          action.onTrigger();
          ref.current?.close();
        }}
      >
        {children}
      </ReanimatedSwipeable>
    </SwipeGuard.Provider>
  );
}
