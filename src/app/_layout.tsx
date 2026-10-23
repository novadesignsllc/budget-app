import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { palettes } from '@/theme';

const sheet = {
  presentation: 'formSheet',
  sheetGrabberVisible: true,
  headerShown: false,
} as const;

export default function RootLayout() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = palettes[scheme];
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;

  return (
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
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="add"
          options={{
            ...sheet,
            sheetAllowedDetents: [0.62, 1],
            contentStyle: { backgroundColor: colors.surface },
          }}
        />
        <Stack.Screen name="transaction/[id]" options={{ ...sheet, sheetAllowedDetents: [0.8, 1], contentStyle: { backgroundColor: colors.surface } }} />
        <Stack.Screen name="new-account" options={{ ...sheet, sheetAllowedDetents: [1], contentStyle: { backgroundColor: colors.surface } }} />
        <Stack.Screen name="reconcile" options={{ ...sheet, sheetAllowedDetents: [0.7, 1], contentStyle: { backgroundColor: colors.surface } }} />
        <Stack.Screen name="envelope/[id]" options={{ ...sheet, sheetAllowedDetents: [0.75, 1], contentStyle: { backgroundColor: colors.surface } }} />
        <Stack.Screen name="new-envelope" options={{ ...sheet, sheetAllowedDetents: [0.6, 1], contentStyle: { backgroundColor: colors.surface } }} />
        <Stack.Screen name="transfer" options={{ ...sheet, sheetAllowedDetents: [0.6, 1], contentStyle: { backgroundColor: colors.surface } }} />
        <Stack.Screen name="statement" options={{ ...sheet, sheetAllowedDetents: [0.6, 1], contentStyle: { backgroundColor: colors.surface } }} />
        <Stack.Screen name="edit-recurring" options={{ ...sheet, sheetAllowedDetents: [1], contentStyle: { backgroundColor: colors.surface } }} />
      </Stack>
    </ThemeProvider>
  );
}
