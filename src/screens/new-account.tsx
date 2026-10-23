import { useState } from 'react';

import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { SheetScreen } from '@/components/screen';
import { Select, type SelectOption } from '@/components/select';
import { Text } from '@/components/text';
import { parseMoney } from '@/domain/money';
import type { AccountKind, CashKind, DebtKind } from '@/domain/types';
import { useStore } from '@/store';
import { closeSheet } from '@/utils/close-sheet';
import { haptic } from '@/utils/haptics';

type Family = 'spending' | 'debt';

const FAMILIES: SelectOption<Family>[] = [
  { value: 'spending', label: 'Spending account' },
  { value: 'debt', label: 'Debt account' },
];
const SPENDING: SelectOption<CashKind>[] = [
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
  { value: 'cash', label: 'Cash' },
];
const DEBT: SelectOption<DebtKind>[] = [
  { value: 'credit_card', label: 'Credit card' },
  { value: 'auto_loan', label: 'Car loan' },
  { value: 'student_loan', label: 'Student loan' },
  { value: 'mortgage', label: 'Mortgage' },
  { value: 'personal_loan', label: 'Personal loan' },
  { value: 'medical', label: 'Medical' },
  { value: 'other_debt', label: 'Other debt' },
];

export function NewAccount({ debt }: { debt?: boolean }) {
  const addAccount = useStore((s) => s.addAccount);
  const [family, setFamily] = useState<Family>(debt ? 'debt' : 'spending');
  const [spendingKind, setSpendingKind] = useState<CashKind>('checking');
  const [debtKind, setDebtKind] = useState<DebtKind>('credit_card');
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [apr, setApr] = useState('');
  const [min, setMin] = useState('');
  const [dueDay, setDueDay] = useState('');

  const isCash = family === 'spending';
  const kind: AccountKind = isCash ? spendingKind : debtKind;
  const cents = parseMoney(balance);
  const due = dueDay ? Number(dueDay) : undefined;
  const dueInvalid = due !== undefined && (!Number.isInteger(due) || due < 1 || due > 31);
  const valid = !!name.trim() && cents !== null && !dueInvalid && (isCash || cents >= 0);

  return (
    <SheetScreen contentContainerStyle={{ gap: 18 }}>
      <Text variant="title">{isCash ? 'New account' : 'New debt'}</Text>

      <Field
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder={isCash ? 'Main Checking' : 'Chase Visa'}
        autoFocus
      />
      <Field
        label={isCash ? 'Balance today' : 'Amount owed today'}
        hint={isCash ? 'Copy it from your bank app.' : 'Copy it from the lender or card app.'}
        value={balance}
        onChangeText={setBalance}
        placeholder="0.00"
        keyboardType="decimal-pad"
        inputMode="decimal"
      />
      <Select label="Type" value={family} options={FAMILIES} onChange={setFamily} />
      {isCash ? (
        <Select label="Spending account" value={spendingKind} options={SPENDING} onChange={setSpendingKind} />
      ) : (
        <Select label="Debt account" value={debtKind} options={DEBT} onChange={setDebtKind} />
      )}

      {kind === 'credit_card' && (
        <Text variant="callout" tone="textSecondary">
          Cards are debt here, not a way to pay. Anything you put on one is logged as a slip and marked red.
        </Text>
      )}

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
            optional
            hint="Leave it blank and the app estimates it."
            value={min}
            onChangeText={setMin}
            placeholder="0.00"
            keyboardType="decimal-pad"
            inputMode="decimal"
          />
          <Field
            label="Due day of the month"
            optional
            value={dueDay}
            onChangeText={setDueDay}
            placeholder="15"
            keyboardType="number-pad"
            inputMode="numeric"
            error={dueInvalid ? 'Pick a day from 1 to 31.' : undefined}
          />
        </>
      )}

      <Button
        title={isCash ? 'Add account' : 'Add debt'}
        size="lg"
        disabled={!valid}
        onPress={() => {
          if (!valid || cents === null) return;
          addAccount({
            name,
            kind,
            balance: cents,
            apr: apr ? Math.round(parseFloat(apr) * 100) : undefined,
            minPayment: parseMoney(min) ?? undefined,
            dueDay: due,
          });
          haptic('success');
          closeSheet();
        }}
      />
    </SheetScreen>
  );
}
