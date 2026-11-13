import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { BankError } from '@/bank/api';
import { linkNewBank, reconnectBank, syncAllBanks, syncBank, unlinkBank } from '@/bank/sync';
import { syncedLabel } from '@/hooks/use-bank';
import { useStore } from '@/store';
import { spacing, useColors } from '@/theme';
import { confirmAction } from '@/utils/confirm';

import { ActionMenu } from './action-menu';
import { Card, CardHeader } from './card';
import { Icon } from './icon';
import { Text } from './text';
import { useToast } from './toast';

/** Opens Plaid's sign-in, then the setup sheet. Errors show as a toast. */
export function useLinkBank() {
  const showToast = useToast((s) => s.show);
  const [busy, setBusy] = useState(false);
  const start = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const link = await linkNewBank();
      if (!link) return;
      if (link.accounts.some((a) => a.accountId)) {
        // A bank that was already set up: it's reconnected, nothing to choose again.
        showToast({ message: `${link.institution} is already linked. It’s reconnected.` });
        void syncBank(link.id).catch(() => {});
      } else router.push({ pathname: '/bank-setup', params: { id: link.id } });
    } catch (e) {
      showToast({ message: e instanceof Error ? e.message : 'Couldn’t link the bank. Try again.' });
    } finally {
      setBusy(false);
    }
  };
  return { start, busy };
}

/**
 * Settings: each linked bank with the accounts it feeds and when it last synced, plus
 * Link a bank. A bank's menu has Check now, Reconnect and Unlink.
 */
export function BankLinksCard({ padding = spacing.md + 2 }: { padding?: number }) {
  const colors = useColors();
  const links = useStore((s) => s.bankLinks);
  const accounts = useStore((s) => s.accounts);
  const showToast = useToast((s) => s.show);
  const { start, busy } = useLinkBank();

  const fail = (e: unknown) =>
    showToast({ message: e instanceof BankError || e instanceof Error ? e.message : 'Something went wrong. Try again.' });

  return (
    <Card>
      <CardHeader title="Banks" action={{ label: busy ? 'Opening…' : 'Link a bank', onPress: () => void start() }} />
      {links.length === 0 ? (
        <Text variant="callout" tone="textSecondary" style={{ padding }}>
          No banks linked.
        </Text>
      ) : (
        links.map((l, i) => {
          const fed = l.accounts
            .map((a) => accounts.find((x) => x.id === a.accountId)?.name)
            .filter(Boolean) as string[];
          const setUp = fed.length > 0;
          const status = !setUp ? 'Not set up yet' : l.needsLogin ? 'Wants you to sign in again' : syncedLabel(l.syncedAt);
          return (
            <View
              key={l.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                paddingHorizontal: padding,
                paddingVertical: spacing.sm + 3,
                borderBottomWidth: i === links.length - 1 ? 0 : 1,
                borderBottomColor: colors.hairline,
              }}
            >
              <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                <Text variant="body" weight="600" numberOfLines={1}>
                  {l.institution}
                </Text>
                <Text variant="footnote" tone={!setUp || l.needsLogin ? 'orange' : 'textSecondary'} numberOfLines={2}>
                  {setUp ? `${fed.join(', ')} · ${status}` : status}
                </Text>
              </View>
              {!setUp ? (
                <Pressable
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => router.push({ pathname: '/bank-setup', params: { id: l.id } })}
                >
                  <Text variant="callout" weight="600" tone="accent">
                    Finish
                  </Text>
                </Pressable>
              ) : null}
              <ActionMenu
                accessibilityLabel={`${l.institution} options`}
                hitSlop={8}
                items={[
                  ...(setUp
                    ? [
                        {
                          label: 'Check now',
                          onPress: () =>
                            void syncBank(l.id).then(() => showToast({ message: `${l.institution} is up to date.` }), fail),
                        },
                      ]
                    : []),
                  {
                    label: 'Reconnect',
                    onPress: () => void reconnectBank(l.id).catch(fail),
                  },
                  {
                    label: 'Unlink',
                    onPress: async () => {
                      const yes = await confirmAction(
                        `Unlink ${l.institution}?`,
                        'Slip stops checking this bank. Your transactions stay.',
                        'Unlink',
                      );
                      if (yes) await unlinkBank(l.id).then(() => showToast({ message: `${l.institution} is unlinked.` }), fail);
                    },
                  },
                ]}
                style={({ pressed }) => ({
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: pressed ? colors.control : 'transparent',
                })}
              >
                <Icon sf="ellipsis" md="more_horiz" size={15} color={colors.textSecondary} />
              </ActionMenu>
            </View>
          );
        })
      )}
    </Card>
  );
}

/** Checks every bank now (Settings' pull, the desktop button). */
export const checkAllBanks = () => syncAllBanks({ force: true });
