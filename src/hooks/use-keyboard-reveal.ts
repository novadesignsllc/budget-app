import { useEffect, useRef } from 'react';
import { Dimensions, Keyboard, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollView, type View } from 'react-native';

import { currentKeyboardHeight } from '@/utils/keyboard';

const GAP = 24;

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
    /** Current scroll position and a nudge, for things that scroll while dragging. */
    offset: () => offset.current,
    scrollBy: (dy: number) => scrollRef.current?.scrollTo({ y: Math.max(0, offset.current + dy), animated: false }),
    onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      offset.current = e.nativeEvent.contentOffset.y;
    },
    watch(view: React.ComponentRef<typeof View> | null) {
      target.current = view;
      if (!view) return;
      // The app's number pad (or the keyboard) is up, or about to be: scroll once it has its height.
      setTimeout(() => {
        const height = currentKeyboardHeight();
        if (height) reveal(Dimensions.get('window').height - height);
      }, 120);
    },
  };
}
