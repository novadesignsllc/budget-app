import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';

import { Card } from '@/components/card';
import { useDock } from '@/components/dock';
import { Icon } from '@/components/icon';
import { Money } from '@/components/money';
import { ActionButton, ScreenActions } from '@/components/screen-actions';
import { ScreenTitle } from '@/components/screen-title';
import { Text } from '@/components/text';
import { useToast } from '@/components/toast';
import { TransactionRow, TXN_COLUMNS } from '@/components/transaction-row';
import { formatShortDate, today } from '@/domain/dates';
import { canReconcile, reconciledBalance } from '@/domain/reconcile';
import { useLedger } from '@/hooks/use-ledger';
import { isDebtAccount } from '@/domain/types';
import { newestFirst, TableCardRow, TableCardTop } from '@/screens/transactions';
import { useStore } from '@/store';
import { gutter, maxContentWidth, spacing, useColors } from '@/theme';
import { haptic } from '@/utils/haptics';

const SINGLE_COLUMNS = [
  { label: 'Date', width: TXN_COLUMNS.date },
  { label: '', width: TXN_COLUMNS.emoji },
  { label: 'Payee' },
  { label: 'Amount', width: TXN_COLUMNS.amount, align: 'right' as const },
];

/**
 * One account's register. Reconciling happens here: tap Reconcile, check off what the
 * bank shows as posted, tap again, and those transactions are marked reconciled. Debts
 * use the same page with their own cards on top (`header`).
 */
