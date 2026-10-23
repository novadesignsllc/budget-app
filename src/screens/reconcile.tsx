import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Field } from '@/components/field';
import { Money } from '@/components/money';
import { SheetScreen } from '@/components/screen';
import { Text } from '@/components/text';
import { useToast } from '@/components/toast';
import { formatMoney, parseMoney } from '@/domain/money';
import { canReconcile, reconciledBalance } from '@/domain/reconcile';
import { SheetHeader } from '@/components/sheet-header';
import { useStore } from '@/store';
import { spacing, useColors } from '@/theme';
import { closeSheet } from '@/utils/close-sheet';
import { haptic } from '@/utils/haptics';

function SummaryRow({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  const colors = useColors();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        height: 40,
        paddingHorizontal: spacing.md,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.hairline,
      }}
    >
      <Text variant="body" tone="textSecondary" style={{ flex: 1 }}>
        {label}
      </Text>
      {children}
    </View>
  );
}

/**
 * The last step of reconciling, when the bank still shows a different number after
 * everything posted is checked off: post the difference as an adjustment.
 * `ids` are transactions checked off on the account screen; they're locked on save too.
 */
export function Reconcile({ id, ids }: { id: string; ids: string[] }) {
  const account = useStore((s) => s.accounts.find((a) => a.id === id));
  const transactions = useStore((s) => s.transactions);
  const reconcileTransactions = useStore((s) => s.reconcileTransactions);
  const addAdjustment = useStore((s) => s.addAdjustment);
  const showToast = useToast((s) => s.show);
  const [bankText, setBankText] = useState('');

  if (!account) {
    return (
      <SheetScreen>
        <SheetHeader title="Adjustment" />
        <Card padded>
          <Text variant="callout" tone="textSecondary">
            This account doesn’t exist anymore.
          </Text>
        </Card>
      </SheetScreen>
    );
  }

  const picked = transactions.filter(
    (t) => ids.includes(t.id) && t.accountId === id && !t.reconciled && canReconcile(t),
  );
  const expected = reconciledBalance(account, transactions) + picked.reduce((a, t) => a + t.amount, 0);
  const bank = parseMoney(bankText);
  const diff = bank === null ? null : bank - expected;

  function save() {
    if (bank === null || diff === null) return;
    reconcileTransactions(
      id,
      picked.map((t) => t.id),
    );
    if (diff !== 0) addAdjustment(id, diff);
    haptic('success');
    showToast({
      message:
        diff === 0
          ? `${account!.name} is reconciled.`
          : `Added a ${formatMoney(diff, { signed: true })} adjustment. ${account!.name} matches your bank.`,
    });
    closeSheet();
  }

  return (
    <SheetScreen>
      <SheetHeader title="Bank shows something else" />

      <Field
        label="Balance in your bank app"
        value={bankText}
        onChangeText={setBankText}
        placeholder={(expected / 100).toFixed(2)}
        keyboardType="numbers-and-punctuation"
        inputMode="decimal"
        autoFocus
      />

      <Card>
        <SummaryRow label={picked.length ? `Reconciled, with ${picked.length} checked off` : 'Reconciled in the app'}>
          <Money cents={expected} weight="500" />
        </SummaryRow>
        <SummaryRow label="Difference" last>
          {diff === null ? (
            <Text variant="body" tone="textTertiary">
              Enter the bank balance
            </Text>
          ) : (
            <Money cents={diff} weight="600" signed={diff !== 0} tone={diff === 0 ? 'positive' : 'auto'} />
          )}
        </SummaryRow>
      </Card>


      <Button
        title={
          diff === null
            ? 'Enter the bank balance'
            : diff === 0
              ? 'Mark reconciled'
              : `Post ${formatMoney(diff, { signed: true })} adjustment`
        }
        size="lg"
        disabled={bank === null}
        onPress={save}
      />
    </SheetScreen>
  );
}
