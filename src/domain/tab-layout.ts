/** The phone tab bar's layout: which tabs show, in what order. Settings is always last. */
export const BAR_TABS = ['recurring', 'transactions', 'income', 'home', 'budget', 'debt', 'settings'] as const;
export type BarTab = (typeof BAR_TABS)[number];
export type TabBarLayout = { order: BarTab[]; hidden: BarTab[] };

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

