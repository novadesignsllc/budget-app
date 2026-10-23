import { useColorScheme as useSystemScheme } from 'react-native';

import { useThemePreference } from '@/theme/preference';

/** The scheme to draw with: the Settings choice, or the phone's when set to System. */
export function useColorScheme(): 'light' | 'dark' {
  const system = useSystemScheme();
  const preference = useThemePreference((s) => s.preference);
  if (preference !== 'system') return preference;
  return system === 'dark' ? 'dark' : 'light';
}
