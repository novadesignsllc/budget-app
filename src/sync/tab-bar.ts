import { create } from 'zustand';

import { backend } from '@/backend';
import type { Unsubscribe } from '@/backend/types';

/**
 * The phone's tab bar: which tabs show and in what order. It belongs to the account, not
 * a profile, so every profile has the same bar. Settings is always on it, always last.
 * Stored at users/{uid}/prefs/tabBar, and kept on the device too so the bar never jumps
 * while Firebase loads.
 */
export const BAR_TABS = ['recurring', 'transactions', 'income', 'home', 'budget', 'debt', 'settings'] as const;
export type BarTab = (typeof BAR_TABS)[number];
export type TabBarLayout = { order: BarTab[]; hidden: BarTab[] };

const DEFAULT: TabBarLayout = { order: [...BAR_TABS], hidden: [] };

/** A saved layout made whole: unknown tabs dropped, new ones added before Settings, Settings last and never hidden. */
export function normalizeLayout(saved: Partial<TabBarLayout> | undefined): TabBarLayout {
  const known = new Set<string>(BAR_TABS);
  const order = (saved?.order ?? []).filter((t, i, all) => known.has(t) && all.indexOf(t) === i && t !== 'settings');
  for (const t of BAR_TABS) if (t !== 'settings' && !order.includes(t)) order.push(t);
  const hidden = (saved?.hidden ?? []).filter((t) => known.has(t) && t !== 'settings');
  return { order: [...order, 'settings'], hidden };
}

/** The tabs on the bar, in order. */
export function shownTabs(layout: TabBarLayout): BarTab[] {
  return layout.order.filter((t) => !layout.hidden.includes(t));
}

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
