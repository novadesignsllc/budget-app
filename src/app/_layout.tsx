import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { SyncIndicator } from '@/components/sync-indicator';
import { ToastHost } from '@/components/toast';
import { useSession, useSessionBootstrap } from '@/sync/session';
import { useColors } from '@/theme';
import { pinLightAppearance } from '@/theme/preference';

SplashScreen.preventAutoHideAsync();
pinLightAppearance();

const sheet = {
  presentation: 'formSheet',
  sheetGrabberVisible: true,
  headerShown: false,
} as const;

export default function RootLayout() {
  useSessionBootstrap();
  const status = useSession((s) => s.status);
  const dataReady = useSession((s) => s.dataReady);
  const colors = useColors();
  const base = DefaultTheme;

  // Keep the splash up until we know who's signed in and their data has loaded,
  // so the app never flashes empty and nothing is edited before sync is ready.
  const loaded = status === 'signedOut' || (status === 'signedIn' && dataReady);
  useEffect(() => {
    if (loaded) void SplashScreen.hideAsync();
  }, [loaded]);
  if (!loaded) return null;

  const sheetStyle = (detents: number[]) => ({
    ...sheet,
    sheetAllowedDetents: detents,
    contentStyle: { backgroundColor: colors.background },
  });

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider
        value={{
          ...base,
          colors: {
            ...base.colors,
            background: colors.background,
            card: colors.background,
            text: colors.text,
            primary: colors.accent,
            border: colors.separator,
          },
        }}
      >
        <Stack screenOptions={{ contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Protected guard={status === 'signedIn'}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="add" options={sheetStyle([0.62, 1])} />
            <Stack.Screen name="transaction/[id]" options={sheetStyle([0.8, 1])} />
            <Stack.Screen name="new-account" options={sheetStyle([1])} />
            <Stack.Screen name="reconcile" options={sheetStyle([0.7, 1])} />
            <Stack.Screen name="envelope/[id]" options={sheetStyle([0.75, 1])} />
            <Stack.Screen name="new-envelope" options={sheetStyle([0.6, 1])} />
            <Stack.Screen name="transfer" options={sheetStyle([0.6, 1])} />
            <Stack.Screen name="statement" options={sheetStyle([0.6, 1])} />
            <Stack.Screen name="edit-recurring" options={sheetStyle([1])} />
            <Stack.Screen name="debt-plan" options={sheetStyle([0.5, 1])} />
          </Stack.Protected>
          <Stack.Protected guard={status !== 'signedIn'}>
            <Stack.Screen name="sign-in" options={{ headerShown: false }} />
          </Stack.Protected>
        </Stack>
        <SyncIndicator />
        <ToastHost />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
