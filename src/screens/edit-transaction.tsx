import { useMemo, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { DateRow } from '@/components/date-picker';
import { Dropdown, type DropdownOption } from '@/components/dropdown';
import { ActionList, AmountHero, FlagRow, FormCard, FormRow, InputRow } from '@/components/form';
import { Icon } from '@/components/icon';
import { SheetScreen } from '@/components/screen';
import { Text } from '@/components/text';
import { today } from '@/domain/dates';
import { formatDollars, formatMoney, parseMoney } from '@/domain/money';
import { isCashAccount, type FlagColor } from '@/domain/types';
import { useAccounts, useLedger } from '@/hooks/use-ledger';
import { SheetHeader } from '@/components/sheet-header';
import { isLocked, useStore } from '@/store';
import { groupColor, useColors } from '@/theme';
import { closeSheet } from '@/utils/close-sheet';
import { orderGroups } from '@/utils/group-order';
import { haptic } from '@/utils/haptics';

const TITLES = {
  spend: 'Expense',
  slip: 'Card slip',
  income: 'Income',
  transfer: 'Transfer',
  interest: 'Interest',
  adjustment: 'Adjustment',
} as const;

export function EditTransaction({ id }: { id: string }) {
  const colors = useColors();
  const ledger = useLedger();
  const { cash, debts } = useAccounts();
  const t = useStore((s) => s.transactions.find((x) => x.id === id));
  const envelopes = useStore((s) => s.envelopes);
  const update = useStore((s) => s.updateTransaction);
  const remove = useStore((s) => s.deleteTransaction);
  const setFlag = useStore((s) => s.setFlag);

  const [payee, setPayee] = useState(t?.payee ?? '');
  const [amountText, setAmountText] = useState(t ? (Math.abs(t.amount) / 100).toFixed(2) : '');
  const [date, setDate] = useState(t?.date ?? today());
  const [envelopeId, setEnvelopeId] = useState(t?.envelopeId);
  const [accountId, setAccountId] = useState(t?.accountId ?? '');
  const [memo, setMemo] = useState(t?.memo ?? '');
  const [flag, setFlagState] = useState<FlagColor | null>(t?.flagged ? (t.flagColor ?? 'red') : null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);
  const amountRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const noteRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  // Envelopes listed in the Budget's group order.
  const groupOrder = useStore((s) => s.settings.groupOrder);

  const listedGroups = useMemo(() => orderGroups(envelopes.map((e) => e.group), groupOrder), [envelopes, groupOrder]);

  const envelopeOptions = useMemo(
    () =>
      envelopes
        .filter((e) => !e.hidden && !e.debtAccountId)
        .sort((a, b) => listedGroups.indexOf(a.group) - listedGroups.indexOf(b.group) || a.order - b.order)
        .map((e): DropdownOption<string> => {
          const available = ledger.available.get(e.id) ?? 0;
          return {
            value: e.id,
            label: e.name,
            section: e.group,
            dot: groupColor(e.group),
            detail: available < 0 ? formatDollars(available) : `${formatDollars(available)} left`,
            tone: available < 0 ? 'negative' : undefined,
          };
        }),
    [envelopes, ledger, listedGroups],
  );

  if (!t) {
    return (
      <SheetScreen>
        <SheetHeader title="Transaction" />
        <Card padded>
          <Text variant="callout" tone="textSecondary">
            This transaction was deleted.
          </Text>
        </Card>
      </SheetScreen>
    );
  }

  const amount = parseMoney(amountText);
  const locked = isLocked(t);
  const spending = t.kind === 'spend' || t.kind === 'slip';
  const account = [...cash, ...debts].find((a) => a.id === accountId);
  const onCard = !!account && !isCashAccount(account);
  const kind = spending ? (onCard ? 'slip' : 'spend') : t.kind;
  const signedAmount = amount === null ? t.amount : t.amount < 0 ? -amount : amount;

  const accountOptions: DropdownOption<string>[] = [
    ...cash.map((a): DropdownOption<string> => ({
      value: a.id,
      label: a.name,
      face: a.order,
      detail: formatMoney(ledger.balance.get(a.id) ?? 0),
    })),
    ...debts
      .filter((a) => a.kind === 'credit_card')
      .map((a): DropdownOption<string> => ({
        value: a.id,
        label: a.name,
        face: a.order,
        section: 'Cards',
        tone: 'negative',
      })),
  ];
  // The list starts with a section only if cash accounts have one too.
  if (accountOptions.some((o) => o.section)) {
    for (const o of accountOptions) if (!o.section) o.section = 'Accounts';
  }

  function save() {
    if (!t || amount === null || !payee.trim()) return;
    if (locked && !confirmSave) return setConfirmSave(true);
    const fields = {
      payee: payee.trim(),
      date,
      envelopeId,
      memo: memo.trim() || undefined,
    };
    // Moving spending to a card turns it into a slip (and back); the store handles that.
    update(t.id, { ...fields, amount, accountId: spending ? accountId : undefined });
    if (flag !== (t.flagged ? (t.flagColor ?? 'red') : null)) setFlag(t.id, flag);
    haptic('success');
    closeSheet();
  }

  return (
    <SheetScreen>
      <SheetHeader title={TITLES[kind]} />

      <AmountHero
        ref={amountRef}
        value={amountText}
        onChangeText={setAmountText}
        tone={kind === 'slip' ? 'negative' : signedAmount > 0 ? 'positive' : undefined}
      />

      {locked && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Icon sf="lock.fill" md="lock" size={11} color={colors.orange} />
          <Text variant="footnote" weight="600" tone="orange">
            Reconciled
          </Text>
        </View>
      )}

      <FormCard>
        <InputRow
          label="Payee"
          value={payee}
          onChangeText={setPayee}
          autoCapitalize="words"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => noteRef.current?.focus()}
        />
        {spending && (
          <Dropdown
            variant="row"
            label="Envelope"
            value={envelopeId}
            options={envelopeOptions}
            onChange={setEnvelopeId}
            searchable
            placeholder="Choose"
          />
        )}
        {spending ? (
          <Dropdown variant="row" label="Account" value={accountId} options={accountOptions} onChange={setAccountId} />
        ) : (
          <FormRow label="Account">
            <Text variant="body" weight="500">
              {account?.name ?? 'Unknown'}
            </Text>
          </FormRow>
        )}
        <DateRow label="Date" value={date} onChange={setDate} max={today()} last />
        <InputRow
          ref={noteRef}
          label="Note"
          value={memo}
          onChangeText={setMemo}
          returnKeyType="done"
          placeholder="Add a note"
        />
        <FlagRow value={flag} onChange={setFlagState} />
      </FormCard>

      <Button
        title={locked && confirmSave ? 'Save anyway' : 'Save'}
        size="lg"
        disabled={amount === null || !payee.trim()}
        onPress={save}
      />
      <ActionList
        actions={[
          {
            title: confirmDelete ? (locked ? 'It’s reconciled. Tap again to delete' : 'Tap again to delete') : 'Delete transaction',
            tone: 'negative',
            onPress: () => {
              if (!confirmDelete) return setConfirmDelete(true);
              remove(t.id);
              haptic('success');
              closeSheet();
            },
          },
        ]}
      />
    </SheetScreen>
  );
}
