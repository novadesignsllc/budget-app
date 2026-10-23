import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing } from '@/theme';

/** Desktop web shows a sidebar instead of the bottom dock. */
export function useIsDesktop() {
  const { width } = useWindowDimensions();
  return process.env.EXPO_OS === 'web' && width >= 900;
}

/**
 * Size of the bottom dock (quick-add bar + tab strip). Screens pad their content by it,
 * and the action bar and sync pill sit just above it.
 */
export function useDock() {
  const insets = useSafeAreaInsets();
  const desktop = useIsDesktop();
  const paddingBottom = Math.max(insets.bottom - 8, 12);
  const height = desktop ? 0 : 8 + 40 + 6 + 30 + paddingBottom;
  return {
    height,
    paddingBottom,
    /** Bottom edge for things that float just above the dock. */
    floatBottom: height + (desktop ? spacing.xl : 8),
  };
}
