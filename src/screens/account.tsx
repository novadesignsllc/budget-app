import { router } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Pressable, View } from 'react-native';

import { Card } from '@/components/card';
import { useDock } from '@/components/dock';
import { Money } from '@/components/money';
import { ActionButton, ScreenActions } from '@/components/screen-actions';
import { ScreenTitle } from '@/components/screen-title';
import { Text } from '@/components/text';
import { useToast } from '@/components/toast';
import { TransactionRow, TXN_COLUMNS } from '@/components/transaction-row';
import { formatMoney } from '@/domain/money';
import { canReconcile, reconciledBalance } from '@/domain/reconcile';
import { useLedger } from '@/hooks/use-ledger';
import { isDebtAccount, type Transaction } from '@/domain/types';
import { newestFirst, TableCardRow, TableCardTop } from '@/screens/transactions';
import { useStore } from '@/store';
import { gutter, maxContentWidth, spacing } from '@/theme';
import { haptic } from '@/utils/haptics';

const SINGLE_COLUMNS = [
  { label: 'Date', width: TXN_COLUMNS.date },
  { label: '', width: TXN_COLUMNS.emoji },
  { label: 'Payee' },
  { label: 'Amount', width: TXN_COLUMNS.amount, align: 'right' as const },
  // The status column; rows pad less on the right, so this lines Amount up.
  { label: ' ', width: TXN_COLUMNS.status - spacing.sm },
];

/** What the bank says this account holds, when it's linked: in Slip's sign (debts negative). */
export function useBankBalance(accountId: string) {
  const links = useStore((s) => s.bankLinks);
  for (const l of links) {
    const a = l.accounts.find((x) => x.accountId === accountId);
    if (a) return { balance: a.balance, institution: l.institution, syncedAt: l.syncedAt };
  }
  return null;
}

/** Opening balance plus everything posted or reconciled: what the bank should show as posted. */
export function postedBalance(account: { id: string; openingBalance: number }, transactions: Transaction[]): number {
  return transactions
    .filter((t) => t.accountId === account.id && (t.cleared || t.reconciled))
    .reduce((a, t) => a + t.amount, account.openingBalance);
}

/**
 * Reconciling locks every posted transaction (checked in the status column) in one go.
 * When the bank is linked and its posted balance disagrees, the toast offers to adjust
 * instead of Undo.
 */
export function useReconcilePosted(accountId: string) {
  const transactions = useStore((s) => s.transactions);
  const reconcileTransactions = useStore((s) => s.reconcileTransactions);
  const unreconcile = useStore((s) => s.unreconcile);
  const addAdjustment = useStore((s) => s.addAdjustment);
  const showToast = useToast((s) => s.show);
  const bank = useBankBalance(accountId);
  const ready = useMemo(
    () => transactions.filter((t) => t.accountId === accountId && t.cleared && !t.reconciled && canReconcile(t)),
    [transactions, accountId],
  );
  function reconcile() {
    const ids = ready.map((t) => t.id);
    if (!ids.length) return;
    reconcileTransactions(accountId, ids);
    haptic('success');
    const account = useStore.getState().accounts.find((a) => a.id === accountId);
    const off =
      account && bank?.balance !== undefined ? bank.balance - postedBalance(account, useStore.getState().transactions) : 0;
    const count = `Reconciled ${ids.length} ${ids.length === 1 ? 'transaction' : 'transactions'}`;
    if (off !== 0) {
      showToast({
        message: `${count}. ${formatMoney(Math.abs(off))} off from the bank.`,
        actionLabel: 'Adjust',
        onAction: () => addAdjustment(accountId, off),
      });
    } else {
      showToast({ message: `${count}.`, actionLabel: 'Undo', onAction: () => unreconcile(ids) });
    }
  }
  return { ready, reconcile };
}

/**
 * One account's register. The last column is each transaction's status: a dash while it's
 * pending, a green check once it's posted at the bank (bank sync sets these, and a tap
 * switches them), a lock once reconciled. Reconcile locks everything checked. Debts use
 * the same page with their own cards on top (`header`).
 */
