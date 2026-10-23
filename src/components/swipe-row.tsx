import { useRef } from 'react';
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

const ACTION_WIDTH = 92;

function ActionPanel({ action, align }: { action: Action; align: 'left' | 'right' }) {
  return (
    <View
      style={{
        width: ACTION_WIDTH,
        backgroundColor: action.color,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xxs + 1,
        alignSelf: 'stretch',
        ...(align === 'left' ? {} : {}),
      }}
    >
      <Icon sf={action.sf} md={action.md} size={18} color="#FFFFFF" />
      <Text variant="caption" color="#FFFFFF" numberOfLines={1}>
        {action.label}
      </Text>
    </View>
  );
}

/**
 * A row that slides to reveal a flat, full-height action, like Mail. Swipe far
 * enough and the action runs; the row springs back on its own.
 */
export function SwipeRow({
  children,
  left,
  right,
}: {
  children: React.ReactNode;
  left?: Action;
  right?: Action;
}) {
  const ref = useRef<SwipeableMethods>(null);
  return (
    <ReanimatedSwipeable
      ref={ref}
      friction={1.6}
      overshootLeft={false}
      overshootRight={false}
      leftThreshold={ACTION_WIDTH * 0.7}
      rightThreshold={ACTION_WIDTH * 0.7}
      renderLeftActions={left ? () => <ActionPanel action={left} align="left" /> : undefined}
      renderRightActions={right ? () => <ActionPanel action={right} align="right" /> : undefined}
      onSwipeableOpen={(direction) => {
        // "left" means the left actions were revealed (the row moved right).
        const action = direction === 'left' ? left : right;
        if (!action) return;
        haptic('medium');
        action.onTrigger();
        ref.current?.close();
      }}
    >
      {children}
    </ReanimatedSwipeable>
  );
}
