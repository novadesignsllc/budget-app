import { closeSheet } from '@/utils/close-sheet';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { DateField } from '@/components/date-field';
import { Money } from '@/components/money';
import { SheetScreen } from '@/components/screen';
import { Text } from '@/components/text';
import { addDays, formatDay, today } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import { parseQuickAdd } from '@/domain/quick-add';
import { isCashAccount, type ISODate } from '@/domain/types';
import { useAccounts } from '@/hooks/use-ledger';
import { useStore } from '@/store';
import { radius, spacing, type as typeScale, useColors } from '@/theme';
import { haptic } from '@/utils/haptics';

type Picker = 'envelope' | 'account' | 'date' | null;

export function QuickAdd() {
  const colors = useColors();
  const [text, setText] = useState('');
  const [picker, setPicker] = useState<Picker>(null);
  const [override, setOverride] = useState<{
    envelopeId?: string;
    accountId?: string;
    date?: ISODate;
    income?: boolean;
  }>({});

  const envelopes = useStore((s) => s.envelopes);
  const merchantMemory = useStore((s) => s.merchantMemory);
  const addTransaction = useStore((s) => s.addTransaction);
  const { all: accounts, cash } = useAccounts();

  const parsed = useMemo(
    () => parseQuickAdd(text, { accounts, envelopes, merchantMemory, today: today() }),
    [text, accounts, envelopes, merchantMemory],
  );

  const accountId = override.accountId ?? parsed.accountId;
  const account = accounts.find((a) => a.id === accountId);
  const isSlip = !!account && !isCashAccount(account);
  const isIncome = override.income ?? parsed.kind === 'income';
  const kind = isIncome ? 'income' : isSlip ? 'slip' : 'spend';
  const envelopeId = isIncome ? null : (override.envelopeId ?? parsed.envelopeId);
  const envelope = envelopes.find((e) => e.id === envelopeId);
  const date = override.date ?? parsed.date;

  const spendable = envelopes
    .filter((e) => !e.hidden && !e.debtAccountId)
    .sort((a, b) => a.group.localeCompare(b.group) || a.order - b.order);

  const ready = !!parsed.amount && !!parsed.payee && !!account && (isIncome || !!envelope);

  function save() {
    if (!ready || !account || !parsed.amount) {
      if (parsed.amount && !envelope && !isIncome) setPicker('envelope');
      return;
    }
    addTransaction({
      date,
      accountId: account.id,
      amount: parsed.amount,
      kind,
      payee: parsed.payee,
      envelopeId: envelope?.id,
    });
    haptic(isSlip ? 'warning' : 'success');
    closeSheet();
  }

  if (cash.length === 0) {
    return (
      <SheetScreen>
        <Text variant="title">Add an account first</Text>
        <Text variant="body" tone="textSecondary">
          Transactions come out of a checking, savings, or cash account. Add the one your debit card uses.
        </Text>
        <Button title="Add account" onPress={() => router.replace('/new-account')} />
      </SheetScreen>
    );
  }

  const saveLabel = !parsed.amount
    ? 'Type an amount'
    : !envelope && !isIncome
      ? 'Choose an envelope'
      : isIncome
        ? `Add ${formatMoney(parsed.amount)} income`
        : `Add ${formatMoney(parsed.amount)} from ${envelope!.name}`;

  return (
    <SheetScreen contentContainerStyle={{ gap: spacing.lg }}>
      <TextInput
        autoFocus
        value={text}
        onChangeText={setText}
        placeholder="McDonald's 10.99"
        placeholderTextColor={colors.textTertiary}
        returnKeyType="done"
        submitBehavior="submit"
        onSubmitEditing={save}
        autoCorrect={false}
        accessibilityLabel="Describe the transaction"
        style={[
          typeScale.title,
          {
            color: colors.text,
            backgroundColor: colors.fill,
            borderRadius: radius.md,
            borderCurve: 'continuous',
            paddingHorizontal: spacing.lg,
            height: 56,
          },
        ]}
      />

      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.md }}>
        <Text variant="headline" numberOfLines={1} style={{ flex: 1 }} tone={parsed.payee ? 'text' : 'textTertiary'}>
          {parsed.payee || 'Merchant'}
        </Text>
        {parsed.amount ? (
          <Money
            cents={isIncome ? parsed.amount : -parsed.amount}
            variant="title"
            signed
            tone={isIncome ? 'positive' : isSlip ? 'negative' : 'text'}
          />
        ) : (
          <Text variant="title" tone="textTertiary">
            $0.00
          </Text>
        )}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {!isIncome && (
          <Chip
            label={envelope?.name ?? 'Envelope'}
            tone={envelope ? 'default' : 'muted'}
            selected={picker === 'envelope'}
            onPress={() => setPicker(picker === 'envelope' ? null : 'envelope')}
            accessibilityLabel={`Envelope: ${envelope?.name ?? 'none'}`}
          />
        )}
        <Chip
          label={account?.name ?? 'Account'}
          tone={isSlip ? 'negative' : 'default'}
          selected={picker === 'account'}
          onPress={() => setPicker(picker === 'account' ? null : 'account')}
          accessibilityLabel={`Account: ${account?.name ?? 'none'}`}
        />
        <Chip
          label={formatDay(date)}
          selected={picker === 'date'}
          onPress={() => setPicker(picker === 'date' ? null : 'date')}
          accessibilityLabel={`Date: ${formatDay(date)}`}
        />
        <Chip
          label={isIncome ? 'Income' : 'Expense'}
          onPress={() => setOverride((o) => ({ ...o, income: !isIncome }))}
          accessibilityLabel={isIncome ? 'Income. Tap to make it an expense' : 'Expense. Tap to make it income'}
        />
      </View>

      {parsed.envelopeSource === 'guessed' && !override.envelopeId && envelope && !isIncome && (
        <Text variant="footnote" tone="textSecondary">
          Guessed from the name. Tap the envelope to change it, and next time it’ll remember.
        </Text>
      )}

      {isSlip && (
        <View style={{ backgroundColor: colors.negativeSoft, borderRadius: radius.md, padding: spacing.lg, gap: spacing.xs }}>
          <Text variant="headline" tone="negative">
            This goes on {account!.name}
          </Text>
          <Text variant="callout" tone="negative">
            Card spending is a slip. It still comes out of the envelope, and the money gets set aside to pay the
            card back. It’ll be marked red.
          </Text>
        </View>
      )}

      <Button title={saveLabel} size="lg" variant={isSlip ? 'destructive' : 'primary'} disabled={!parsed.amount} onPress={save} />

      {picker === 'envelope' && (
        <PickerGrid>
          {spendable.length === 0 && (
            <Text variant="callout" tone="textSecondary">
              No envelopes yet. Make some on the Budget tab.
            </Text>
          )}
          {spendable.map((e) => (
            <Chip
              key={e.id}
              label={e.name}
              selected={e.id === envelopeId}
              onPress={() => {
                setOverride((o) => ({ ...o, envelopeId: e.id }));
                setPicker(null);
              }}
            />
          ))}
        </PickerGrid>
      )}

      {picker === 'account' && (
        <PickerGrid>
          {accounts.map((a) => (
            <Chip
              key={a.id}
              label={a.name}
              selected={a.id === accountId}
              tone={isCashAccount(a) ? 'default' : 'negative'}
              onPress={() => {
                setOverride((o) => ({ ...o, accountId: a.id }));
                setPicker(null);
              }}
            />
          ))}
        </PickerGrid>
      )}

      {picker === 'date' && (
        <View style={{ gap: spacing.md }}>
          <PickerGrid>
            {[0, -1, -2].map((offset) => {
              const d = addDays(today(), offset);
              return (
                <Chip
                  key={d}
                  label={formatDay(d)}
                  selected={d === date}
                  onPress={() => {
                    setOverride((o) => ({ ...o, date: d }));
                    setPicker(null);
                  }}
                />
              );
            })}
          </PickerGrid>
          <DateField label="Other date" value={date} onChange={(d) => setOverride((o) => ({ ...o, date: d }))} />
        </View>
      )}
    </SheetScreen>
  );
}

function PickerGrid({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>{children}</View>;
}
