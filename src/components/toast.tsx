import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FullWindowOverlay } from 'react-native-screens';
import { create } from 'zustand';

import { radius, spacing, useColors } from '@/theme';

import { Text } from './text';

type Toast = { id: number; message: string; actionLabel?: string; onAction?: () => void };

let timer: ReturnType<typeof setTimeout> | undefined;

export const useToast = create<{ toast: Toast | null; show: (t: Omit<Toast, 'id'>) => void; hide: () => void }>()(
  (set) => ({
    toast: null,
    show: (t) => {
      clearTimeout(timer);
      set({ toast: { ...t, id: Date.now() } });
      timer = setTimeout(() => set({ toast: null }), 5000);
    },
    hide: () => {
      clearTimeout(timer);
      set({ toast: null });
    },
  }),
);

/** A short confirmation at the top of the screen, with an optional Undo. */
export function ToastHost() {
  const toast = useToast((s) => s.toast);
  const hide = useToast((s) => s.hide);
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const body = (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + spacing.sm, left: 0, right: 0, alignItems: 'center' }}>
      <Animated.View
        style={{
          opacity: toast ? 1 : 0,
          transform: [{ translateY: toast ? 0 : -8 }],
          transitionProperty: ['opacity', 'transform'],
          transitionDuration: 200,
        }}
        pointerEvents={toast ? 'auto' : 'none'}
      >
        <View
          accessibilityLiveRegion="polite"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            minHeight: 40,
            paddingLeft: spacing.lg,
            paddingRight: toast?.actionLabel ? spacing.xs : spacing.lg,
            borderRadius: radius.control,
            backgroundColor: colors.ink,
          }}
        >
          <Text variant="callout" weight="500" tone="onInk" numberOfLines={1}>
            {toast?.message ?? ''}
          </Text>
          {toast?.actionLabel && (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                toast.onAction?.();
                hide();
              }}
              style={({ pressed }) => ({
                height: 32,
                paddingHorizontal: spacing.md,
                borderRadius: radius.full,
                justifyContent: 'center',
                backgroundColor: pressed ? 'rgba(127,127,127,0.25)' : 'transparent',
              })}
            >
              <Text variant="callout" weight="600" tone="onInk" style={{ textDecorationLine: 'underline' }}>
                {toast.actionLabel}
              </Text>
            </Pressable>
          )}
        </View>
      </Animated.View>
    </View>
  );
  return process.env.EXPO_OS === 'ios' ? <FullWindowOverlay>{body}</FullWindowOverlay> : body;
}
