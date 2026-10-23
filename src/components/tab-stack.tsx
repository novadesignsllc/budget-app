import { Stack } from 'expo-router';

import { useColors } from '@/theme';

/** The native stack inside each tab: large titles that collapse on scroll. */
export function TabStack({ title }: { title: string }) {
  const colors = useColors();
  return (
    <Stack
      screenOptions={{
        headerLargeTitleEnabled: true,
        headerShadowVisible: false,
        headerLargeTitleShadowVisible: false,
        headerTransparent: process.env.EXPO_OS === 'ios',
        headerBlurEffect: 'systemChromeMaterial',
        headerLargeStyle: { backgroundColor: 'transparent' },
        headerStyle: { backgroundColor: process.env.EXPO_OS === 'ios' ? undefined : colors.background },
        headerTitleStyle: { color: colors.text },
        headerBackButtonDisplayMode: 'minimal',
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title }} />
    </Stack>
  );
}
