import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/text';
import { useToast } from '@/components/toast';
import { formatShortDate, today } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import { formatMonth, monthOf } from '@/domain/months';
import { canReconcile, reconciledBalance } from '@/domain/reconcile';
import { isDebtAccount, type Transaction } from '@/domain/types';
import { useLedger } from '@/hooks/use-ledger';
import { DebtHeader } from '@/screens/debt-detail';
import { newestFirst } from '@/screens/transactions';
import { useStore } from '@/store';
import { spacing, useColors } from '@/theme';

import { MonthDivider, RegisterHeader, RegisterRow } from './register';
import { DButton, DCard, DPage, PageTitle, Spacer } from './ui';

/** Rows drawn at first; more load on request so a long history opens quickly. */
const PAGE = 150;

/**
 * One account's register on a computer: every transaction by month on the left, the
 * balance and reconcile status on the right (with the payoff plan and details for a
 * debt). Reconcile checks rows off right in the table.
 */
export function DesktopAccount({ id }: { id: string }) {
  const colors = useColors();
  const ledger = useLedger();
  const account = useStore((s) => s.accounts.find((a) => a.id === id));
  const accounts = useStore((s) => s.accounts);
  const transactions = useStore((s) => s.transactions);
  const envelopes = useStore((s) => s.envelopes);
  const reconcileTransactions = useStore((s) => s.reconcileTransactions);
  const moveAccount = useStore((s) => s.moveAccount);
  const showToast = useToast((s) => s.show);
  const [reconciling, setReconciling] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showLocked, setShowLocked] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  const envelopeById = useMemo(() => new Map(envelopes.map((e) => [e.id, e])), [envelopes]);
  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const mine = useMemo(() => transactions.filter((t) => t.accountId === id).sort(newestFirst), [transactions, id]);
  const open = useMemo(() => mine.filter((t) => !t.reconciled), [mine]);
  const locked = useMemo(() => mine.filter((t) => t.reconciled), [mine]);

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
  const balance = ledger.balance.get(id) ?? 0;
  const reconciled = reconciledBalance(account, transactions);
  const picked = open.filter((t) => selected.has(t.id) && canReconcile(t));
  const after = reconciled + picked.reduce((a, t) => a + t.amount, 0);
  const lastLockedDate = locked.length ? locked[0].date : null;
  const rows = reconciling ? (showLocked ? [...open, ...locked] : open) : mine;
  const shown = rows.slice(0, limit);

  function start() {
    const day = today();
    setSelected(new Set(open.filter((t) => t.date <= day && canReconcile(t)).map((t) => t.id)));
    setShowLocked(false);
    setReconciling(true);
  }

  function finish() {
    const ids = picked.map((t) => t.id);
    reconcileTransactions(id, ids);
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

  // A month heading wherever the month changes (not while reconciling: that list is by status).
  const withMonths: ({ kind: 'month'; key: string } | { kind: 'row'; t: Transaction })[] = [];
  let lastMonth = '';
  for (const t of shown) {
    const m = monthOf(t.date);
    if (!reconciling && m !== lastMonth) withMonths.push({ kind: 'month', key: m });
    lastMonth = m;
    withMonths.push({ kind: 'row', t });
  }

  const owed = -balance;
  return (
    <DPage
      title={account.name}
      back={debt ? 'Debt' : 'Home'}
      header={
        <>
          <PageTitle>{account.name}</PageTitle>
          <Text style={{ fontSize: 20, lineHeight: 26, fontWeight: '600', fontVariant: ['tabular-nums'] }} tone={!debt && balance < 0 ? 'negative' : 'textSecondary'}>
            {debt ? `${formatMoney(owed)} owed` : formatMoney(balance)}
          </Text>
          <Spacer />
          {reconciling ? (
            <>
              <DButton label="Cancel" onPress={() => setReconciling(false)} />
              <DButton
                label={picked.length ? `Reconcile ${picked.length}` : 'Mark reconciled'}
                icon={{ sf: 'checkmark', md: 'check' }}
                variant="accent"
                onPress={finish}
              />
            </>
          ) : (
            <>
              {debt ? (
                <DButton label="Make a payment" onPress={() => router.push({ pathname: '/transfer', params: { to: id } })} />
              ) : (
                <>
                  <DButton label="Error adjustment" onPress={() => router.push({ pathname: '/fix-balance', params: { id } })} />
                  <DButton label="Transfer" onPress={() => router.push({ pathname: '/transfer', params: { from: id } })} />
                </>
              )}
              <DButton label="Edit account" onPress={() => router.push({ pathname: '/edit-account', params: { id } })} />
              <DButton label="Reconcile" icon={{ sf: 'checkmark', md: 'check' }} variant="accent" onPress={start} />
            </>
          )}
        </>
      }
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 20 }}>
        <View style={{ flexGrow: 999, flexShrink: 1, flexBasis: 640, minWidth: 0, overflow: 'hidden' }}>
          <DCard style={{ minWidth: 640 }}>
            <RegisterHeader columns={{ account: false, check: true }} />
            {withMonths.length === 0 ? (
              <Text variant="callout" tone="textSecondary" style={{ padding: 16 }}>
                {reconciling ? 'Everything here is already reconciled.' : 'No transactions in this account yet.'}
              </Text>
            ) : (
              withMonths.map((item) =>
                item.kind === 'month' ? (
                  <MonthDivider key={item.key} label={formatMonth(item.key)} />
                ) : (
                  <RegisterRow
                    key={item.t.id}
                    t={item.t}
                    columns={{ account: false, check: true }}
                    account={account}
                    other={item.t.transferAccountId ? accountById.get(item.t.transferAccountId) : undefined}
                    envelope={item.t.envelopeId ? envelopeById.get(item.t.envelopeId) : undefined}
                    select={
                      reconciling && !item.t.reconciled
                        ? {
                            selected: selected.has(item.t.id) && canReconcile(item.t),
                            disabled: !canReconcile(item.t),
                            onToggle: () => toggle(item.t.id),
                          }
                        : undefined
                    }
                  />
                ),
              )
            )}
            {rows.length > shown.length && (
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
                  Show older ({rows.length - shown.length} more)
                </Text>
              </Pressable>
            )}
          </DCard>
        </View>

        <View style={{ flexGrow: 1, flexShrink: 0, flexBasis: 320, maxWidth: 400, gap: 14 }}>
          <DCard padded>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ gap: 2 }}>
                <Text variant="footnote" tone="textSecondary">
                  {debt ? 'Owed in the app' : 'In the app'}
                </Text>
                <Text
                  style={{ fontSize: 20, lineHeight: 26, fontWeight: '700', fontVariant: ['tabular-nums'] }}
                  tone={balance < 0 && !debt ? 'negative' : 'text'}
                >
                  {formatMoney(debt ? -balance : balance)}
                </Text>
              </View>
              <View style={{ gap: 2, alignItems: 'flex-end' }}>
                <Text variant="footnote" tone="textSecondary">
                  {reconciling ? 'Reconciled after this' : 'Reconciled'}
                </Text>
                <Text
                  style={{ fontSize: 20, lineHeight: 26, fontWeight: '700', fontVariant: ['tabular-nums'] }}
                  tone={reconciling ? 'accent' : 'text'}
                >
                  {formatMoney((debt ? -1 : 1) * (reconciling ? after : reconciled))}
                </Text>
              </View>
            </View>
            <Text variant="footnote" tone="textSecondary" style={{ borderTopWidth: 1, borderTopColor: colors.separator, paddingTop: 10 }}>
              {reconciling
                ? 'Check off what your bank shows as posted. The number on the right should match your bank.'
                : lastLockedDate
                  ? `Reconciled through ${formatShortDate(lastLockedDate)}. Click Reconcile with your bank open to catch up.`
                  : 'Never reconciled. Click Reconcile with your bank open and check off what’s posted.'}
            </Text>
            {reconciling && (
              <View style={{ gap: spacing.sm }}>
                {locked.length > 0 && (
                  <Pressable accessibilityRole="button" onPress={() => setShowLocked((v) => !v)}>
                    <Text variant="callout" weight="600" tone="accent">
                      {showLocked ? 'Hide' : 'Show'} {locked.length} already reconciled
                    </Text>
                  </Pressable>
                )}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    const ids = picked.map((t) => t.id).join(',');
                    setReconciling(false);
                    router.push({ pathname: '/reconcile', params: { id, ids } });
                  }}
                >
                  <Text variant="callout" weight="600" tone="accent">
                    Bank shows a different balance? Add an adjustment
                  </Text>
                </Pressable>
              </View>
            )}
          </DCard>

          {debt && !reconciling && <DebtHeader id={id} activityTitle={false} />}

          {!reconciling && (
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
          )}
        </View>
      </View>
    </DPage>
  );
}
