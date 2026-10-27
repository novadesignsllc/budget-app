import { Appearance } from 'react-native';

import { palettes, useScheme } from './index';

/**
 * Native pieces (sheets, pickers, the keyboard, the status bar) follow the app's light or
 * dark setting, not the phone's. On the web, the page behind the app and the browser's
 * own controls follow it too.
 */
export function followAppScheme() {
  const apply = (scheme: 'light' | 'dark') => {
    if (process.env.EXPO_OS === 'web') {
      if (typeof document === 'undefined') return;
      document.documentElement.style.colorScheme = scheme;
      document.body.style.backgroundColor = palettes[scheme].background;
    } else {
      Appearance.setColorScheme(scheme);
    }
  };
  apply(useScheme.getState().scheme);
  useScheme.subscribe((s, prev) => {
    if (s.scheme !== prev.scheme) apply(s.scheme);
  });
}
