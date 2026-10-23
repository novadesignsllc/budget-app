import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing } from '@/theme';

/** Desktop web shows a sidebar instead of the bottom dock. */
export function useIsDesktop() {
  const { width } = useWindowDimensions();
  return process.env.EXPO_OS === 'web' && width >= 900;
}

/** Quick-add strip above the tab bar. */
export const QUICK_ADD_HEIGHT = 8 + 40 + 8;
/** Tab bar row, not counting the home indicator. */
export const TAB_BAR_HEIGHT = 7 + 22 + 3 + 13 + 4;

/**
 * Size of the bottom dock (quick-add strip + tab bar). Screens end above it, so only
 * things mounted over the whole app (the sync pill) need `floatBottom`.
 */
export function useDock() {
  const insets = useSafeAreaInsets();
  const desktop = useIsDesktop();
  const paddingBottom = insets.bottom > 0 ? insets.bottom - 4 : 8;
  const height = desktop ? 0 : QUICK_ADD_HEIGHT + TAB_BAR_HEIGHT + paddingBottom;
  return {
    height,
    paddingBottom,
    /** Bottom edge, from the window, for things that float just above the dock. */
    floatBottom: height + (desktop ? spacing.xl : spacing.md),
    /** Space to leave under a screen's content so the action bar never covers the last row. */
    contentBottom: desktop ? spacing.xxxl + spacing.xl : 64,
  };
}
