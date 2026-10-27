import { createContext, use, useEffect, useRef } from 'react';
import { Pressable, ScrollView, View, type ScrollViewProps } from 'react-native';

import { closeSheet } from '@/utils/close-sheet';
import { keyboardTopIn } from '@/utils/keyboard';

import { gutter, maxContentWidth, radius, spacing, useColors } from '@/theme';

import { useDock, useIsDesktop } from './dock';
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
  const desktop = useIsDesktop();
  // Measured against the sheet itself, so the sheet's own offset on screen cancels out.
  const reveal: Reveal = (view) =>
    frameRef.current?.measureInWindow((_sx: number, sheetY: number, _sw: number, sheetH: number) =>
      view?.measureInWindow((_x: number, y: number, _w: number, h: number) => {
        const over = y - sheetY + h + spacing.md - keyboardTopIn(sheetH);
        if (over > 0) scrollRef.current?.scrollTo({ y: offset.current + over, animated: true });
      }),
    );
  const sheet = (
    <SheetReveal value={reveal}>
      <View ref={frameRef} collapsable={false} style={desktop ? { flexShrink: 1 } : { flex: 1 }}>
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
  return desktop ? <SheetDialog keypadOpen={keypadOpen}>{sheet}</SheetDialog> : sheet;
}

/**
 * On a computer a sheet is a centered card over the page, the way a phone's sheet sits over
 * the screen. Clicking outside it or pressing Escape closes it.
 */
let openDialogs = 0;
/** Is a sheet open over the page on a computer? (Page shortcuts stand down while one is.) */
export function desktopSheetOpen(): boolean {
  return openDialogs > 0;
}

function SheetDialog({ children, keypadOpen }: { children: React.ReactNode; keypadOpen: boolean }) {
  const colors = useColors();
  useEffect(() => {
    openDialogs += 1;
    return () => {
      openDialogs -= 1;
    };
  }, []);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      // Escape closes the number pad first.
      if (e.key === 'Escape' && !keypadOpen) closeSheet();
    };
    // Capture, so it works while typing in a field too (fields keep Escape to themselves).
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [keypadOpen]);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl }}>
      <Pressable
        accessibilityLabel="Close"
        onPress={closeSheet}
        style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(11,18,32,0.32)' }}
      />
      <View
        style={{
          width: '100%',
          maxWidth: 560,
          maxHeight: '100%',
          flexShrink: 1,
          overflow: 'hidden',
          borderRadius: radius.card + 4,
          backgroundColor: colors.background,
          borderWidth: 1,
          borderColor: colors.borderStrong,
        }}
      >
        {children}
      </View>
    </View>
  );
}
