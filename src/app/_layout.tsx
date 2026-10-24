import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { SyncIndicator } from '@/components/sync-indicator';
import { ToastHost } from '@/components/toast';
import { useSession, useSessionBootstrap } from '@/sync/session';
import { useColors } from '@/theme';
import { pinLightAppearance } from '@/theme/preference';
import '@/theme/web-reset';

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

  // One height only: full. With a shorter detent, iOS raises the sheet for the keyboard and
  // drops it again when the keyboard closes (like tapping a dropdown), so the whole menu jumps.
  const sheetStyle = {
    ...sheet,
    sheetAllowedDetents: [1],
    contentStyle: { backgroundColor: colors.background },
  };

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
            <Stack.Screen name="add" options={sheetStyle} />
            <Stack.Screen name="transaction/[id]" options={sheetStyle} />
            <Stack.Screen name="new-account" options={sheetStyle} />
            <Stack.Screen name="reconcile" options={sheetStyle} />
            <Stack.Screen name="envelope/[id]" options={sheetStyle} />
            <Stack.Screen name="new-envelope" options={sheetStyle} />
            <Stack.Screen name="transfer" options={sheetStyle} />
            <Stack.Screen name="statement" options={sheetStyle} />
            <Stack.Screen name="edit-recurring" options={sheetStyle} />
            <Stack.Screen name="debt-plan" options={sheetStyle} />
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
