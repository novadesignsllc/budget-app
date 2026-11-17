import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { FullWindowOverlay } from 'react-native-screens';
import { create } from 'zustand';

import { radius, spacing, useColors } from '@/theme';

import { Button } from './button';
import { Text } from './text';

type Ask = { title: string; message: string; yes: string; destructive?: boolean; resolve: (yes: boolean) => void };

export const useConfirm = create<{ ask: Ask | null }>()(() => ({ ask: null }));

function answer(yes: boolean) {
  const ask = useConfirm.getState().ask;
  useConfirm.setState({ ask: null });
  ask?.resolve(yes);
}

/** The app's own "are you sure?" card, over everything (sheets too), instead of the system alert. */
export function ConfirmHost() {
  const ask = useConfirm((s) => s.ask);
  const colors = useColors();

  // Escape cancels and Enter confirms on a computer.
  useEffect(() => {
    if (!ask || process.env.EXPO_OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') answer(false);
      if (e.key === 'Enter') answer(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ask]);

  if (!ask) return null;
  const body = (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
      <Pressable
        accessibilityLabel="Cancel"
        onPress={() => answer(false)}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.backdrop }}
      />
      <View
        accessibilityRole="alert"
        style={{
          width: '100%',
          maxWidth: 340,
          padding: spacing.lg,
          gap: spacing.sm,
          borderRadius: radius.card,
          borderCurve: 'continuous',
          borderWidth: 1,
          borderColor: colors.menuBorder,
          backgroundColor: colors.surface,
        }}
      >
        <Text variant="section">{ask.title}</Text>
        <Text variant="callout" tone="textSecondary">
          {ask.message}
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
          <Button title="Cancel" variant="secondary" size="lg" style={{ flex: 1 }} onPress={() => answer(false)} />
          <Button
            title={ask.yes}
            variant={ask.destructive ? 'destructive' : 'primary'}
            size="lg"
            style={{ flex: 1 }}
            onPress={() => answer(true)}
          />
        </View>
      </View>
    </View>
  );
  return process.env.EXPO_OS === 'ios' ? <FullWindowOverlay>{body}</FullWindowOverlay> : body;
}
