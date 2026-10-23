import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { Field } from '@/components/field';
import { SheetScreen } from '@/components/screen';
import { Text } from '@/components/text';
import { parseMoney } from '@/domain/money';
import { isCashAccount, type AccountKind } from '@/domain/types';
import { useStore } from '@/store';
import { spacing } from '@/theme';
import { closeSheet } from '@/utils/close-sheet';
import { haptic } from '@/utils/haptics';

const CASH: { kind: AccountKind; label: string }[] = [
  { kind: 'checking', label: 'Checking' },
  { kind: 'savings', label: 'Savings' },
  { kind: 'cash', label: 'Cash' },
];
const DEBT: { kind: AccountKind; label: string }[] = [
  { kind: 'credit_card', label: 'Credit card' },
  { kind: 'auto_loan', label: 'Car loan' },
  { kind: 'student_loan', label: 'Student loan' },
  { kind: 'mortgage', label: 'Mortgage' },
  { kind: 'personal_loan', label: 'Personal loan' },
  { kind: 'medical', label: 'Medical' },
  { kind: 'other_debt', label: 'Other debt' },
];

export function NewAccount({ debt }: { debt?: boolean }) {
  const addAccount = useStore((s) => s.addAccount);
  const [kind, setKind] = useState<AccountKind>(debt ? 'credit_card' : 'checking');
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [apr, setApr] = useState('');
  const [min, setMin] = useState('');
  const [dueDay, setDueDay] = useState('');

  const isCash = isCashAccount({ kind });
  const cents = parseMoney(balance);
  const aprBps = apr ? Math.round(parseFloat(apr) * 100) : undefined;
  const due = dueDay ? Number(dueDay) : undefined;
  const dueInvalid = due !== undefined && (!Number.isInteger(due) || due < 1 || due > 31);
  const valid = name.trim() && cents !== null && !dueInvalid && (isCash || cents >= 0);

  function save() {
    if (!valid || cents === null) return;
    const id = addAccount({
      name,
      kind,
      balance: cents,
      apr: aprBps,
      minPayment: parseMoney(min) ?? undefined,
      dueDay: due,
    });
    haptic('success');
    closeSheet();
    return id;
  }

  return (
    <SheetScreen>
      <Text variant="title">{isCash ? 'New account' : 'New debt'}</Text>

      <View style={{ gap: spacing.sm }}>
        <Text variant="footnote" weight="500" tone="textSecondary" style={{ paddingHorizontal: spacing.xs }}>
          Money you spend from
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {CASH.map((k) => (
            <Chip key={k.kind} label={k.label} selected={kind === k.kind} onPress={() => setKind(k.kind)} />
          ))}
        </View>
        <Text variant="footnote" weight="500" tone="textSecondary" style={{ paddingHorizontal: spacing.xs, marginTop: spacing.sm }}>
          Money you owe
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {DEBT.map((k) => (
            <Chip key={k.kind} label={k.label} selected={kind === k.kind} onPress={() => setKind(k.kind)} />
          ))}
        </View>
      </View>

      {kind === 'credit_card' && (
        <Text variant="callout" tone="textSecondary">
          Cards are debt here, not a way to pay. Anything you put on one gets logged as a slip and marked red.
        </Text>
      )}

      <Field label="Name" value={name} onChangeText={setName} placeholder={isCash ? 'Main Checking' : 'Chase Visa'} />
      <Field
        label={isCash ? 'Balance today' : 'Amount owed today'}
        hint={isCash ? 'Copy it from your bank app.' : 'Copy it from the lender or card app.'}
        value={balance}
        onChangeText={setBalance}
        placeholder="0.00"
        keyboardType="decimal-pad"
        inputMode="decimal"
      />

      {!isCash && (
        <>
          <Field
            label="Interest rate (APR %)"
            value={apr}
            onChangeText={setApr}
            placeholder="24.99"
            keyboardType="decimal-pad"
            inputMode="decimal"
          />
          <Field
            label="Minimum payment"
            hint="Leave blank and the app estimates it."
            value={min}
            onChangeText={setMin}
            placeholder="0.00"
            keyboardType="decimal-pad"
            inputMode="decimal"
          />
          <Field
            label="Due day of the month"
            value={dueDay}
            onChangeText={setDueDay}
            placeholder="15"
            keyboardType="number-pad"
            inputMode="numeric"
            error={dueInvalid ? 'Pick a day from 1 to 31.' : undefined}
          />
        </>
      )}

      <Button title={isCash ? 'Add account' : 'Add debt'} size="lg" disabled={!valid} onPress={save} />
    </SheetScreen>
  );
}
