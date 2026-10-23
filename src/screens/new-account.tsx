import { useRef, useState } from 'react';
import { TextInput } from 'react-native';

import { Button } from '@/components/button';
import { Dropdown, type DropdownOption } from '@/components/dropdown';
import { FormCard, InputRow } from '@/components/form';
import { SheetScreen } from '@/components/screen';
import { parseMoney } from '@/domain/money';
import type { AccountKind, CashKind } from '@/domain/types';
import { SheetHeader } from '@/components/sheet-header';
import { useStore } from '@/store';
import { useColors } from '@/theme';
import { closeSheet } from '@/utils/close-sheet';
import { haptic } from '@/utils/haptics';

const CASH_KINDS: CashKind[] = ['checking', 'savings', 'cash'];

/** One Type list: bank accounts first, then debts. */
const KINDS: DropdownOption<AccountKind>[] = [
  { value: 'checking', label: 'Checking', section: 'Accounts' },
  { value: 'savings', label: 'Savings', section: 'Accounts' },
  { value: 'cash', label: 'Cash', section: 'Accounts' },
  { value: 'credit_card', label: 'Credit card', section: 'Debts' },
  { value: 'auto_loan', label: 'Car loan', section: 'Debts' },
  { value: 'student_loan', label: 'Student loan', section: 'Debts' },
  { value: 'mortgage', label: 'Mortgage', section: 'Debts' },
  { value: 'personal_loan', label: 'Personal loan', section: 'Debts' },
  { value: 'medical', label: 'Medical', section: 'Debts' },
  { value: 'other_debt', label: 'Other debt', section: 'Debts' },
];

export function NewAccount({ debt }: { debt?: boolean }) {
  const colors = useColors();
  const addAccount = useStore((s) => s.addAccount);
  const [kind, setKind] = useState<AccountKind>(debt ? 'credit_card' : 'checking');
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [apr, setApr] = useState('');
  const [min, setMin] = useState('');
  const [dueDay, setDueDay] = useState('');

  const isCash = (CASH_KINDS as AccountKind[]).includes(kind);
  const cents = parseMoney(balance);
  const due = dueDay ? Number(dueDay) : undefined;
  const dueInvalid = due !== undefined && (!Number.isInteger(due) || due < 1 || due > 31);
  const balanceRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const minRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const dueRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const aprRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const valid = !!name.trim() && cents !== null && !dueInvalid && (isCash || cents >= 0);

  return (
    <SheetScreen>
      <SheetHeader title={isCash ? 'New account' : 'New debt'} />

      <FormCard>
        <InputRow
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
        <InputRow
          ref={balanceRef}
          label={isCash ? 'Balance today' : 'Owed today'}
          value={balance}
          onChangeText={setBalance}
          placeholder="0.00"
          keyboardType="decimal-pad"
          inputMode="decimal"
          returnKeyType={isCash ? 'done' : 'next'}
          submitBehavior={isCash ? undefined : 'submit'}
          onSubmitEditing={isCash ? undefined : () => aprRef.current?.focus()}
        />
        <Dropdown variant="row" label="Type" value={kind} options={KINDS} onChange={setKind} />
        {!isCash && (
          <InputRow
            ref={aprRef}
            label="APR %"
            value={apr}
            onChangeText={setApr}
            placeholder="24.99"
            keyboardType="decimal-pad"
            inputMode="decimal"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => minRef.current?.focus()}
          />
        )}
        {!isCash && (
          <InputRow
            ref={minRef}
            label="Minimum"
            value={min}
            onChangeText={setMin}
            placeholder="Estimated"
            keyboardType="decimal-pad"
            inputMode="decimal"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => dueRef.current?.focus()}
          />
        )}
        {!isCash && (
          <InputRow
            ref={dueRef}
            label="Due day"
            value={dueDay}
            onChangeText={setDueDay}
            placeholder="15"
            keyboardType="number-pad"
            inputMode="numeric"
            returnKeyType="done"
            style={dueInvalid ? { color: colors.negative } : undefined}
          />
        )}
      </FormCard>

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
