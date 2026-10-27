import { Switch, View } from 'react-native';

import { setScheme, spacing, useColors, useScheme } from '@/theme';
import { haptic } from '@/utils/haptics';

import { Text } from './text';

/** Dark mode on or off, for this device only. */
export function DarkModeRow({ paddingHorizontal = spacing.md + 2 }: { paddingHorizontal?: number }) {
  const colors = useColors();
  const dark = useScheme((s) => s.scheme === 'dark');
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingHorizontal,
        paddingVertical: spacing.sm + 2,
        backgroundColor: colors.surface,
      }}
    >
      <Text variant="body" weight="500" style={{ flex: 1 }}>
        Dark mode
      </Text>
      <Switch
        accessibilityLabel="Dark mode"
        value={dark}
        onValueChange={(v) => {
          haptic('selection');
          setScheme(v ? 'dark' : 'light');
        }}
        trackColor={{ true: colors.accent, false: colors.fill }}
        thumbColor="#FFFFFF"
        {...({ activeThumbColor: '#FFFFFF' } as object)}
      />
    </View>
  );
}
