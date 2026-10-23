import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { DateField } from '@/components/date-field';
import { Field } from '@/components/field';
import { SheetScreen } from '@/components/screen';
import { Segmented } from '@/components/segmented';
import { Text } from '@/components/text';
import { today } from '@/domain/dates';
import { parseMoney } from '@/domain/money';
import { FREQUENCY_LABEL } from '@/domain/recurring';
import { isCashAccount, type Frequency, type RecurringKind } from '@/domain/types';
import { useAccounts } from '@/hooks/use-ledger';
import { useStore } from '@/store';
import { spacing } from '@/theme';
import { closeSheet } from '@/utils/close-sheet';
import { haptic } from '@/utils/haptics';

const FREQUENCIES: Frequency[] = ['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'];

export function EditRecurring({ id }: { id?: string }) {
  const existing = useStore((s) => s.recurring.find((r) => r.id === id));
  const envelopes = useStore((s) => s.envelopes);
  const addRecurring = useStore((s) => s.addRecurring);
  const updateRecurring = useStore((s) => s.updateRecurring);
  const deleteRecurring = useStore((s) => s.deleteRecurring);
  const { all: accounts, cash } = useAccounts();

  const [name, setName] = useState(existing?.name ?? '');
  const [kind, setKind] = useState<RecurringKind>(existing?.kind ?? 'bill');
  const [amountText, setAmountText] = useState(existing ? (existing.amount / 100).toFixed(2) : '');
  const [accountId, setAccountId] = useState(existing?.accountId ?? cash[0]?.id);
  const [envelopeId, setEnvelopeId] = useState(existing?.envelopeId);
  const [frequency, setFrequency] = useState<Frequency>(existing?.frequency ?? 'monthly');
  const [nextDue, setNextDue] = useState(existing?.nextDue ?? today());
  const [confirmDelete, setConfirmDelete] = useState(false);

  const amount = parseMoney(amountText);
  const account = accounts.find((a) => a.id === accountId);
  const onCard = !!account && !isCashAccount(account);
  const spendable = envelopes.filter((e) => !e.hidden && !e.debtAccountId);
  const valid = name.trim() && amount && amount > 0 && accountId && envelopeId;

  function save() {
    if (!valid || !amount || !accountId) return;
    const data = { name: name.trim(), kind, amount, accountId, envelopeId, frequency, nextDue };
    if (existing) updateRecurring(existing.id, data);
    else addRecurring(data);
    haptic('success');
    closeSheet();
  }

  return (
    <SheetScreen>
      <Text variant="title">{existing ? existing.name : 'New recurring'}</Text>
      <Segmented
        value={kind}
        onChange={setKind}
        options={[
          { value: 'bill', label: 'Bill' },
          { value: 'subscription', label: 'Subscription' },
        ]}
      />
      <Field label="Name" value={name} onChangeText={setName} placeholder={kind === 'bill' ? 'Electric' : 'Netflix'} />
      <Field
        label={kind === 'bill' ? 'Usual amount' : 'Amount'}
        hint={kind === 'bill' ? 'You confirm the real amount when it comes due.' : undefined}
        value={amountText}
        onChangeText={setAmountText}
        placeholder="0.00"
        keyboardType="decimal-pad"
        inputMode="decimal"
      />

      <View style={{ gap: spacing.sm }}>
        <Text variant="footnote" weight="500" tone="textSecondary" style={{ paddingHorizontal: spacing.xs }}>
          Paid from
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {accounts.map((a) => (
            <Chip
              key={a.id}
              label={a.name}
              selected={a.id === accountId}
              tone={isCashAccount(a) ? 'default' : 'negative'}
              onPress={() => setAccountId(a.id)}
            />
          ))}
        </View>
        {onCard && (
          <Text variant="footnote" tone="negative" style={{ paddingHorizontal: spacing.xs }}>
            Recurring charges on a card are slips every time. Move this to a bank account when you can.
          </Text>
        )}
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text variant="footnote" weight="500" tone="textSecondary" style={{ paddingHorizontal: spacing.xs }}>
          Envelope
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {spendable.map((e) => (
            <Chip key={e.id} label={e.name} selected={e.id === envelopeId} onPress={() => setEnvelopeId(e.id)} />
          ))}
          {spendable.length === 0 && (
            <Text variant="callout" tone="textSecondary">
              Make envelopes on the Budget tab first.
            </Text>
          )}
        </View>
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text variant="footnote" weight="500" tone="textSecondary" style={{ paddingHorizontal: spacing.xs }}>
          How often
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {FREQUENCIES.map((f) => (
            <Chip key={f} label={FREQUENCY_LABEL[f]} selected={f === frequency} onPress={() => setFrequency(f)} />
          ))}
        </View>
      </View>

      <DateField label="Next due" value={nextDue} onChange={setNextDue} />

      <Button title={existing ? 'Save' : 'Add'} size="lg" disabled={!valid} onPress={save} />

      {existing && (
        <View style={{ gap: spacing.sm }}>
          <Button
            title={existing.active ? 'Pause' : 'Resume'}
            variant="secondary"
            onPress={() => updateRecurring(existing.id, { active: !existing.active })}
          />
          <Button
            title={confirmDelete ? 'Tap again to delete' : 'Delete'}
            variant="destructive"
            onPress={() => {
              if (!confirmDelete) return setConfirmDelete(true);
              deleteRecurring(existing.id);
              closeSheet();
            }}
          />
        </View>
      )}
    </SheetScreen>
  );
}
