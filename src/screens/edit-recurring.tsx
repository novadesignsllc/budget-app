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
import { orderGroups } from '@/utils/group-order';
import { groupColor, radius, spacing, useColors } from '@/theme';
import { closeSheet } from '@/utils/close-sheet';
import { haptic } from '@/utils/haptics';

import { SheetHeader } from '@/components/sheet-header';

const FREQUENCIES: Frequency[] = ['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'];

export function EditRecurring({ id }: { id?: string }) {
  const colors = useColors();
  const existing = useStore((s) => s.recurring.find((r) => r.id === id));
  const envelopes = useStore((s) => s.envelopes);
  const addRecurring = useStore((s) => s.addRecurring);
  const updateRecurring = useStore((s) => s.updateRecurring);
  const deleteRecurring = useStore((s) => s.deleteRecurring);
  const skipRecurring = useStore((s) => s.skipRecurring);
  const { all: accounts, cash } = useAccounts();
  const ledger = useLedger();

  const [name, setName] = useState(existing?.name ?? '');
  const [kind, setKind] = useState<RecurringKind>(existing?.kind ?? 'bill');
  const [amountText, setAmountText] = useState(existing ? (existing.amount / 100).toFixed(2) : '');
  const [accountId, setAccountId] = useState(existing?.accountId ?? cash[0]?.id);
  const [envelopeId, setEnvelopeId] = useState(existing?.envelopeId);
  const [frequency, setFrequency] = useState<Frequency>(existing?.frequency ?? 'monthly');
  const [nextDue, setNextDue] = useState(existing?.nextDue ?? today());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const amountRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const groupOrder = useStore((s) => s.settings.groupOrder);

  const amount = parseMoney(amountText);
  const account = accounts.find((a) => a.id === accountId);
  const onCard = !!account && !isCashAccount(account);
  const groups = orderGroups(
    envelopes.map((e) => e.group),
    groupOrder,
  );
  const spendable = envelopes
    .filter((e) => !e.hidden && !e.debtAccountId)
    .sort((a, b) => groups.indexOf(a.group) - groups.indexOf(b.group) || a.order - b.order);
  // A new item gets its own Bills envelope when it's added, so only edits pick one.
  const valid = name.trim() && amount && amount > 0 && accountId && (!existing || envelopeId);

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
  const envelopeOptions: DropdownOption<string>[] = spendable.map((e) => ({
    value: e.id,
    label: e.name,
    dot: groupColor(e.group),
    section: e.group,
  }));

  function save() {
    if (!valid || !amount || !accountId) return;
    const data = {
      name: name.trim(),
      kind,
      amount,
      accountId,
      ...(existing ? { envelopeId } : {}),
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
        hint={kind === 'bill' ? 'Bills can change. Fix the amount on the transaction after you approve it.' : undefined}
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
          {existing && (
            <View style={rowStyle}>
              <Dropdown
                variant="row"
                label="Envelope"
                value={envelopeId}
                onChange={setEnvelopeId}
                options={envelopeOptions}
                searchable
                placeholder={spendable.length ? 'Choose' : 'None yet'}
              />
            </View>
          )}
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
            Recurring charges on a card are slips every time. Move this to a bank account when you can.
          </Text>
        )}
        {!existing && (
          <Text variant="footnote" tone="textSecondary" style={{ paddingHorizontal: 2 }}>
            {!name.trim()
              ? 'Adds an envelope in Bills'
              : spendable.some((e) => e.name.toLowerCase() === name.trim().toLowerCase())
                ? `Uses your ${name.trim()} envelope`
                : `Adds a ${name.trim()} envelope in Bills`}
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
