import { router, Stack } from 'expo-router';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { HeroCard } from '@/components/hero-card';
import { Money } from '@/components/money';
import { Text } from '@/components/text';
import { daysBetween, today } from '@/domain/dates';
import { useLedger } from '@/hooks/use-ledger';
import { TransactionList } from '@/screens/transactions';
import { useStore } from '@/store';
import { spacing } from '@/theme';

export function AccountDetail({ id }: { id: string }) {
  const ledger = useLedger();
  const account = useStore((s) => s.accounts.find((a) => a.id === id));
  const moveAccount = useStore((s) => s.moveAccount);

  if (!account) {
    return (
      <View style={{ padding: spacing.lg }}>
        <Text variant="body">This account doesn’t exist anymore.</Text>
      </View>
    );
  }

  const balance = ledger.balance.get(id) ?? 0;
  const cleared = ledger.clearedBalance.get(id) ?? 0;
  const since = account.lastReconciledOn ? daysBetween(account.lastReconciledOn, today()) : null;

  return (
    <>
      <Stack.Screen options={{ title: account.name, headerLargeTitleEnabled: false }} />
      <TransactionList
        accountId={id}
        header={
          <View style={{ gap: spacing.lg, marginBottom: spacing.md }}>
            <HeroCard>
              <Text variant="callout" weight="500" tone="textSecondary">
                Balance
              </Text>
              <Money cents={balance} variant="display" tone="auto" />
              <Text variant="callout" tone="textSecondary">
                {cleared !== balance
                  ? `Cleared at the bank: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cleared / 100)}`
                  : since === null
                    ? 'Never checked against the bank'
                    : since === 0
                      ? 'Checked against the bank today'
                      : `Last checked ${since} ${since === 1 ? 'day' : 'days'} ago`}
              </Text>
            </HeroCard>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button
                title="Check balance"
                style={{ flex: 1 }}
                onPress={() => router.push({ pathname: '/reconcile', params: { id } })}
              />
              <Button
                title="Transfer"
                variant="secondary"
                style={{ flex: 1 }}
                onPress={() => router.push({ pathname: '/transfer', params: { from: id } })}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button title="Move up" size="sm" variant="ghost" onPress={() => moveAccount(id, -1)} />
              <Button title="Move down" size="sm" variant="ghost" onPress={() => moveAccount(id, 1)} />
            </View>
            <Text variant="footnote" tone="textSecondary">
              The first account in your list is where quick-add puts transactions unless you name another one.
            </Text>
          </View>
        }
      />
    </>
  );
}
