import { useRef, useState } from 'react';
import { TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { DateRow } from '@/components/date-picker';
import { Dropdown, type DropdownOption } from '@/components/dropdown';
import { Field } from '@/components/field';
import { SheetScreen } from '@/components/screen';
import { Text } from '@/components/text';
import { today } from '@/domain/dates';
import { formatMoney, parseMoney } from '@/domain/money';
import { FREQUENCY_LABEL } from '@/domain/recurring';
import { isCashAccount, type Frequency, type RecurringKind } from '@/domain/types';
import { useAccounts, useLedger } from '@/hooks/use-ledger';
import { useStore } from '@/store';
import { radius, spacing, useColors } from '@/theme';
import { closeSheet } from '@/utils/close-sheet';
import { haptic } from '@/utils/haptics';

import { SheetHeader } from '@/components/sheet-header';

const FREQUENCIES: Frequency[] = ['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'];

export function EditRecurring({ id }: { id?: string }) {
  const colors = useColors();
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const amountRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  const amount = parseMoney(amountText);
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
        section: card ? 'Cards · every charge is a slip' : 'Bank accounts',
        tone: card ? 'negative' : undefined,
        detail: formatMoney(ledger.balance.get(a.id) ?? 0),
      };
    });

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

  const rowStyle = { borderBottomWidth: 1, borderBottomColor: colors.hairline };

  return (
    <SheetScreen>
      <SheetHeader title={existing ? existing.name : 'New recurring'} />

      <Field
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
      <Field
        ref={amountRef}
        label={kind === 'bill' ? 'Usual amount' : 'Amount'}
        value={amountText}
        onChangeText={setAmountText}
        placeholder="0.00"
        keyboardType="decimal-pad"
        inputMode="decimal"
      />

      <View style={{ gap: 6 }}>
        <View
          style={{
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.menu,
            borderCurve: 'continuous',
            overflow: 'hidden',
          }}
        >
          <View style={rowStyle}>
            <Dropdown
              variant="row"
              label="Kind"
              value={kind}
              onChange={setKind}
              options={[
                {
                  value: 'bill',
                  label: 'Bill',
                  description: 'Rent, utilities. The amount can change.',
                },
                {
                  value: 'subscription',
                  label: 'Subscription',
                  description: 'Netflix, Spotify. Same price each time.',
                },
              ]}
            />
          </View>
          <View style={rowStyle}>
            <Dropdown
              variant="row"
              label="Paid from"
              value={accountId}
              onChange={setAccountId}
              options={accountOptions}
            />
          </View>
          <View style={rowStyle}>
            <Dropdown
              variant="row"
              label="How often"
              value={frequency}
              onChange={setFrequency}
              options={FREQUENCIES.map((f) => ({
                value: f,
                label: FREQUENCY_LABEL[f],
              }))}
            />
          </View>
          <DateRow label="Next due" value={nextDue} onChange={setNextDue} last />
        </View>
        {onCard && (
          <Text variant="footnote" tone="negative" style={{ paddingHorizontal: 2 }}>
            On a card, this is a slip every time.
          </Text>
        )}
      </View>

      <Button title={existing ? 'Save' : 'Add'} size="lg" disabled={!valid} onPress={save} />

      {existing && (
        <View style={{ gap: spacing.sm }}>
          {existing.active && existing.nextDue <= today() && (
            <Button
              title="Skip this time"
              variant="secondary"
              onPress={() => {
                skipRecurring(existing.id);
                closeSheet();
              }}
            />
          )}
          <Button
            title={existing.active ? 'Pause' : 'Resume'}
            variant="secondary"
            onPress={() => updateRecurring(existing.id, { active: !existing.active })}
          />
          <Button
            title={confirmDelete ? 'Tap again to delete it and its envelope' : 'Delete'}
            variant="destructive"
            onPress={() => {
              if (!confirmDelete) return setConfirmDelete(true);
              // Its envelope goes too; whatever it still holds goes back to Ready to assign.
              const left = existing.envelopeId ? (ledger.available.get(existing.envelopeId) ?? 0) : 0;
              if (existing.envelopeId && left > 0) assign(existing.envelopeId, -left);
              deleteRecurring(existing.id);
              closeSheet();
            }}
          />
        </View>
      )}
    </SheetScreen>
  );
}
