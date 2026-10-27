import { useRef, useState } from 'react';
import { Modal, Pressable, View, useWindowDimensions } from 'react-native';
import Animated, { Keyframe, useReducedMotion } from 'react-native-reanimated';

import { radius, spacing, useColors } from '@/theme';
import { haptic } from '@/utils/haptics';

import { Icon } from './icon';
import { Text } from './text';

export type MenuItem = {
  label: string;
  /** Right-aligned detail, like an amount. */
  detail?: string;
  icon?: { sf: Parameters<typeof Icon>[0]['sf']; md: Parameters<typeof Icon>[0]['md'] };
  onPress: () => void;
  disabled?: boolean;
};

const menuIn = (fromY: number) =>
  new Keyframe({
    0: { opacity: 0, transform: [{ translateY: fromY }, { scale: 0.97 }] },
    100: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
  }).duration(170);

/**
 * A short list of things to do with what you tapped, in the same menu card the dropdowns
 * use. The menu owns the tappable trigger; `style` and `children` draw it.
 */
export function ActionMenu({
  items,
  header,
  children,
  style,
  disabled,
  accessibilityLabel,
  hitSlop,
}: {
  items: MenuItem[];
  /** Shown above the items, like how a number adds up. */
  header?: React.ReactNode;
  children: React.ReactNode;
  style: (state: { pressed: boolean; open: boolean }) => React.ComponentProps<typeof View>['style'];
  disabled?: boolean;
  accessibilityLabel: string;
  hitSlop?: number;
}) {
  const colors = useColors();
  const window = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const anchor = useRef<React.ComponentRef<typeof View>>(null);
  const [frame, setFrame] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const open = () => {
    haptic('selection');
    anchor.current?.measureInWindow((x: number, y: number, w: number, h: number) => setFrame({ x, y, w, h }));
  };
  const close = () => setFrame(null);

  const width = 240;
  const estimate = items.length * 44 + 12 + (header ? 110 : 0);
  const below = frame ? frame.y + frame.h + 6 + estimate < window.height - 120 : true;
  const left = frame ? Math.min(Math.max(spacing.md, frame.x + frame.w - width), window.width - width - spacing.md) : 0;
  const position = frame
    ? below
      ? { top: frame.y + frame.h + 6 }
      : { bottom: window.height - frame.y + 6 }
    : {};

  return (
    <>
      <View ref={anchor} collapsable={false}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          disabled={disabled}
          hitSlop={hitSlop}
          onPress={open}
          style={({ pressed }) => style({ pressed, open: !!frame })}
        >
          {children}
        </Pressable>
      </View>
      <Modal visible={!!frame} transparent animationType="none" onRequestClose={close}>
        <Pressable accessibilityLabel="Close menu" onPress={close} style={{ flex: 1, backgroundColor: colors.backdropLight }}>
          <Animated.View
            entering={reduceMotion ? undefined : menuIn(below ? -6 : 6)}
            style={{ position: 'absolute', left, width, ...position }}
          >
            <View
              accessibilityRole="menu"
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.menuBorder,
                borderRadius: radius.menu,
                borderCurve: 'continuous',
                padding: 5,
              }}
            >
              {header}
              {items.map((item) => (
                <Pressable
                  key={item.label}
                  accessibilityRole="menuitem"
                  disabled={item.disabled}
                  onPress={() => {
                    haptic('selection');
                    close();
                    item.onPress();
                  }}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 9,
                    minHeight: 40,
                    paddingHorizontal: 9,
                    borderRadius: radius.button,
                    backgroundColor: pressed ? colors.control : 'transparent',
                    opacity: item.disabled ? 0.4 : 1,
                  })}
                >
                  {item.icon && <Icon sf={item.icon.sf} md={item.icon.md} size={13} color={colors.accent} weight="semibold" />}
                  <Text variant="body" style={{ flex: 1 }} numberOfLines={1}>
                    {item.label}
                  </Text>
                  {item.detail ? (
                    <Text variant="footnote" tone="textSecondary" style={{ fontVariant: ['tabular-nums'] }}>
                      {item.detail}
                    </Text>
                  ) : null}
                </Pressable>
              ))}
            </View>
          </Animated.View>
        </Pressable>
      </Modal>
    </>
  );
}
