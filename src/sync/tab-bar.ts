import { create } from 'zustand';

import { backend } from '@/backend';
import type { Unsubscribe } from '@/backend/types';

/**
 * The phone's tab bar: which tabs show and in what order. It belongs to the account, not
 * a profile, so every profile has the same bar. Settings is always on it, always last.
 * Stored at users/{uid}/prefs/tabBar, and kept on the device too so the bar never jumps
 * while Firebase loads.
 */
import { BAR_TABS, normalizeLayout, type TabBarLayout } from '@/domain/tab-layout';

export { BAR_TABS, normalizeLayout, shownTabs, type BarTab, type TabBarLayout } from '@/domain/tab-layout';

const DEFAULT: TabBarLayout = { order: [...BAR_TABS], hidden: [] };

const storageKey = (uid: string) => `slip-tab-bar:${uid}`;
function cached(uid: string): TabBarLayout {
  try {
    const text = localStorage.getItem(storageKey(uid));
    return normalizeLayout(text ? JSON.parse(text) : undefined);
  } catch {
    return DEFAULT;
  }
}

export const useTabBar = create<TabBarLayout & { uid: string | null }>()(() => ({ ...DEFAULT, uid: null }));

/** Follows the account's tab bar in Firebase. */
export function listenToTabBar(uid: string): Unsubscribe {
  useTabBar.setState({ ...cached(uid), uid });
  return backend.listen(
    uid,
    'prefs',
    (docs) => {
      const doc = docs.find((d) => d.id === 'tabBar') as Partial<TabBarLayout> | undefined;
      if (!doc) return;
      const layout = normalizeLayout(doc);
      useTabBar.setState(layout);
      try {
        localStorage.setItem(storageKey(uid), JSON.stringify(layout));
      } catch {}
    },
    () => {},
  );
}

export function resetTabBar() {
  useTabBar.setState({ ...DEFAULT, uid: null });
}

/** Saves a new layout: shows right away, reaches Firebase in the background. */
export function saveTabBar(layout: TabBarLayout) {
  const uid = useTabBar.getState().uid;
  const next = normalizeLayout(layout);
  useTabBar.setState(next);
  if (!uid) return;
  try {
    localStorage.setItem(storageKey(uid), JSON.stringify(next));
  } catch {}
  void backend.commit(uid, [{ collection: 'prefs', id: 'tabBar', data: { id: 'tabBar', order: next.order, hidden: next.hidden } }]).catch(() => {});
}
