import { Appearance } from 'react-native';

/**
 * The app is light only for now. Pin the system appearance so native pieces (sheets,
 * pickers, the keyboard) match even when the phone is in dark mode.
 */
export function pinLightAppearance() {
  if (process.env.EXPO_OS === 'web') return;
  Appearance.setColorScheme('light');
}
