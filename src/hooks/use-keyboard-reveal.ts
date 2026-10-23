import { useEffect, useRef } from 'react';
import { Keyboard, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollView, type View } from 'react-native';

const GAP = 40;

/**
 * Keeps a row you're typing in just above the keyboard, even when the list is short.
 * Pair with `automaticallyAdjustKeyboardInsets` on the ScrollView, which adds room to
 * scroll into: pass `scrollRef` and `onScroll` to the ScrollView, then call `watch(view)`
 * when editing starts and `watch(null)` when it ends.
 */
export function useKeyboardReveal() {
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const offset = useRef(0);
  const target = useRef<React.ComponentRef<typeof View> | null>(null);

  function reveal(keyboardTop: number) {
    const view = target.current;
    if (!view) return;
    view.measureInWindow((_x: number, y: number, _w: number, h: number) => {
      const over = y + h + GAP - keyboardTop;
      if (over > 0) scrollRef.current?.scrollTo({ y: offset.current + over, animated: true });
    });
  }

  useEffect(() => {
    const event = process.env.EXPO_OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const sub = Keyboard.addListener(event, (e) => reveal(e.endCoordinates.screenY));
    return () => sub.remove();
  }, []);

  return {
    scrollRef,
    onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      offset.current = e.nativeEvent.contentOffset.y;
    },
    watch(view: React.ComponentRef<typeof View> | null) {
      target.current = view;
      const metrics = typeof Keyboard.metrics === 'function' ? Keyboard.metrics() : undefined;
      // Already open (moving from one row to the next): scroll right away.
      if (view && metrics) setTimeout(() => reveal(metrics.screenY), 60);
    },
  };
}
