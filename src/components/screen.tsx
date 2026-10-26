import { createContext, use, useRef } from 'react';
import { ScrollView, View, type ScrollViewProps } from 'react-native';

import { keyboardTopIn } from '@/utils/keyboard';

import { gutter, maxContentWidth, spacing } from '@/theme';

import { useDock } from './dock';
import { KeypadHost, useKeypadOpen } from './keypad';
import { MenuHost } from './menu-host';

/** Room under the content while the number pad is up, so the last fields can scroll above it. */
const KEYPAD_ROOM = 360;

/** The scroll container for tab screens: gutter, card rhythm, room for the action bar. */
export function Screen({
  children,
  contentContainerStyle,
  ...props
}: ScrollViewProps & {
  ref?: React.Ref<React.ComponentRef<typeof ScrollView>>;
}) {
  const { contentBottom } = useDock();
  const keypadOpen = useKeypadOpen();
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      scrollEventThrottle={32}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        {
          paddingHorizontal: gutter,
          paddingTop: spacing.xs,
          paddingBottom: contentBottom,
          gap: spacing.md,
          width: '100%',
          maxWidth: maxContentWidth,
          alignSelf: 'center',
        },
        contentContainerStyle,
      ]}
      {...props}
    >
      {children}
      {keypadOpen && <View style={{ height: KEYPAD_ROOM }} />}
    </ScrollView>
  );
}

type Reveal = (view: React.ComponentRef<typeof View> | null) => void;
const SheetReveal = createContext<Reveal>(() => {});

/** Scrolls the sheet so `view` sits above the keyboard (or the bottom edge). For the calendar. */
export function useSheetReveal() {
  return use(SheetReveal);
}

/**
 * Content for a form sheet. The keyboard can stay up the whole time you fill one in, so
 * the sheet makes room under it and anything that opens below the keyboard scrolls up.
 */
export function SheetScreen({ children, contentContainerStyle, onScroll, ...props }: ScrollViewProps) {
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const frameRef = useRef<React.ComponentRef<typeof View>>(null);
  const offset = useRef(0);
  const keypadOpen = useKeypadOpen();
  // Measured against the sheet itself, so the sheet's own offset on screen cancels out.
  const reveal: Reveal = (view) =>
    frameRef.current?.measureInWindow((_sx: number, sheetY: number, _sw: number, sheetH: number) =>
      view?.measureInWindow((_x: number, y: number, _w: number, h: number) => {
        const over = y - sheetY + h + spacing.md - keyboardTopIn(sheetH);
        if (over > 0) scrollRef.current?.scrollTo({ y: offset.current + over, animated: true });
      }),
    );
  return (
    <SheetReveal value={reveal}>
      <View ref={frameRef} collapsable={false} style={{ flex: 1 }}>
        <KeypadHost>
          <MenuHost>
            <ScrollView
              ref={scrollRef}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets
              scrollEventThrottle={32}
              onScroll={(e) => {
                offset.current = e.nativeEvent.contentOffset.y;
                onScroll?.(e);
              }}
              contentContainerStyle={[
                {
                  padding: gutter,
                  paddingTop: spacing.lg,
                  gap: spacing.md + 2,
                  paddingBottom: spacing.xxxl,
                },
                contentContainerStyle,
              ]}
              {...props}
            >
              {children}
              {keypadOpen && <View style={{ height: KEYPAD_ROOM }} />}
            </ScrollView>
          </MenuHost>
        </KeypadHost>
      </View>
    </SheetReveal>
  );
}
