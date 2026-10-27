import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { DateRow } from '@/components/date-picker';
import { Dropdown } from '@/components/dropdown';
import { AmountRow, FormCard, InputRow } from '@/components/form';
import { SheetScreen } from '@/components/screen';
import { SheetHeader } from '@/components/sheet-header';
import { Text } from '@/components/text';
import { formatShortDate, today } from '@/domain/dates';
import { formatMoney, parseMoney } from '@/domain/money';
import { isCashAccount } from '@/domain/types';
import { KINDS } from '@/screens/new-account';
import { useStore } from '@/store';
import { spacing } from '@/theme';
import { closeSheet } from '@/utils/close-sheet';
import { haptic } from '@/utils/haptics';

/**
 * Everything about an account you might need to fix: its name, type, the balance it
 * started with and the day that balance was from, and a debt's rate, minimum and due day.
 * A debt's payment envelope takes a new name too.
 */
export function EditAccount({ id }: { id: string }) {
  const account = useStore((s) => s.accounts.find((a) => a.id === id));
  const transactions = useStore((s) => s.transactions);
  const updateAccount = useStore((s) => s.updateAccount);
  const cash = account ? isCashAccount(account) : true;
  // Debts are stored negative (owed); the form shows what's owed as a positive amount.
  const startText = (cents: number) => ((cash ? cents : -cents) / 100).toFixed(2);
  const [name, setName] = useState(account?.name ?? '');
  const [kind, setKind] = useState(account?.kind ?? 'checking');
  const [start, setStart] = useState(account ? startText(account.openingBalance) : '');
  const [since, setSince] = useState(account?.openedOn ?? today());
  const [apr, setApr] = useState(account?.apr ? (account.apr / 100).toFixed(2) : '');
  const [min, setMin] = useState(account?.minPayment ? (account.minPayment / 100).toFixed(2) : '');
  const [due, setDue] = useState(account?.dueDay ? String(account.dueDay) : '');
  const [limit, setLimit] = useState(account?.creditLimit ? String(Math.round(account.creditLimit / 100)) : '');

  if (!account) {
    return (
      <SheetScreen>
        <SheetHeader title="Account" />
        <Text variant="callout" tone="textSecondary" align="center">
          This account doesn’t exist anymore.
        </Text>
      </SheetScreen>
    );
  }

  // Only types of the same family: a bank account can't turn into a debt or back.
  const kinds = KINDS.filter((k) => isCashAccount({ kind: k.value }) === cash);
  const mine = transactions.filter((t) => t.accountId === id);
  // The starting balance comes before everything in the account, so it can't be dated after the first transaction.
  const firstTxn = mine.reduce<string | null>((a, t) => (a === null || t.date < a ? t.date : a), null);
  const latestStart = firstTxn && firstTxn < today() ? firstTxn : today();
  const hasReconciled = mine.some((t) => t.reconciled);

  const startCents = parseMoney(start);
  const opening = startCents === null ? null : cash ? startCents : -Math.abs(startCents);
  const change = opening === null ? 0 : opening - account.openingBalance;
  const dueDay = due ? Number(due) : undefined;
  const dueInvalid = dueDay !== undefined && (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31);
  const trimmed = name.trim();
  const valid = !!trimmed && opening !== null && !dueInvalid;

  const save = () => {
    if (!valid || opening === null) return;
    updateAccount(id, {
      name: trimmed,
      kind,
      openingBalance: opening,
      openedOn: since > latestStart ? latestStart : since,
      ...(cash
        ? {}
        : {
            apr: apr ? Math.round(parseFloat(apr) * 100) : undefined,
            minPayment: parseMoney(min) ?? undefined,
            dueDay,
            // Only cards have a limit; switching to a loan clears it.
            creditLimit: kind === 'credit_card' ? (parseMoney(limit) ?? undefined) : undefined,
          }),
    });
    haptic('success');
    closeSheet();
  };

  const effect =
    change === 0
      ? null
      : cash
        ? `Ready to assign goes ${change > 0 ? 'up' : 'down'} ${formatMoney(Math.abs(change))}, and so does the balance.`
        : `What you owe goes ${change < 0 ? 'up' : 'down'} ${formatMoney(Math.abs(change))}.`;

  return (
    <SheetScreen>
      <SheetHeader title="Edit account" />
      <FormCard>
        <InputRow
          label="Name"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={save}
        />
        <Dropdown variant="row" label="Type" value={kind} options={kinds} onChange={setKind} />
      </FormCard>

      <FormCard>
        <AmountRow
          label={cash ? 'Starting balance' : 'Owed at the start'}
          value={start}
          onChange={setStart}
          negative={cash}
        />
        <DateRow label="As of" value={since} onChange={setSince} max={latestStart} />
      </FormCard>

      {!cash && (
        <FormCard>
          {kind === 'credit_card' && (
            <AmountRow label="Credit limit" value={limit} onChange={setLimit} mode="whole" placeholder="Not set" />
          )}
          <AmountRow label="Interest rate" value={apr} onChange={setApr} unit="percent" placeholder="24.99%" />
          <AmountRow label="Minimum payment" value={min} onChange={setMin} placeholder="Estimated" />
          <AmountRow
            label={dueInvalid ? 'Due day (1 to 31)' : 'Due day'}
            value={due}
            onChange={setDue}
            mode="whole"
            unit="number"
            placeholder="Not set"
          />
        </FormCard>
      )}

      <View style={{ gap: spacing.xs, paddingHorizontal: spacing.xs }}>
        <Text variant="footnote" tone="textSecondary">
          {firstTxn
            ? `The starting balance is what the account held before its first transaction here (${formatShortDate(firstTxn)}).`
            : 'The starting balance is what the account held when you added it.'}
        </Text>
        {effect && (
          <Text variant="footnote" weight="600" tone="accent">
            {effect}
            {hasReconciled ? ' Your reconciled balance moves too, so reconcile again after this.' : ''}
          </Text>
        )}
      </View>

      <Button title="Save" size="lg" disabled={!valid} onPress={save} />
    </SheetScreen>
  );
}
