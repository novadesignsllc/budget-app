import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { backend, inDemo } from '@/backend';
import { setDemoMode } from '@/backend/mode';
import { BankError } from '@/bank/api';
import { reconnectBank, syncBank, unlinkBank } from '@/bank/sync';
import { useLinkBank } from '@/components/bank-links';
import { DarkModeRow } from '@/components/dark-mode-row';
import { ProfilesCard } from '@/components/profiles-card';
import { Text } from '@/components/text';
import { useToast } from '@/components/toast';
import { syncedLabel } from '@/hooks/use-bank';
import { PayeesCard } from '@/screens/settings-payees';
import { useStore } from '@/store';
import { useProfiles } from '@/sync/profiles';
import { useSession } from '@/sync/session';
import { useSyncStatus } from '@/sync/status';
import { spacing, useColors } from '@/theme';
import { confirmAction } from '@/utils/confirm';

import { DButton, DCard, DPage, Kbd, PageTitle } from './ui';

const SHORTCUTS: [string, string][] = [
  ['N', 'New transaction'],
  ['1 – 7', 'Home, Transactions, Budget, Debt, Recurring, Income, Settings'],
  ['/', 'Search on this page'],
  ['↑ ↓', 'Pick an envelope in Budget'],
  ['← →', 'Change the month in Budget'],
  ['Enter', 'Save an amount or the new transaction row'],
  ['Esc', 'Cancel typing, or close a form'],
];

type Section = 'Banks' | 'Payees' | 'Profiles' | 'Appearance' | 'Account' | 'Shortcuts' | 'Start over';

/** Settings on a computer: one scrolling column of plain sections. */
export function DesktopSettings() {
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const user = useSession((s) => s.user);
  const phase = useSyncStatus((s) => s.phase);
  const payeeCount = useStore((s) => s.payees.length);
  const profileCount = useProfiles((s) => s.list.length);

  const section = (name: Section, children: React.ReactNode, actions?: React.ReactNode, detail?: string) => (
    <View key={name} style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 30 }}>
        <Text variant="section" weight="700" accessibilityRole="header" style={{ flex: 1 }}>
          {name}
          {detail ? (
            <Text variant="callout" tone="textTertiary">
              {`  ${detail}`}
            </Text>
          ) : null}
        </Text>
        {actions}
      </View>
      {children}
    </View>
  );

  return (
    <DPage
      title="Settings"
      header={<PageTitle>Settings</PageTitle>}
    >
      <View style={{ width: '100%', maxWidth: 760, gap: 28 }}>
        <View style={{ gap: 28 }}>
          <BanksSection section={section} />

          {section(
            'Payees',
            <PayeesCard bare searching={searching} adding={adding} onDoneAdding={() => setAdding(false)} />,
            <>
              <DButton
                label={searching ? 'Done' : 'Search'}
                icon={{ sf: 'magnifyingglass', md: 'search' }}
                onPress={() => {
                  setSearching(!searching);
                  setAdding(false);
                }}
                style={{ height: 30 }}
              />
              <DButton
                label="Add payee"
                onPress={() => {
                  setAdding(!adding);
                  setSearching(false);
                }}
                style={{ height: 30 }}
              />
            </>,
            String(payeeCount),
          )}

          {section('Profiles', <ProfilesCard bare />, undefined, `${profileCount} of 3`)}

          {section(
            'Appearance',
            <DCard style={{ paddingVertical: 4 }}>
              <DarkModeRow paddingHorizontal={16} />
            </DCard>,
          )}

          {section(
            'Account',
            <DCard>
              {inDemo ? (
                <Row title="You're in the demo" action={<DButton label="Exit demo" onPress={() => void setDemoMode(false)} style={{ height: 28 }} />} />
              ) : (
                <>
                  <Row
                    title={user?.email ? `Signed in as ${user.email}` : 'Signed in with Apple'}
                    detail={phase === 'error' ? 'Not syncing' : 'Syncing with your phone'}
                    action={<DButton label="Sign out" onPress={() => void backend.signOut()} style={{ height: 28 }} />}
                  />
                  <Row
                    title="Try the demo"
                    detail="Six months of sample data"
                    action={<DButton label="Open demo" onPress={() => void setDemoMode(true)} style={{ height: 28 }} />}
                    last
                  />
                </>
              )}
            </DCard>,
          )}

          {section(
            'Shortcuts',
            <DCard style={{ paddingVertical: 6 }}>
              {SHORTCUTS.map(([keys, what]) => (
                <View key={keys} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 6 }}>
                  <View style={{ width: 64, alignItems: 'flex-start' }}>
                    <Kbd>{keys}</Kbd>
                  </View>
                  <Text variant="callout" tone="textSecondary" style={{ flex: 1 }}>
                    {what}
                  </Text>
                </View>
              ))}
            </DCard>,
          )}

          {section(
            'Start over',
            <DCard>
              <Row
                title="Fresh start"
                detail="Clear transactions and balances. Keep envelopes, bills and banks."
                action={<DangerButton label="Fresh start…" onPress={() => router.push('/fresh-start')} />}
              />
              <Row
                title="Reset this budget"
                detail="Erase everything in it. You stay signed in."
                action={<DangerButton label="Reset…" onPress={() => router.push('/reset-account')} />}
                last={inDemo}
              />
              {!inDemo && (
                <Row
                  title="Delete account"
                  detail="Erase everything and the sign-in."
                  action={<DangerButton label="Delete…" onPress={() => router.push('/delete-account')} />}
                  last
                />
              )}
            </DCard>,
          )}
        </View>
      </View>
    </DPage>
  );
}