export function AccountDetail({ id, header }: { id: string; header?: React.ReactNode }) {
  const colors = useColors();
  const { contentBottom } = useDock();
  const ledger = useLedger();
  const account = useStore((s) => s.accounts.find((a) => a.id === id));
  const transactions = useStore((s) => s.transactions);
  const envelopes = useStore((s) => s.envelopes);
  const reconcileTransactions = useStore((s) => s.reconcileTransactions);
  const moveAccount = useStore((s) => s.moveAccount);
  const showToast = useToast((s) => s.show);

  const [reconciling, setReconciling] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showLocked, setShowLocked] = useState(false);

  const envelopeById = useMemo(() => new Map(envelopes.map((e) => [e.id, e])), [envelopes]);
  const mine = useMemo(() => transactions.filter((t) => t.accountId === id).sort(newestFirst), [transactions, id]);
  const open = useMemo(() => mine.filter((t) => !t.reconciled), [mine]);
  const locked = useMemo(() => mine.filter((t) => t.reconciled), [mine]);

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

  const balance = ledger.balance.get(id) ?? 0;
  const reconciled = reconciledBalance(account, transactions);
  const picked = open.filter((t) => selected.has(t.id) && canReconcile(t));
  const after = reconciled + picked.reduce((a, t) => a + t.amount, 0);
  const lastLockedDate = locked.length ? locked[0].date : null;
  const rows = reconciling ? (showLocked ? [...open, ...locked] : open) : mine;
  const debt = isDebtAccount(account);

  function start() {
    const day = today();
    setSelected(new Set(open.filter((t) => t.date <= day && canReconcile(t)).map((t) => t.id)));
    setShowLocked(false);
    setReconciling(true);
  }

  function finish() {
    const ids = picked.map((t) => t.id);
    reconcileTransactions(id, ids);
    haptic('success');
    showToast({
      message: ids.length
        ? `Reconciled ${ids.length} ${ids.length === 1 ? 'transaction' : 'transactions'}.`
        : `${account!.name} is reconciled.`,
    });
    setReconciling(false);
  }

  function toggle(txnId: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(txnId)) next.delete(txnId);
      else next.add(txnId);
      return next;
    });
  }

  const summary = (
    <Card padded style={{ gap: spacing.md - 2 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <View style={{ gap: 1 }}>
          <Text variant="footnote" tone="textSecondary">
            In the app
          </Text>
          <Money cents={balance} variant="title" weight="600" tone="auto" />
        </View>
        <View style={{ gap: 1, alignItems: 'flex-end' }}>
          <Text variant="footnote" tone="textSecondary">
            {reconciling ? 'Reconciled after this' : 'Reconciled'}
          </Text>
          <Money
            cents={reconciling ? after : reconciled}
            variant="title"
            weight="600"
            tone={reconciling ? 'accent' : 'auto'}
          />
        </View>
      </View>
      <Text
        variant="footnote"
        tone="textSecondary"
        style={{
          borderTopWidth: 1,
          borderTopColor: colors.separator,
          paddingTop: 9,
        }}
      >
        {reconciling
          ? 'Check off what your bank shows as posted. The number on the right should match your bank app.'
          : lastLockedDate
            ? `Reconciled through ${formatShortDate(lastLockedDate)}. Tap Reconcile with your bank app open to catch up.`
            : 'Never reconciled. Tap Reconcile with your bank app open and check off what’s posted.'}
      </Text>
    </Card>
  );

  const footer = (
    <View style={{ gap: spacing.md, marginTop: spacing.md - 2 }}>
      {reconciling && locked.length > 0 && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            paddingHorizontal: 6,
          }}
        >
          <Icon sf="checkmark" md="check" size={11} color={colors.textTertiary} />
          <Text variant="footnote" tone="textSecondary" style={{ flex: 1 }}>
            {locked.length} reconciled through {formatShortDate(lastLockedDate!)}
          </Text>
          <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setShowLocked((v) => !v)}>
            <Text variant="footnote" weight="600" tone="accent">
              {showLocked ? 'Hide' : 'Show'}
            </Text>
          </Pressable>
        </View>
      )}
      {reconciling && (
        <Pressable
          accessibilityRole="button"
          hitSlop={6}
          onPress={() => {
            const ids = picked.map((t) => t.id).join(',');
            setReconciling(false);
            router.push({ pathname: '/reconcile', params: { id, ids } });
          }}
          style={{ paddingHorizontal: 6 }}
        >
          <Text variant="footnote" weight="600" tone="accent">
            Add an adjustment
          </Text>
        </Pressable>
      )}
      {!reconciling && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            paddingHorizontal: 6,
          }}
        >
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => router.push({ pathname: '/edit-account', params: { id } })}
          >
            <Text variant="footnote" weight="600" tone="accent">
              Edit
            </Text>
          </Pressable>
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
      )}
    </View>
  );

  return (
    <>
      <ScreenTitle title={account.name} />
      <FlatList
        data={rows}
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
            {header && !reconciling ? header : summary}
            {rows.length > 0 && <TableCardTop columns={SINGLE_COLUMNS} leading={reconciling ? TXN_COLUMNS.check : 0} />}
          </View>
        }
        ListEmptyComponent={
          <Card padded style={{ marginTop: spacing.md - 2 }}>
            <Text variant="callout" tone="textSecondary">
              {reconciling ? 'Everything here is already reconciled.' : 'No transactions in this account yet.'}
            </Text>
          </Card>
        }
        ListFooterComponent={footer}
        renderItem={({ item, index }) => {
          const last = index === rows.length - 1;
          const selectable = reconciling && !item.reconciled;
          return (
            <TableCardRow last={last}>
              <TransactionRow
                t={item}
                envelope={item.envelopeId ? envelopeById.get(item.envelopeId) : undefined}
                account={account}
                columns="single"
                last={last}
                select={
                  selectable
                    ? {
                        selected: selected.has(item.id) && canReconcile(item),
                        disabled: !canReconcile(item),
                        onToggle: () => toggle(item.id),
                      }
                    : undefined
                }
              />
            </TableCardRow>
          );
        }}
      />
      <ScreenActions>
        {reconciling ? (
          <>
            <ActionButton label="Cancel" onPress={() => setReconciling(false)} />
            <ActionButton
              icon={{ sf: 'checkmark', md: 'check' }}
              label={picked.length ? `Reconcile ${picked.length}` : 'Mark reconciled'}
              variant="accent"
              onPress={finish}
            />
          </>
        ) : (
          <>
            {debt ? (
              <ActionButton label="Make a payment" onPress={() => router.push({ pathname: '/transfer', params: { to: id } })} />
            ) : (
              <>
                <ActionButton
                  label="Error adjustment"
                  onPress={() => router.push({ pathname: '/fix-balance', params: { id } })}
                />
                <ActionButton
                  label="Transfer"
                  onPress={() => router.push({ pathname: '/transfer', params: { from: id } })}
                />
              </>
            )}
            <ActionButton icon={{ sf: 'checkmark', md: 'check' }} label="Reconcile" variant="accent" onPress={start} />
          </>
        )}
      </ScreenActions>
    </>
  );
}
