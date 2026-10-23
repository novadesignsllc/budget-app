import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { useMemo, useState } from 'react';
import { Switch, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Dropdown, type DropdownOption } from '@/components/dropdown';
import { Field } from '@/components/field';
import { Icon } from '@/components/icon';
import { SheetScreen } from '@/components/screen';
import { Text } from '@/components/text';
import { addDays, formatShortDate, fromISODate, toISODate, today } from '@/domain/dates';
import { formatMoney, parseMoney } from '@/domain/money';
import { formatMonth, monthOf } from '@/domain/months';
import { isCashAccount, type ISODate } from '@/domain/types';
import { useAccounts, useLedger } from '@/hooks/use-ledger';
import { SheetHeader } from '@/components/sheet-header';
import { DEBT_GROUP, isLocked, useStore } from '@/store';
import { groupColor, radius, spacing, type as typeScale, useColors } from '@/theme';
import { closeSheet } from '@/utils/close-sheet';
import { haptic } from '@/utils/haptics';

const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short' });
const GROUP_ORDER = ['Bills', 'Everyday', 'Savings'];
const groupRank = (g: string) => (g === DEBT_GROUP ? 99 : GROUP_ORDER.includes(g) ? GROUP_ORDER.indexOf(g) : 50);

/** A label-and-control line inside the sheet's grouped card, same height as a dropdown row. */
function CardRow({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  const colors = useColors();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 40,
        paddingHorizontal: spacing.md,
        gap: spacing.sm,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.hairline,
      }}
    >
      <Text variant="body" tone="textSecondary" style={{ flex: 1 }} numberOfLines={1}>
        {label}
      </Text>
      {children}
    </View>
  );
}

