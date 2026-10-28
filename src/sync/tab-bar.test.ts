import { describe, expect, it } from '@jest/globals';

import { normalizeLayout, shownTabs } from './tab-bar';

describe('tab bar layout', () => {
  it('keeps Settings last and always shown', () => {
    const l = normalizeLayout({ order: ['settings', 'budget', 'home'], hidden: ['settings', 'debt'] });
    expect(l.order[l.order.length - 1]).toBe('settings');
    expect(l.order.slice(0, 2)).toEqual(['budget', 'home']);
    expect(shownTabs(l)).not.toContain('debt');
    expect(shownTabs(l)).toContain('settings');
  });

  it('adds tabs it did not know about before Settings, and drops unknown ones', () => {
    const l = normalizeLayout({ order: ['home', 'nope' as never], hidden: [] });
    expect(l.order).toEqual(['home', 'recurring', 'transactions', 'income', 'budget', 'debt', 'settings']);
  });
});
