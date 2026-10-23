import { View } from 'react-native';

import { backend, inDemo } from '@/backend';
import { setDemoMode } from '@/backend/mode';
import { Button } from '@/components/button';
import { FieldLabel } from '@/components/field';
import { SheetScreen } from '@/components/screen';
import { Segmented } from '@/components/segmented';
import { Text } from '@/components/text';
import { useSession } from '@/sync/session';
import { useStore } from '@/store';
import { loadSampleData } from '@/store/sample-data';
import { spacing } from '@/theme';
import { useThemePreference, type ThemePreference } from '@/theme/preference';
import { closeSheet } from '@/utils/close-sheet';

export function Settings() {
  const user = useSession((s) => s.user);
  const empty = useStore((s) => s.accounts.length === 0);
  const preference = useThemePreference((s) => s.preference);
  const setPreference = useThemePreference((s) => s.set);

  return (
    <SheetScreen>
      <Text variant="title">Settings</Text>

      <View style={{ gap: spacing.xs + 2 }}>
        <FieldLabel label="Appearance" />
        <Segmented<ThemePreference>
          value={preference}
          onChange={setPreference}
          options={[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
      </View>

      {inDemo ? (
        <View style={{ gap: spacing.md }}>
          <Text variant="body" style={{ paddingHorizontal: spacing.xs }}>
            You’re in the demo. Nothing here touches your real account.
          </Text>
          <Button title="Exit demo" variant="secondary" onPress={() => void setDemoMode(false)} />
        </View>
      ) : (
        <>
          <View style={{ gap: spacing.xs }}>
            <FieldLabel label="Signed in as" />
            <Text variant="body" selectable style={{ paddingHorizontal: spacing.xs }}>
              {user?.email ?? 'Apple ID (email hidden)'}
            </Text>
            <Text variant="footnote" tone="textSecondary" style={{ paddingHorizontal: spacing.xs }}>
              Your data syncs through Firebase to any device signed in to this account.
            </Text>
          </View>

          <Button
            title="Sign out"
            variant="destructive"
            onPress={() => {
              closeSheet();
              void backend.signOut();
            }}
          />
        </>
      )}
      {__DEV__ && empty && !inDemo && (
        <Button
          title="Load sample data"
          variant="ghost"
          onPress={() => {
            loadSampleData();
            closeSheet();
          }}
        />
      )}
    </SheetScreen>
  );
}