export function AccountDetail({ id, header }: { id: string; header?: React.ReactNode }) {
  const { contentBottom } = useDock();
  const ledger = useLedger();
  const account = useStore((s) => s.accounts.find((a) => a.id === id));
  const transactions = useStore((s) => s.transactions);
  const envelopes = useStore((s) => s.envelopes);
  const updateTransaction = useStore((s) => s.updateTransaction);
  const moveAccount = useStore((s) => s.moveAccount);
  const bank = useBankBalance(id);
  const { ready, reconcile } = useReconcilePosted(id);

  const envelopeById = useMemo(() => new Map(envelopes.map((e) => [e.id, e])), [envelopes]);
  const mine = useMemo(() => transactions.filter((t) => t.accountId === id).sort(newestFirst), [transactions, id]);

  if (!account) {
    return (
      <View style={{ padding: gutter }}>
        <ScreenTitle title="Account" />
        <Card padded>
          <Text variant="callout" tone="textSecondary">
            This account doesn’t exist anymore.
          </Text>
        </Card>
      </View>
    );
  }

  const debt = isDebtAccount(account);
  const sign = debt ? -1 : 1;
  const balance = ledger.balance.get(id) ?? 0;
  const posted = postedBalance(account, transactions);
  const off = bank?.balance !== undefined ? bank.balance - posted : null;

  const stat = (label: string, cents: number, under?: React.ReactNode) => (
    <View style={{ flex: 1, gap: 1 }}>
      <Text variant="footnote" tone="textSecondary" numberOfLines={1}>
        {label}
      </Text>
      <Money cents={cents} variant="section" weight="700" tone="auto" />
      {under}
    </View>
  );

  const summary = (
    <Card padded>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {stat(debt ? 'Owed' : 'Balance', sign * balance)}
        {stat('Posted', sign * posted)}
        {bank?.balance !== undefined
          ? stat(
              debt ? 'Owed at the bank' : 'At the bank',
              sign * bank.balance,
              <Text variant="caption" weight="600" tone={off === 0 ? 'positive' : 'orange'}>
                {off === 0 ? 'Matches' : `Off by ${formatMoney(Math.abs(off ?? 0))}`}
              </Text>,
            )
          : stat('Reconciled', sign * reconciledBalance(account, transactions))}
      </View>
    </Card>
  );

  const footer = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md - 2, paddingHorizontal: 6 }}>
      <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.push({ pathname: '/edit-account', params: { id } })}>
        <Text variant="footnote" weight="600" tone="accent">
          Edit
        </Text>
      </Pressable>
      {!bank && (
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => router.push({ pathname: '/reconcile', params: { id, ids: ready.map((t) => t.id).join(',') } })}
        >
          <Text variant="footnote" weight="600" tone="accent">
            Bank shows something else
          </Text>
        </Pressable>
      )}
      <View style={{ flex: 1 }} />
      <Pressable accessibilityRole="button" hitSlop={8} onPress={() => moveAccount(id, -1)}>
        <Text variant="footnote" weight="600" tone="accent">
          Move up
        </Text>
      </Pressable>
      <Pressable accessibilityRole="button" hitSlop={8} onPress={() => moveAccount(id, 1)}>
        <Text variant="footnote" weight="600" tone="accent">
          Move down
        </Text>
      </Pressable>
    </View>
  );

  return (
    <>
      <ScreenTitle title={account.name} />
      <FlatList
        data={mine}
        keyExtractor={(t) => t.id}
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        initialNumToRender={20}
        contentContainerStyle={{
          paddingHorizontal: gutter,
          paddingTop: spacing.xs,
          paddingBottom: contentBottom,
          width: '100%',
          maxWidth: maxContentWidth,
          alignSelf: 'center',
        }}
        ListHeaderComponent={
          <View style={{ gap: spacing.md - 2 }}>
            {header}
            {summary}
            {mine.length > 0 && <TableCardTop columns={SINGLE_COLUMNS} />}
          </View>
        }
        ListEmptyComponent={
          <Card padded style={{ marginTop: spacing.md - 2 }}>
            <Text variant="callout" tone="textSecondary">
              No transactions in this account yet.
            </Text>
          </Card>
        }
        ListFooterComponent={footer}
        renderItem={({ item, index }) => {
          const last = index === mine.length - 1;
          return (
            <TableCardRow last={last}>
              <TransactionRow
                t={item}
                envelope={item.envelopeId ? envelopeById.get(item.envelopeId) : undefined}
                account={account}
                columns="single"
                last={last}
                status={() => updateTransaction(item.id, { cleared: !item.cleared })}
              />
            </TableCardRow>
          );
        }}
      />
      <ScreenActions>
        {debt ? (
          <ActionButton label="Make a payment" onPress={() => router.push({ pathname: '/transfer', params: { to: id } })} />
        ) : (
          <>
            <ActionButton label="Error adjustment" onPress={() => router.push({ pathname: '/fix-balance', params: { id } })} />
            <ActionButton label="Transfer" onPress={() => router.push({ pathname: '/transfer', params: { from: id } })} />
          </>
        )}
        <ActionButton
          icon={{ sf: 'lock.fill', md: 'lock' }}
          label={ready.length ? `Reconcile ${ready.length}` : 'Reconcile'}
          variant="accent"
          disabled={!ready.length}
          onPress={reconcile}
        />
      </ScreenActions>
    </>
  );
}