/** Each linked bank with its accounts and last sync, and its actions as plain buttons. */
function BanksSection({
  section,
}: {
  section: (name: Section, children: React.ReactNode, actions?: React.ReactNode) => React.ReactNode;
}) {
  const links = useStore((s) => s.bankLinks);
  const accounts = useStore((s) => s.accounts);
  const showToast = useToast((s) => s.show);
  const { start, busy } = useLinkBank();
  const fail = (e: unknown) =>
    showToast({ message: e instanceof BankError || e instanceof Error ? e.message : 'Something went wrong. Try again.' });
  return section(
    'Banks',
    <DCard>
      {links.length === 0 ? (
        <Row title="No banks linked" detail="Link one and Slip checks what you enter against it." last />
      ) : (
        links.map((l, i) => {
          const fed = l.accounts.map((a) => accounts.find((x) => x.id === a.accountId)?.name).filter(Boolean) as string[];
          const setUp = fed.length > 0;
          return (
            <Row
              key={l.id}
              title={l.institution}
              detail={!setUp ? 'Not set up yet' : `${fed.join(', ')} · ${l.needsLogin ? 'Wants you to sign in again' : syncedLabel(l.syncedAt)}`}
              warn={!setUp || l.needsLogin}
              last={i === links.length - 1}
              action={
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  {!setUp ? (
                    <LinkButton label="Finish setup" onPress={() => router.push({ pathname: '/bank-setup', params: { id: l.id } })} />
                  ) : (
                    <LinkButton
                      label="Check now"
                      onPress={() => void syncBank(l.id).then(() => showToast({ message: `${l.institution} is up to date.` }), fail)}
                    />
                  )}
                  <LinkButton label="Reconnect" onPress={() => void reconnectBank(l.id).catch(fail)} />
                  <LinkButton
                    label="Unlink"
                    danger
                    onPress={async () => {
                      const yes = await confirmAction(`Unlink ${l.institution}?`, 'Slip stops checking this bank. Your transactions stay.', 'Unlink');
                      if (yes) await unlinkBank(l.id).then(() => showToast({ message: `${l.institution} is unlinked.` }), fail);
                    }}
                  />
                </View>
              }
            />
          );
        })
      )}
    </DCard>,
    <DButton label={busy ? 'Opening…' : 'Link a bank'} onPress={() => void start()} style={{ height: 30 }} />,
  );
}

function Row({
  title,
  detail,
  action,
  warn,
  last,
}: {
  title: string;
  detail?: string;
  action?: React.ReactNode;
  warn?: boolean;
  last?: boolean;
}) {
  const colors = useColors();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: 48,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.hairline,
      }}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text variant="body" weight="600" numberOfLines={1}>
          {title}
        </Text>
        {detail ? (
          <Text variant="footnote" tone={warn ? 'orange' : 'textSecondary'} numberOfLines={2}>
            {detail}
          </Text>
        ) : null}
      </View>
      {action}
    </View>
  );
}

function LinkButton({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ hovered }: { hovered?: boolean }) => ({
        height: 28,
        paddingHorizontal: 10,
        borderRadius: 8,
        justifyContent: 'center',
        backgroundColor: hovered ? colors.control : 'transparent',
      })}
    >
      <Text variant="callout" weight="600" tone={danger ? 'negative' : 'accent'}>
        {label}
      </Text>
    </Pressable>
  );
}

function DangerButton({ label, onPress }: { label: string; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ hovered }: { hovered?: boolean }) => ({
        height: 28,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.negativeBorder,
        justifyContent: 'center',
        backgroundColor: hovered ? colors.negativeSoft : colors.surface,
      })}
    >
      <Text variant="callout" weight="600" tone="negative">
        {label}
      </Text>
    </Pressable>
  );
}
