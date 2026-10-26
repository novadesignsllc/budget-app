import { useRef, useState } from 'react';
import { Alert, View } from 'react-native';

import { Button } from '@/components/button';
import { DateRow } from '@/components/date-picker';
import { Dropdown, type DropdownOption } from '@/components/dropdown';
import { ActionList, AmountHero, FormCard, InputRow } from '@/components/form';
import type { KeypadFieldHandle } from '@/components/keypad';
import { SheetScreen } from '@/components/screen';
import { Text } from '@/components/text';
import { spacing } from '@/theme';
import { today } from '@/domain/dates';
import { formatMoney, parseMoney } from '@/domain/money';
import { FREQUENCY_LABEL } from '@/domain/recurring';
import { isCashAccount, type Frequency, type RecurringKind } from '@/domain/types';
import { useAccounts, useLedger } from '@/hooks/use-ledger';
import { useStore } from '@/store';
import { closeSheet } from '@/utils/close-sheet';
import { haptic } from '@/utils/haptics';

import { SheetHeader } from '@/components/sheet-header';

const FREQUENCIES: Frequency[] = ['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'];

export function EditRecurring({ id }: { id?: string }) {
  const existing = useStore((s) => s.recurring.find((r) => r.id === id));
  const addRecurring = useStore((s) => s.addRecurring);
  const updateRecurring = useStore((s) => s.updateRecurring);
  const deleteRecurring = useStore((s) => s.deleteRecurring);
  const assign = useStore((s) => s.assign);
  const skipRecurring = useStore((s) => s.skipRecurring);
  const { all: accounts, cash } = useAccounts();
  const ledger = useLedger();

  const [name, setName] = useState(existing?.name ?? '');
  const [kind, setKind] = useState<RecurringKind>(existing?.kind ?? 'bill');
  const [amountText, setAmountText] = useState(existing ? (existing.amount / 100).toFixed(2) : '');
  const [accountId, setAccountId] = useState(existing?.accountId ?? cash[0]?.id);
  const [frequency, setFrequency] = useState<Frequency>(existing?.frequency ?? 'monthly');
  const [nextDue, setNextDue] = useState(existing?.nextDue ?? today());
  const amountRef = useRef<KeypadFieldHandle>(null);

  const amount = parseMoney(amountText);
  const deleted = !!id && !existing;
  const account = accounts.find((a) => a.id === accountId);
  const onCard = !!account && !isCashAccount(account);
  const valid = name.trim() && amount && amount > 0 && accountId;

  // Bank accounts first, then cards in their own red section. Loans can't pay a bill.
  const accountOptions: DropdownOption<string>[] = accounts
    .filter((a) => isCashAccount(a) || a.kind === 'credit_card' || a.id === accountId)
    .sort((a, b) => Number(!isCashAccount(a)) - Number(!isCashAccount(b)))
    .map((a) => {
      const card = !isCashAccount(a);
      return {
        value: a.id,
        label: a.name,
        face: a.order,
        section: card ? 'Cards' : 'Bank accounts',
        tone: card ? 'negative' : undefined,
        detail: formatMoney(ledger.balance.get(a.id) ?? 0),
      };
    });

  function remove() {
    if (!existing) return;
    // Its envelope goes too; whatever it still holds goes back to Ready to assign.
    const left = existing.envelopeId ? (ledger.available.get(existing.envelopeId) ?? 0) : 0;
    // Any balance, overspent too, so nothing hides in an envelope you can't see anymore.
    if (existing.envelopeId && left !== 0) assign(existing.envelopeId, -left);
    deleteRecurring(existing.id);
    haptic('success');
    closeSheet();
  }

  function confirmDelete() {
    if (!existing) return;
    const message = `Its envelope goes too, and anything in it goes back to Ready to assign.`;
    if (process.env.EXPO_OS === 'web') {
      if (window.confirm(`Delete ${existing.name}? ${message}`)) remove();
      return;
    }
    Alert.alert(`Delete ${existing.name}?`, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: remove },
    ]);
  }

  function save() {
    if (!valid || !amount || !accountId) return;
    const data = {
      name: name.trim(),
      kind,
      amount,
      accountId,
      frequency,
      nextDue,
    };
    if (existing) updateRecurring(existing.id, data);
    else addRecurring(data);
    haptic('success');
    closeSheet();
  }

  if (deleted) {
    return (
      <SheetScreen>
        <SheetHeader title="Recurring" />
        <Text variant="callout" tone="textSecondary" align="center">
          This was deleted.
        </Text>
      </SheetScreen>
    );
  }

  return (
    <SheetScreen>
      <SheetHeader title={existing ? existing.name : 'New recurring'} />

      <AmountHero
        ref={amountRef}
        value={amountText}
        onChangeText={setAmountText}
        tone={onCard ? 'negative' : undefined}
      />

      <FormCard>
        <InputRow
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder={kind === 'bill' ? 'Electric' : 'Netflix'}
          autoFocus={!existing}
          autoCapitalize="words"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => amountRef.current?.focus()}
        />
        <Dropdown
          variant="row"
          label="Kind"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'bill', label: 'Bill' },
            { value: 'subscription', label: 'Subscription' },
          ]}
        />
        <Dropdown variant="row" label="Paid from" value={accountId} onChange={setAccountId} options={accountOptions} />
        <Dropdown
          variant="row"
          label="How often"
          value={frequency}
          onChange={setFrequency}
          options={FREQUENCIES.map((f) => ({ value: f, label: FREQUENCY_LABEL[f] }))}
        />
        <DateRow label="Next due" value={nextDue} onChange={setNextDue} last />
      </FormCard>

      {existing ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button title="Save" size="lg" disabled={!valid} onPress={save} style={{ flex: 1 }} />
          <Button
            title={existing.active ? 'Pause' : 'Resume'}
            variant="secondary"
            size="lg"
            style={{ flex: 1 }}
            onPress={() => updateRecurring(existing.id, { active: !existing.active })}
          />
          <Button title="Delete" variant="destructive" size="lg" style={{ flex: 1 }} onPress={confirmDelete} />
        </View>
      ) : (
        <Button title="Add" size="lg" disabled={!valid} onPress={save} />
      )}

      {existing?.active && existing.nextDue <= today() && (
        <ActionList
          actions={[
            {
              title: 'Skip this time',
              onPress: () => {
                skipRecurring(existing.id);
                closeSheet();
              },
            },
          ]}
        />
      )}
    </SheetScreen>
  );
}
