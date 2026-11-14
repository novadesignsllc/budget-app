import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable } from 'react-native';

import { backend, inDemo } from '@/backend';
import { setDemoMode } from '@/backend/mode';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { ActionButton, ScreenActions } from '@/components/screen-actions';
import { ScreenTitle } from '@/components/screen-title';
import { Text, type TextTone } from '@/components/text';
import { BankLinksCard } from '@/components/bank-links';
import { ProfilesCard } from '@/components/profiles-card';
import { PayeesCard } from '@/screens/settings-payees';
import { DarkModeRow } from '@/components/dark-mode-row';
import { TabBarCard } from '@/components/tab-bar-card';
import { useSession } from '@/sync/session';
import { useStore } from '@/store';
import { loadSampleData } from '@/store/sample-data';
import { spacing, useColors } from '@/theme';

function ActionRow({
  title,
  detail,
  tone = 'text',
  onPress,
  last,
}: {
  title: string;
  detail?: string;
  tone?: TextTone;
  onPress: () => void;
  last?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        height: 42,
        paddingHorizontal: spacing.md + 2,
        gap: spacing.sm,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.hairline,
        backgroundColor: pressed ? colors.control : colors.surface,
      })}
    >
      <Text variant="body" tone={tone} style={{ flex: 1 }}>
        {title}
      </Text>
      {detail ? (
        <Text variant="callout" tone="textSecondary">
          {detail}
        </Text>
      ) : null}
    </Pressable>
  );
}

export function Settings() {
  const user = useSession((s) => s.user);
  const empty = useStore((s) => s.accounts.length === 0);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const devSample = __DEV__ && empty && !inDemo;

  return (
    <>
      <Screen>
        <ScreenTitle title="Settings" />

        <ProfilesCard />

        <BankLinksCard />

        <Card>
          <DarkModeRow />
        </Card>

        <TabBarCard />

        <PayeesCard searching={searching} adding={adding} onDoneAdding={() => setAdding(false)} />

        <Card>
          {inDemo ? (
            <ActionRow title="Exit demo" detail="Back to your account ›" onPress={() => void setDemoMode(false)} last />
          ) : (
            <>
              <ActionRow title="Try the demo" detail="Six months of sample data ›" onPress={() => void setDemoMode(true)} />
              {devSample && <ActionRow title="Load sample data" detail="Dev only" onPress={loadSampleData} />}
              <ActionRow
                title="Sign out"
                detail={user?.email ?? 'Signed in with Apple'}
                tone="negative"
                onPress={() => void backend.signOut()}
                last
              />
            </>
          )}
        </Card>

        <Card>
          <ActionRow
            title="Fresh start"
            detail="Clear transactions, keep the setup"
            tone="negative"
            onPress={() => router.push('/fresh-start')}
          />
          <ActionRow
            title="Reset account"
            detail="Start over empty"
            tone="negative"
            onPress={() => router.push('/reset-account')}
            last={inDemo}
          />
          {!inDemo && (
            <ActionRow title="Delete account" tone="negative" onPress={() => router.push('/delete-account')} last />
          )}
        </Card>
      </Screen>
      <ScreenActions>
        <ActionButton
          icon={{ sf: 'magnifyingglass', md: 'search' }}
          variant={searching ? 'accent' : 'outline'}
          accessibilityLabel={searching ? 'Stop searching payees' : 'Search payees'}
          onPress={() => {
            setSearching(!searching);
            setAdding(false);
          }}
        />
        <ActionButton
          icon={{ sf: 'plus', md: 'add' }}
          variant="ink"
          accessibilityLabel="Add a payee"
          onPress={() => {
            setAdding(!adding);
            setSearching(false);
          }}
        />
      </ScreenActions>
    </>
  );
}
