import { View } from 'react-native';

import { backend } from '@/backend';
import { Button } from '@/components/button';
import { SheetScreen } from '@/components/screen';
import { Text } from '@/components/text';
import { useSession } from '@/sync/session';
import { useStore } from '@/store';
import { loadSampleData } from '@/store/sample-data';
import { spacing } from '@/theme';
import { closeSheet } from '@/utils/close-sheet';

export function Settings() {
  const user = useSession((s) => s.user);
  const empty = useStore((s) => s.accounts.length === 0);
  return (
    <SheetScreen>
      <Text variant="title">Settings</Text>
      <View style={{ gap: spacing.xs }}>
        <Text variant="footnote" weight="500" tone="textSecondary">
          Signed in as
        </Text>
        <Text variant="body" selectable>
          {user?.email ?? 'Apple ID (email hidden)'}
        </Text>
      </View>
      <Text variant="callout" tone="textSecondary">
        Your data syncs through Firebase between this device and any other one signed in to the same account.
      </Text>
      <Button
        title="Sign out"
        variant="destructive"
        onPress={() => {
          closeSheet();
          void backend.signOut();
        }}
      />
      {__DEV__ && empty && (
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
