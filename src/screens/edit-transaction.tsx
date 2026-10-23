import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { DateField } from '@/components/date-field';
import { Field } from '@/components/field';
import { SheetScreen } from '@/components/screen';
import { Text } from '@/components/text';
import { parseMoney } from '@/domain/money';
import { useStore } from '@/store';
import { spacing } from '@/theme';
import { closeSheet } from '@/utils/close-sheet';
import { haptic } from '@/utils/haptics';

export function EditTransaction({ id }: { id: string }) {
  const t = useStore((s) => s.transactions.find((x) => x.id === id));
  const account = useStore((s) => s.accounts.find((a) => a.id === t?.accountId));
  const envelopes = useStore((s) => s.envelopes);
  const update = useStore((s) => s.updateTransaction);
  const remove = useStore((s) => s.deleteTransaction);

  const [payee, setPayee] = useState(t?.payee ?? '');
  const [amountText, setAmountText] = useState(t ? (Math.abs(t.amount) / 100).toFixed(2) : '');
  const [date, setDate] = useState(t?.date ?? '');
  const [envelopeId, setEnvelopeId] = useState(t?.envelopeId);
  const [memo, setMemo] = useState(t?.memo ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!t) {
    return (
      <SheetScreen>
        <Text variant="title">This transaction is gone</Text>
        <Button title="Close" variant="secondary" onPress={() => closeSheet()} />
      </SheetScreen>
    );
  }

  const amount = parseMoney(amountText);
  const canPickEnvelope = t.kind === 'spend' || t.kind === 'slip';
  const spendable = envelopes.filter((e) => !e.hidden && !e.debtAccountId);
  const title =
    t.kind === 'slip'
      ? 'Card slip'
      : t.kind === 'income'
        ? 'Income'
        : t.kind === 'transfer'
          ? 'Transfer'
          : t.kind === 'interest'
            ? 'Interest'
            : t.kind === 'adjustment'
              ? 'Adjustment'
              : 'Expense';

  return (
    <SheetScreen>
      <View style={{ gap: spacing.xs }}>
        <Text variant="title" tone={t.kind === 'slip' ? 'negative' : 'text'}>
          {title}
        </Text>
        <Text variant="callout" tone="textSecondary">
          {account?.name}
          {t.cleared ? ' · Cleared at the bank' : ''}
        </Text>
      </View>
      <Field label="Payee" value={payee} onChangeText={setPayee} />
      <Field label="Amount" value={amountText} onChangeText={setAmountText} keyboardType="decimal-pad" inputMode="decimal" />
      <DateField label="Date" value={date} onChange={setDate} />
      {canPickEnvelope && (
        <View style={{ gap: spacing.sm }}>
          <Text variant="footnote" weight="500" tone="textSecondary" style={{ paddingHorizontal: spacing.xs }}>
            Envelope
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {spendable.map((e) => (
              <Chip key={e.id} label={e.name} selected={e.id === envelopeId} onPress={() => setEnvelopeId(e.id)} />
            ))}
          </View>
        </View>
      )}
      <Field label="Note" value={memo} onChangeText={setMemo} placeholder="Optional" />
      <Button
        title="Save"
        size="lg"
        disabled={!amount || !payee.trim()}
        onPress={() => {
          update(id, { payee: payee.trim(), amount: amount ?? undefined, date, envelopeId, memo: memo.trim() || undefined });
          haptic('success');
          closeSheet();
        }}
      />
      <Button
        title={confirmDelete ? 'Tap again to delete' : 'Delete transaction'}
        variant="destructive"
        onPress={() => {
          if (!confirmDelete) return setConfirmDelete(true);
          remove(id);
          closeSheet();
        }}
      />
    </SheetScreen>
  );
}
