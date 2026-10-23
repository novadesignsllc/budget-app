import 'expo-sqlite/localStorage/install';

import { Appearance } from 'react-native';
import { create } from 'zustand';

export type ThemePreference = 'system' | 'light' | 'dark';

const KEY = 'theme-preference';

function read(): ThemePreference {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

/** On iPhone, tell the system too, so the tab bar, sheets and pickers match. */
function applyNative(pref: ThemePreference) {
  if (process.env.EXPO_OS === 'web') return;
  Appearance.setColorScheme(pref === 'system' ? 'unspecified' : pref);
}

/** Light, dark, or follow the phone. Saved per device, not synced. */
export const useThemePreference = create<{ preference: ThemePreference; set: (p: ThemePreference) => void }>()(
  (set) => {
    const initial = read();
    applyNative(initial);
    return {
      preference: initial,
      set: (preference) => {
        try {
          localStorage.setItem(KEY, preference);
        } catch {}
        applyNative(preference);
        set({ preference });
      },
    };
  },
);