/** Dropdown rows draw no divider of their own; this puts one under each. */
function Divided({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return <View style={{ borderBottomWidth: 1, borderBottomColor: colors.hairline }}>{children}</View>;
}

/** The native date picker on iOS and Android; on web (no picker there) the last 60 days. */
function DateRow({ value, onChange }: { value: ISODate; onChange: (d: ISODate) => void }) {
  const options = useMemo(() => {
    const now = today();
    const days: ISODate[] = [];
    for (let i = 0; i <= 60; i++) days.push(addDays(now, -i));
    if (!days.includes(value)) days.push(value);
    return days
      .sort()
      .reverse()
      .map((d): DropdownOption<ISODate> => ({
        value: d,
        label: d === now ? 'Today' : d === addDays(now, -1) ? 'Yesterday' : formatShortDate(d),
        detail: weekday.format(fromISODate(d)),
        section: formatMonth(monthOf(d)),
      }));
  }, [value]);

  if (process.env.EXPO_OS === 'web') {
    return (
      <Divided>
        <Dropdown variant="row" label="Date" value={value} options={options} onChange={onChange} />
      </Divided>
    );
  }
  return (
    <CardRow label="Date">
      <DateTimePicker
        value={fromISODate(value)}
        mode="date"
        display="compact"
        onValueChange={(_e, date) => onChange(toISODate(date))}
      />
    </CardRow>
  );
}

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
  const [flagged, setFlagged] = useState(!!t?.flagged);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);

  const envelopeOptions = useMemo(
    () =>
      envelopes
        .filter((e) => !e.hidden && !e.debtAccountId)
        .sort((a, b) => groupRank(a.group) - groupRank(b.group) || a.group.localeCompare(b.group) || a.order - b.order)
        .map((e): DropdownOption<string> => {
          const available = ledger.available.get(e.id) ?? 0;
          return {
            value: e.id,
            label: e.name,
            section: e.group,
            dot: groupColor(e.group),
            detail: available < 0 ? formatMoney(available) : `${formatMoney(available)} left`,
            tone: available < 0 ? 'negative' : undefined,
          };
        }),
    [envelopes, ledger],
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
        section: 'Cards · logged as a slip',
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
    if (flagged !== !!t.flagged) setFlag(t.id, flagged);
    haptic('success');
    closeSheet();
  }

  return (
    <SheetScreen>
      <SheetHeader title={TITLES[kind]} />

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          paddingHorizontal: 2,
        }}
      >
        <Text variant="section" tone={kind === 'slip' ? 'negative' : 'text'} numberOfLines={1} style={{ flex: 1 }}>
          {payee.trim() || 'Untitled'}
        </Text>
        <Text
          variant="number"
          tone={kind === 'slip' ? 'negative' : signedAmount > 0 ? 'positive' : 'text'}
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {formatMoney(signedAmount, { signed: true })}
        </Text>
      </View>

      {locked && (
        <Card tone="due">
          <View
            style={{
              flexDirection: 'row',
              gap: spacing.sm + 2,
              padding: spacing.md,
            }}
          >
            <Icon sf="lock.fill" md="lock" size={13} color={colors.orange} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="body" weight="600" tone="orange">
                Reconciled and locked
              </Text>
              <Text variant="callout" tone="textSecondary">
                This matched your bank statement. If you change it, {account?.name ?? 'the account'} won’t match the
                bank anymore.
              </Text>
            </View>
          </View>
        </Card>
      )}

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Field label="Payee" value={payee} onChangeText={setPayee} autoCapitalize="words" />
        </View>
        <View style={{ width: 120 }}>
          <Field
            label="Amount"
            value={amountText}
            onChangeText={setAmountText}
            keyboardType="decimal-pad"
            inputMode="decimal"
            style={{ textAlign: 'right' }}
          />
        </View>
      </View>

      <Card style={{ borderRadius: radius.menu }}>
        {spending && (
          <Divided>
            <Dropdown
              variant="row"
              label="Envelope"
              value={envelopeId}
              options={envelopeOptions}
              onChange={setEnvelopeId}
              searchable
              placeholder="Choose"
            />
          </Divided>
        )}
        {spending ? (
          <Divided>
            <Dropdown
              variant="row"
              label="Account"
              value={accountId}
              options={accountOptions}
              onChange={setAccountId}
            />
          </Divided>
        ) : (
          <CardRow label="Account">
            <Text variant="body" weight="500">
              {account?.name ?? 'Unknown'}
            </Text>
          </CardRow>
        )}
        <DateRow value={date} onChange={setDate} />
        <CardRow label="Note">
          <TextInput
            value={memo}
            onChangeText={setMemo}
            placeholder="Optional"
            placeholderTextColor={colors.placeholder}
            accessibilityLabel="Note"
            style={[typeScale.body, { flex: 2, height: 40, textAlign: 'right', color: colors.text }]}
          />
        </CardRow>
        <CardRow label="Flag for later" last>
          <Switch
            value={flagged}
            onValueChange={(v) => {
              haptic('selection');
              setFlagged(v);
            }}
            trackColor={{ true: colors.accent, false: colors.fillPressed }}
            accessibilityLabel="Flag for later"
          />
        </CardRow>
      </Card>

      {flagged && (
        <Text variant="footnote" tone="textSecondary" style={{ paddingHorizontal: 2 }}>
          Flagged transactions stay out of reconciling until you clear the flag.
        </Text>
      )}
      {onCard && spending && (
        <Text variant="footnote" tone="negative" style={{ paddingHorizontal: 2 }}>
          On a card, this is a slip. It still comes out of the envelope, and the money moves to the card’s payment.
        </Text>
      )}

      <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
        <Button
          title={locked && confirmSave ? 'Save anyway' : 'Save changes'}
          size="lg"
          disabled={amount === null || !payee.trim()}
          onPress={save}
        />
        <Button
          title={
            confirmDelete
              ? locked
                ? 'It’s reconciled. Tap again to delete anyway'
                : 'Tap again to delete'
              : 'Delete transaction'
          }
          variant="destructive"
          onPress={() => {
            if (!confirmDelete) return setConfirmDelete(true);
            remove(t.id);
            haptic('success');
            closeSheet();
          }}
        />
      </View>
    </SheetScreen>
  );
}
