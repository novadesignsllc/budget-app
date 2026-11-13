import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/text';
import { formatMoney } from '@/domain/money';
import { formatMonth, monthOf } from '@/domain/months';
import { reconciledBalance } from '@/domain/reconcile';
import { isDebtAccount, type Transaction } from '@/domain/types';
import { syncedLabel } from '@/hooks/use-bank';
import { useLedger } from '@/hooks/use-ledger';
import { DebtHeader } from '@/screens/debt-detail';
import { postedBalance, useBankBalance, useReconcilePosted } from '@/screens/account';
import { newestFirst } from '@/screens/transactions';
import { useStore } from '@/store';
import { spacing, useColors } from '@/theme';

import { MonthDivider, RegisterHeader, RegisterRow } from './register';
import { DButton, DCard, DPage, PageTitle, Spacer } from './ui';

/** Rows drawn at first; more load on request so a long history opens quickly. */
const PAGE = 150;

/**
 * One account's register on a computer: every transaction by month on the left, with
 * its status in the last column (pending, posted, reconciled); the balances on the right
 * (with the payoff plan and details for a debt). Reconcile locks everything posted.
 */
export function DesktopAccount({ id }: { id: string }) {
  const colors = useColors();
  const ledger = useLedger();
  const account = useStore((s) => s.accounts.find((a) => a.id === id));
  const accounts = useStore((s) => s.accounts);
  const transactions = useStore((s) => s.transactions);
  const envelopes = useStore((s) => s.envelopes);
  const updateTransaction = useStore((s) => s.updateTransaction);
  const moveAccount = useStore((s) => s.moveAccount);
  const bank = useBankBalance(id);
  const { ready, reconcile } = useReconcilePosted(id);
  const [limit, setLimit] = useState(PAGE);

  const envelopeById = useMemo(() => new Map(envelopes.map((e) => [e.id, e])), [envelopes]);
  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const mine = useMemo(() => transactions.filter((t) => t.accountId === id).sort(newestFirst), [transactions, id]);

  if (!account) {
    return (
      <DPage title="Account" back="Home" header={<PageTitle>Account</PageTitle>}>
        <DCard padded>
          <Text variant="callout" tone="textSecondary">
            This account doesn’t exist anymore.
          </Text>
        </DCard>
      </DPage>
    );
  }

  const debt = isDebtAccount(account);
  const sign = debt ? -1 : 1;
  const balance = ledger.balance.get(id) ?? 0;
  const posted = postedBalance(account, transactions);
  const off = bank?.balance !== undefined ? bank.balance - posted : null;
  const shown = mine.slice(0, limit);
  const columns = { account: false, status: true } as const;

  const withMonths: ({ kind: 'month'; key: string } | { kind: 'row'; t: Transaction })[] = [];
  let lastMonth = '';
  for (const t of shown) {
    const m = monthOf(t.date);
    if (m !== lastMonth) withMonths.push({ kind: 'month', key: m });
    lastMonth = m;
    withMonths.push({ kind: 'row', t });
  }

  const big = { fontSize: 20, lineHeight: 26, fontWeight: '700' as const, fontVariant: ['tabular-nums' as const] };
  const stat = (label: string, cents: number, under?: React.ReactNode) => (
    <View style={{ flex: 1, gap: 2 }}>
      <Text variant="footnote" tone="textSecondary">
        {label}
      </Text>
      <Text style={big} tone={!debt && cents < 0 ? 'negative' : 'text'}>
        {formatMoney(cents)}
      </Text>
      {under}
    </View>
  );

  return (
    <DPage
      title={account.name}
      back={debt ? 'Debt' : 'Home'}
      header={
        <>
          <PageTitle>{account.name}</PageTitle>
          <Text style={{ fontSize: 20, lineHeight: 26, fontWeight: '600', fontVariant: ['tabular-nums'] }} tone={!debt && balance < 0 ? 'negative' : 'textSecondary'}>
            {debt ? `${formatMoney(-balance)} owed` : formatMoney(balance)}
          </Text>
          <Spacer />
          {bank && (
            <Text variant="callout" tone="textSecondary">
              {syncedLabel(bank.syncedAt)}
            </Text>
          )}
          {debt ? (
            <DButton label="Make a payment" onPress={() => router.push({ pathname: '/transfer', params: { to: id } })} />
          ) : (
            <>
              <DButton label="Error adjustment" onPress={() => router.push({ pathname: '/fix-balance', params: { id } })} />
              <DButton label="Transfer" onPress={() => router.push({ pathname: '/transfer', params: { from: id } })} />
            </>
          )}
          <DButton label="Edit account" onPress={() => router.push({ pathname: '/edit-account', params: { id } })} />
          <DButton
            label={ready.length ? `Reconcile ${ready.length}` : 'Reconcile'}
            icon={{ sf: 'lock.fill', md: 'lock' }}
            variant="accent"
            onPress={reconcile}
          />
        </>
      }
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 20 }}>
        <View style={{ flexGrow: 999, flexShrink: 1, flexBasis: 640, minWidth: 0, overflow: 'hidden' }}>
          <DCard style={{ minWidth: 640 }}>
            <RegisterHeader columns={columns} />
            {withMonths.length === 0 ? (
              <Text variant="callout" tone="textSecondary" style={{ padding: 16 }}>
                No transactions in this account yet.
              </Text>
            ) : (
              withMonths.map((item) =>
                item.kind === 'month' ? (
                  <MonthDivider key={item.key} label={formatMonth(item.key)} />
                ) : (
                  <RegisterRow
                    key={item.t.id}
                    t={item.t}
                    columns={columns}
                    account={account}
                    other={item.t.transferAccountId ? accountById.get(item.t.transferAccountId) : undefined}
                    envelope={item.t.envelopeId ? envelopeById.get(item.t.envelopeId) : undefined}
                    status={() => updateTransaction(item.t.id, { cleared: !item.t.cleared })}
                  />
                ),
              )
            )}
            {mine.length > shown.length && (
              <Pressable
                accessibilityRole="button"
                onPress={() => setLimit((l) => l + PAGE)}
                style={({ hovered }: { hovered?: boolean }) => ({
                  padding: 14,
                  alignItems: 'center',
                  borderTopWidth: 1,
                  borderTopColor: colors.separator,
                  backgroundColor: hovered ? colors.control : 'transparent',
                })}
              >
                <Text variant="callout" weight="600" tone="accent">
                  Show older ({mine.length - shown.length} more)
                </Text>
              </Pressable>
            )}
          </DCard>
        </View>

        <View style={{ flexGrow: 1, flexShrink: 0, flexBasis: 320, maxWidth: 400, gap: 14 }}>
          <DCard padded>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              {stat(debt ? 'Owed' : 'Balance', sign * balance)}
              {stat('Posted', sign * posted)}
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.md, borderTopWidth: 1, borderTopColor: colors.separator, paddingTop: 12 }}>
              {bank?.balance !== undefined
                ? stat(
                    debt ? 'Owed at the bank' : 'At the bank',
                    sign * bank.balance,
                    <Text variant="footnote" weight="600" tone={off === 0 ? 'positive' : 'orange'}>
                      {off === 0 ? 'Matches what’s posted' : `Off by ${formatMoney(Math.abs(off ?? 0))}`}
                    </Text>,
                  )
                : stat('Reconciled', sign * reconciledBalance(account, transactions))}
            </View>
            {!bank && (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/reconcile', params: { id, ids: ready.map((t) => t.id).join(',') } })}
              >
                <Text variant="callout" weight="600" tone="accent">
                  Bank shows a different balance? Add an adjustment
                </Text>
              </Pressable>
            )}
          </DCard>

          {debt && <DebtHeader id={id} activityTitle={false} />}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: 4 }}>
            <Text variant="footnote" tone="textSecondary" style={{ flex: 1 }}>
              Order in the sidebar
            </Text>
            <Pressable accessibilityRole="button" onPress={() => moveAccount(id, -1)} hitSlop={6}>
              <Text variant="footnote" weight="600" tone="accent">
                Move up
              </Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => moveAccount(id, 1)} hitSlop={6}>
              <Text variant="footnote" weight="600" tone="accent">
                Move down
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </DPage>
  );
}
