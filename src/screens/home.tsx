import { Link, router } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { HeroCard } from '@/components/hero-card';
import { Row, Section } from '@/components/list';
import { Money } from '@/components/money';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { TransactionRow } from '@/components/transaction-row';
import { daysBetween, formatDay, today } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import { dueForApproval } from '@/domain/recurring';
import { isCashAccount } from '@/domain/types';
import { useAccounts, useLedger } from '@/hooks/use-ledger';
import { useStore } from '@/store';
import { loadSampleData } from '@/store/sample-data';
import { spacing } from '@/theme';
import { haptic } from '@/utils/haptics';

const RECONCILE_EVERY_DAYS = 7;

export function Home() {
  const ledger = useLedger();
  const { cash, debts, all } = useAccounts();
  const envelopes = useStore((s) => s.envelopes);
  const transactions = useStore((s) => s.transactions);
  const recurring = useStore((s) => s.recurring);
  const approve = useStore((s) => s.approveRecurring);
  const skip = useStore((s) => s.skipRecurring);

  const day = today();
  const due = dueForApproval(recurring, day);
  const recent = useMemo(
    () =>
      [...transactions]
        .filter((t) => !(t.kind === 'transfer' && t.amount > 0 && t.transferPairId))
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
        .slice(0, 5),
    [transactions],
  );
  const overspent = envelopes.filter((e) => (ledger.available.get(e.id) ?? 0) < 0 && !e.debtAccountId);
  const accountById = new Map(all.map((a) => [a.id, a]));
  const envelopeById = new Map(envelopes.map((e) => [e.id, e]));

  if (all.length === 0) {
    return (
      <Screen>
        <EmptyState
          title="Start with your checking account"
          body="Add the account your debit card uses and type in today's balance from your bank app. Every dollar in it becomes money you can give a job."
          action={<Button title="Add account" onPress={() => router.push('/new-account')} />}
        />
        {__DEV__ && <Button title="Load sample data" variant="ghost" onPress={loadSampleData} />}
      </Screen>
    );
  }

  const rta = ledger.readyToAssign;

  return (
    <Screen>
      <HeroCard>
        <Text variant="callout" weight="500" tone="textSecondary">
          Ready to assign
        </Text>
        <Money cents={rta} variant="display" tone={rta < 0 ? 'negative' : 'text'} />
        <Text variant="callout" tone={rta < 0 ? 'negative' : 'textSecondary'}>
          {rta > 0
            ? `Give it a job before you spend it. ${formatMoney(ledger.cashTotal)} in cash total.`
            : rta === 0
              ? `All ${formatMoney(ledger.cashTotal)} has a job.`
              : `You've assigned ${formatMoney(-rta)} more than you have. Pull it back from an envelope.`}
        </Text>
        {rta !== 0 && (
          <View style={{ flexDirection: 'row', marginTop: spacing.xs }}>
            <Button
              title={rta > 0 ? 'Assign money' : 'Fix in Budget'}
              size="sm"
              onPress={() => router.navigate('/budget')}
            />
          </View>
        )}
      </HeroCard>

      {overspent.length > 0 && (
        <Section title="Overspent">
          {overspent.map((e) => (
            <Row
              key={e.id}
              href={`/envelope/${e.id}`}
              title={e.name}
              subtitle="Cover it from another envelope"
              titleTone="negative"
              trailing={<Money cents={ledger.available.get(e.id) ?? 0} tone="negative" weight="500" />}
              chevron
            />
          ))}
        </Section>
      )}

      {due.length > 0 && (
        <Section title="To approve" footer="Approving adds the transaction. Tap it later to change the amount.">
          {due.map((r) => {
            const account = accountById.get(r.accountId);
            const onCard = account && !isCashAccount(account);
            return (
              <View key={r.id} style={{ padding: spacing.lg, gap: spacing.md }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
                  <View style={{ flex: 1, gap: spacing.xxs }}>
                    <Text variant="body" tone={onCard ? 'negative' : 'text'} numberOfLines={1}>
                      {r.name}
                    </Text>
                    <Text variant="footnote" tone="textSecondary" numberOfLines={1}>
                      {[formatDay(r.nextDue), account?.name, onCard ? 'Card slip' : null].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <Money cents={-r.amount} weight="500" tone={onCard ? 'negative' : 'text'} />
                </View>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <Button
                    title="Approve"
                    size="sm"
                    onPress={() => {
                      approve(r.id);
                      haptic('success');
                    }}
                  />
                  <Button title="Skip this time" size="sm" variant="secondary" onPress={() => skip(r.id)} />
                </View>
              </View>
            );
          })}
        </Section>
      )}

      <Section
        title="Accounts"
        action={
          <Link href="/new-account">
            <Text variant="callout" tone="accent" weight="500">
              Add
            </Text>
          </Link>
        }
      >
        {cash.map((a) => {
          const since = a.lastReconciledOn ? daysBetween(a.lastReconciledOn, day) : null;
          const stale = since === null || since >= RECONCILE_EVERY_DAYS;
          return (
            <Row
              key={a.id}
              href={`/account/${a.id}`}
              title={a.name}
              subtitle={
                since === null
                  ? 'Never checked against the bank'
                  : stale
                    ? `Time to check against the bank`
                    : since === 0
                      ? 'Checked against the bank today'
                      : `Checked ${since} ${since === 1 ? 'day' : 'days'} ago`
              }
              trailing={<Money cents={ledger.balance.get(a.id) ?? 0} tone="auto" weight="500" />}
              chevron
            />
          );
        })}
        {debts.length > 0 && (
          <Row
            href="/debt"
            title="Debt"
            subtitle={`${debts.length} ${debts.length === 1 ? 'account' : 'accounts'}`}
            trailing={<Money cents={ledger.debtTotal} weight="500" tone="textSecondary" />}
            chevron
          />
        )}
      </Section>

      {recent.length > 0 && (
        <Section
          title="Recent"
          action={
            <Link href="/transactions">
              <Text variant="callout" tone="accent" weight="500">
                See all
              </Text>
            </Link>
          }
        >
          {recent.map((t) => (
            <TransactionRow
              key={t.id}
              t={t}
              account={accountById.get(t.accountId)}
              envelope={t.envelopeId ? envelopeById.get(t.envelopeId) : undefined}
            />
          ))}
        </Section>
      )}
    </Screen>
  );
}
