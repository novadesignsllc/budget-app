import { useRef, useState } from 'react';
import { TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Dropdown, type DropdownOption } from '@/components/dropdown';
import { Field } from '@/components/field';
import { SheetScreen } from '@/components/screen';
import { parseMoney } from '@/domain/money';
import type { AccountKind, CashKind, DebtKind } from '@/domain/types';
import { SheetHeader } from '@/components/sheet-header';
import { useStore } from '@/store';
import { spacing } from '@/theme';
import { closeSheet } from '@/utils/close-sheet';
import { haptic } from '@/utils/haptics';

type Family = 'spending' | 'debt';

const FAMILIES: DropdownOption<Family>[] = [
  { value: 'spending', label: 'Spending account' },
  { value: 'debt', label: 'Debt account' },
];
const SPENDING: DropdownOption<CashKind>[] = [
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
  { value: 'cash', label: 'Cash' },
];
const DEBT: DropdownOption<DebtKind>[] = [
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
  const balanceRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const minRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const dueRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const valid = !!name.trim() && cents !== null && !dueInvalid && (isCash || cents >= 0);

  return (
    <SheetScreen>
      <SheetHeader title={isCash ? 'New account' : 'New debt'} />

      <Field
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder={isCash ? 'Main Checking' : 'Chase Freedom'}
        autoFocus
        autoCapitalize="words"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => balanceRef.current?.focus()}
      />
      <Field
        ref={balanceRef}
        returnKeyType="done"
        label={isCash ? 'Balance today' : 'Amount owed today'}
        value={balance}
        onChangeText={setBalance}
        placeholder="0.00"
        keyboardType="decimal-pad"
        inputMode="decimal"
      />
      <Dropdown label="Type" value={family} options={FAMILIES} onChange={setFamily} />
      {isCash ? (
        <Dropdown label="Spending account" value={spendingKind} options={SPENDING} onChange={setSpendingKind} />
      ) : (
        <Dropdown label="Debt account" value={debtKind} options={DEBT} onChange={setDebtKind} />
      )}


      {!isCash && (
        <>
          <Field
            label="Interest rate (APR %)"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => minRef.current?.focus()}
            value={apr}
            onChangeText={setApr}
            placeholder="24.99"
            keyboardType="decimal-pad"
            inputMode="decimal"
          />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Field
                ref={minRef}
                label="Minimum"
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => dueRef.current?.focus()}
                optional
                value={min}
                onChangeText={setMin}
                placeholder="Estimated"
                keyboardType="decimal-pad"
                inputMode="decimal"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                ref={dueRef}
                label="Due day"
                returnKeyType="done"
                optional
                value={dueDay}
                onChangeText={setDueDay}
                placeholder="15"
                keyboardType="number-pad"
                inputMode="numeric"
                error={dueInvalid ? 'Pick 1 to 31.' : undefined}
              />
            </View>
          </View>
        </>
      )}

      <Button
        title={isCash ? 'Add account' : 'Add debt'}
        size="lg"
        disabled={!valid}
        style={{ marginTop: spacing.xs }}
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
