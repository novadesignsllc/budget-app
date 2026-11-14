import { create } from 'zustand';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useProfiles } from '@/sync/profiles';
import { spacing } from '@/theme';

/** Width of the desktop sidebar. */
export const SIDEBAR_WIDTH = 260;
export const SIDEBAR_MIN = 200;
export const SIDEBAR_MAX = 400;

/** The desktop sidebar's width: drag its edge to change it; this computer remembers it. */
export const useSidebarWidth = create<{ width: number; set: (w: number) => void }>()((set) => ({
  width: readWidth(),
  set: (w) => {
    const width = Math.round(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, w)));
    try {
      globalThis.localStorage?.setItem('slip-sidebar-width', String(width));
    } catch {}
    set({ width });
  },
}));

function readWidth(): number {
  try {
    const saved = Number(globalThis.localStorage?.getItem('slip-sidebar-width'));
    if (saved >= SIDEBAR_MIN && saved <= SIDEBAR_MAX) return saved;
  } catch {}
  return SIDEBAR_WIDTH;
}

/** Desktop web shows a sidebar instead of the bottom dock. */
export function useIsDesktop() {
  const { width } = useWindowDimensions();
  return process.env.EXPO_OS === 'web' && width >= 900;
}

/** Quick-add strip above the tab bar. */
export const QUICK_ADD_HEIGHT = 8 + 40 + 8;
/** Tab bar row, not counting the home indicator. */
export const TAB_BAR_HEIGHT = 44 + 4;
/** Profile tabs under the tab bar (plus their top border), not counting the home indicator. */
export const PROFILE_BAR_HEIGHT = 36;

/**
 * Size of the bottom dock (quick-add strip + tab bar). Screens end above it, so only
 * things mounted over the whole app (the sync pill) need `floatBottom`.
 */
export function useDock() {
  const insets = useSafeAreaInsets();
  const desktop = useIsDesktop();
  const paddingBottom = insets.bottom > 0 ? insets.bottom - 4 : 8;
  // The profile tabs only show with two or more profiles.
  const profileTabs = useProfiles((s) => s.list.length > 1);
  const height = desktop ? 0 : QUICK_ADD_HEIGHT + TAB_BAR_HEIGHT + (profileTabs ? PROFILE_BAR_HEIGHT + 1 : 0) + paddingBottom;
  return {
    height,
    paddingBottom,
    /** Bottom edge, from the window, for things that float just above the dock. */
    floatBottom: height + (desktop ? spacing.xl : spacing.md),
    /** Space to leave under a screen's content so the action bar never covers the last row. */
    contentBottom: desktop ? spacing.xxxl + spacing.xl : 76,
  };
}
