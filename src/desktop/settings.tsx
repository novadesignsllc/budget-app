import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { backend, inDemo } from '@/backend';
import { setDemoMode } from '@/backend/mode';
import { Text, type TextTone } from '@/components/text';
import { BankLinksCard } from '@/components/bank-links';
import { ProfilesCard } from '@/components/profiles-card';
import { PayeesCard } from '@/screens/settings-payees';
import { DarkModeRow } from '@/components/dark-mode-row';
import { TabBarCard } from '@/components/tab-bar-card';
import { useSession } from '@/sync/session';
import { useSyncStatus } from '@/sync/status';
import { useColors } from '@/theme';

import { DButton, DCard, DPage, Kbd, PageTitle, Spacer } from './ui';

const SHORTCUTS: [string, string][] = [
  ['N', 'New transaction'],
  ['1 – 7', 'Home, Transactions, Budget, Debt, Recurring, Income, Settings'],
  ['/', 'Search on this page'],
  ['↑ ↓', 'Pick an envelope in Budget'],
  ['← →', 'Change the month in Budget'],
  ['Enter', 'Save an amount or the new transaction row'],
  ['Esc', 'Cancel typing, or close a form'],
];

/** Settings on a computer: payees on the left; your account, shortcuts and the danger zone on the right. */
export function DesktopSettings() {
  const user = useSession((s) => s.user);
  const phase = useSyncStatus((s) => s.phase);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);

  return (
    <DPage
      title="Settings"
      header={
        <>
          <PageTitle>Settings</PageTitle>
          <Spacer />
          <DButton
            label={searching ? 'Done searching' : 'Search payees'}
            icon={{ sf: 'magnifyingglass', md: 'search' }}
            onPress={() => {
              setSearching(!searching);
              setAdding(false);
            }}
          />
          <DButton
            label="Payee"
            icon={{ sf: 'plus', md: 'add' }}
            accessibilityLabel="Add a payee"
            onPress={() => {
              setAdding(!adding);
              setSearching(false);
            }}
          />
        </>
      }
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 20 }}>
        <View style={{ flexGrow: 999, flexShrink: 1, flexBasis: 520, minWidth: 0, maxWidth: 760 }}>
          <PayeesCard searching={searching} adding={adding} onDoneAdding={() => setAdding(false)} />
        </View>

        <View style={{ flexGrow: 1, flexShrink: 0, flexBasis: 320, maxWidth: 420, gap: 14 }}>
          <ProfilesCard />
          <BankLinksCard />
          <DCard>
            <SectionTitle>Appearance</SectionTitle>
            <DarkModeRow paddingHorizontal={18} />
            <View style={{ height: 6 }} />
          </DCard>
          <TabBarCard />
          <DCard>
            <SectionTitle>Your account</SectionTitle>
            {inDemo ? (
              <Row title="Exit demo" detail="Back to your account ›" onPress={() => void setDemoMode(false)} />
            ) : (
              <>
                <Row title={user?.email ?? 'Signed in with Apple'} detail={phase === 'error' ? 'Not syncing' : 'Syncing with your phone'} />
                <Row title="Try the demo" detail="Six months of sample data ›" onPress={() => void setDemoMode(true)} />
                <Row title="Sign out" tone="negative" onPress={() => void backend.signOut()} />
              </>
            )}
          </DCard>

          <DCard>
            <SectionTitle>Keyboard shortcuts</SectionTitle>
            {SHORTCUTS.map(([keys, what]) => (
              <View key={keys} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 7 }}>
                <View style={{ width: 64, alignItems: 'flex-start' }}>
                  <Kbd>{keys}</Kbd>
                </View>
                <Text variant="callout" tone="textSecondary" style={{ flex: 1 }}>
                  {what}
                </Text>
              </View>
            ))}
            <View style={{ height: 10 }} />
          </DCard>

          <DCard>
            <SectionTitle>Start over</SectionTitle>
            <Row title="Reset account" detail="Erase everything, stay signed in" tone="negative" onPress={() => router.push('/reset-account')} />
            {!inDemo && <Row title="Delete account" detail="Erase everything and the sign-in" tone="negative" onPress={() => router.push('/delete-account')} />}
          </DCard>
        </View>
      </View>
    </DPage>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <Text variant="callout" weight="700" style={{ paddingHorizontal: 18, paddingTop: 16, paddingBottom: 8 }}>
      {children}
    </Text>
  );
}

function Row({ title, detail, tone = 'text', onPress }: { title: string; detail?: string; tone?: TextTone; onPress?: () => void }) {
  const colors = useColors();
  const body = (
    <>
      <Text variant="body" tone={tone} numberOfLines={1} style={{ flex: 1 }}>
        {title}
      </Text>
      {detail ? (
        <Text variant="callout" tone="textSecondary" numberOfLines={1}>
          {detail}
        </Text>
      ) : null}
    </>
  );
  const style = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    minHeight: 42,
    paddingHorizontal: 18,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  };
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ hovered }: { hovered?: boolean }) => [style, { backgroundColor: hovered ? colors.control : 'transparent' }]}
    >
      {body}
    </Pressable>
  ) : (
    <View style={style}>{body}</View>
  );
}
