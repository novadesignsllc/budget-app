import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { Dropdown, type DropdownOption } from '@/components/dropdown';
import { Text } from '@/components/text';
import { useToast } from '@/components/toast';
import { cleanAmount, showAmount } from '@/domain/amount-text';
import { addDays, today } from '@/domain/dates';
import { parseMoney } from '@/domain/money';
import { isCashAccount, type Account, type Transaction } from '@/domain/types';
import { useEntryOptions } from '@/hooks/use-entry-options';
import { useStore } from '@/store';
import { radius, spacing, type as typeScale, useColors } from '@/theme';
import { confirmAction } from '@/utils/confirm';

import { shortDate } from './budget';
import { FLEX, GAP, W, type RegisterColumns } from './register';

const READY = 'income';
const toText = (cents: number) => (cents ? (Math.abs(cents) / 100).toFixed(2) : '');

/**
 * A register row opened for editing, in place: every column is a field. Enter saves, Esc
 * cancels. Only adding a transaction uses the full form.
 */
export function RegisterEditRow({
  t,
  account,
  columns,
  onDone,
  envelopeLabel,
}: {
  t: Transaction;
  account?: Account;
  columns: RegisterColumns;
  onDone: () => void;
  /** What the Envelope column says for money that has no envelope to pick (transfers and such). */
  envelopeLabel: string;
}) {
  const colors = useColors();
  const editTransaction = useStore((s) => s.editTransaction);
  const deleteTransaction = useStore((s) => s.deleteTransaction);
  const showToast = useToast((s) => s.show);
  const { envelopeOptions } = useEntryOptions();
  const [date, setDate] = useState(t.date);
  const [payee, setPayee] = useState(t.payee);
  const [memo, setMemo] = useState(t.memo ?? '');
  const [out, setOut] = useState(t.amount < 0 ? toText(t.amount) : '');
  const [inn, setInn] = useState(t.amount > 0 ? toText(t.amount) : '');
  const [envelope, setEnvelope] = useState<string | undefined>(t.kind === 'income' ? READY : t.envelopeId);

  const pickable = t.kind === 'spend' || t.kind === 'slip' || t.kind === 'income';
  const cash = !!account && isCashAccount(account);
  const envOptions = useMemo<DropdownOption<string>[]>(
    () => [...(cash && inn ? [{ value: READY, label: 'Ready to assign', section: 'Income' }] : []), ...envelopeOptions],
    [cash, inn, envelopeOptions],
  );
  const dates = useMemo<DropdownOption<string>[]>(() => {
    const list: DropdownOption<string>[] = [];
    // Never after today: a transaction dated ahead wouldn't count anywhere yet.
    const last = today();
    for (let i = 30; i >= -60; i--) {
      const d = addDays(t.date, i);
      if (d > last && d !== t.date) continue;
      list.push({ value: d, label: shortDate(d) });
    }
    return list;
  }, [t.date]);

  async function save() {
    const amount = inn ? (parseMoney(inn) ?? 0) : -(parseMoney(out) ?? 0);
    if (!amount) {
      showToast({ message: 'Add an amount.' });
      return;
    }
    if (pickable && amount < 0 && (!envelope || envelope === READY)) {
      showToast({ message: 'Pick an envelope for money going out.' });
      return;
    }
    const changed =
      date !== t.date || payee.trim() !== t.payee || memo.trim() !== (t.memo ?? '') || amount !== t.amount ||
      (pickable && (t.kind === 'income' ? READY : t.envelopeId) !== envelope);
    if (!changed) {
      onDone();
      return;
    }
    if (
      t.reconciled &&
      !(await confirmAction('Change a reconciled transaction?', 'It was checked against your bank, so changing it can put this account off.', 'Save'))
    )
      return;
    editTransaction(t.id, { date, payee, memo, amount, envelope });
    onDone();
  }

  async function remove() {
    if (!(await confirmAction(`Delete ${t.payee}?`, 'This can’t be undone.', 'Delete'))) return;
    deleteTransaction(t.id);
    showToast({ message: `Deleted ${t.payee}` });
    onDone();
  }

  const field = (props: React.ComponentProps<typeof TextInput>, style: object) => (
    <TextInput
      placeholderTextColor={colors.placeholder}
      onSubmitEditing={() => void save()}
      submitBehavior="submit"
      onKeyPress={(e) => {
        if (e.nativeEvent.key === 'Escape') onDone();
      }}
      {...props}
      style={[
        typeScale.callout,
        {
          height: 30,
          paddingHorizontal: 8,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          borderRadius: radius.button,
          borderCurve: 'continuous',
          backgroundColor: colors.surface,
          color: colors.text,
          outlineColor: colors.accent,
          minWidth: 0,
        },
        style,
      ]}
    />
  );

  return (
    <View style={{ backgroundColor: colors.accentFaint, borderTopWidth: 1, borderTopColor: colors.hairline }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: GAP, paddingHorizontal: 16, paddingTop: 6 }}>
        {columns.check && <View style={{ width: W.check }} />}
        <View style={{ width: W.date }}>
          <Dropdown variant="inline" value={date} options={dates} onChange={setDate} label="Date" />
        </View>
        {field({ value: payee, onChangeText: setPayee, accessibilityLabel: 'Payee', autoFocus: true }, { flex: FLEX.payee })}
        {columns.envelope !== false && (
          <View style={{ flex: FLEX.envelope, minWidth: 0 }}>
            {pickable ? (
              <Dropdown
                variant="inline"
                value={envelope}
                options={envOptions}
                onChange={setEnvelope}
                searchable
                label="Envelope"
                placeholder="Envelope"
              />
            ) : (
              <Text variant="callout" tone="textSecondary" numberOfLines={1}>
                {envelopeLabel}
              </Text>
            )}
          </View>
        )}
        {columns.account !== false && (
          <Text variant="callout" tone="textSecondary" numberOfLines={1} style={{ flex: FLEX.account }}>
            {account?.name ?? ''}
          </Text>
        )}
        {field({ value: memo, onChangeText: setMemo, placeholder: 'Note', accessibilityLabel: 'Note' }, { flex: FLEX.note })}
        {field(
          {
            // Digits fill in from the right, like everywhere else: 4357 is $43.57.
            value: out ? showAmount(out) : '',
            onChangeText: (v) => {
              setOut(cleanAmount(v));
              if (v) setInn('');
            },
            placeholder: '$0.00',
            accessibilityLabel: 'Outflow',
            inputMode: 'decimal',
            // Clicking in selects the amount, so typing replaces it.
            selectTextOnFocus: true,
          },
          { width: W.out, textAlign: 'right', fontVariant: ['tabular-nums'] },
        )}
        {field(
          {
            value: inn ? showAmount(inn) : '',
            onChangeText: (v) => {
              setInn(cleanAmount(v));
              if (v) setOut('');
            },
            placeholder: '$0.00',
            accessibilityLabel: 'Inflow',
            inputMode: 'decimal',
            selectTextOnFocus: true,
          },
          { width: W.in, textAlign: 'right', fontVariant: ['tabular-nums'] },
        )}
        {columns.status && <View style={{ width: W.status }} />}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: 16, paddingVertical: 6 }}>
        <SmallButton label="Delete" tone="negative" onPress={() => void remove()} />
        <View style={{ flex: 1 }} />
        <SmallButton label="Cancel" onPress={onDone} />
        <SmallButton label="Save" primary onPress={() => void save()} />
      </View>
    </View>
  );
}

function SmallButton({ label, onPress, primary, tone }: { label: string; onPress: () => void; primary?: boolean; tone?: 'negative' }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ hovered }: { hovered?: boolean }) => ({
        height: 26,
        paddingHorizontal: 10,
        borderRadius: radius.button,
        justifyContent: 'center',
        backgroundColor: primary ? colors.accent : hovered ? colors.control : 'transparent',
      })}
    >
      <Text variant="footnote" weight="600" tone={primary ? 'onInk' : tone === 'negative' ? 'negative' : 'accent'}>
        {label}
      </Text>
    </Pressable>
  );
}
