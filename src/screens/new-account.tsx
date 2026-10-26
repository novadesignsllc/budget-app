import { useRef, useState } from 'react';

import { Button } from '@/components/button';
import { Dropdown, type DropdownOption } from '@/components/dropdown';
import { AmountRow, FormCard, InputRow } from '@/components/form';
import type { KeypadFieldHandle } from '@/components/keypad';
import { SheetScreen } from '@/components/screen';
import { parseMoney } from '@/domain/money';
import type { AccountKind, CashKind } from '@/domain/types';
import { SheetHeader } from '@/components/sheet-header';
import { useStore } from '@/store';
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
  const balanceRef = useRef<KeypadFieldHandle>(null);
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
        <AmountRow
          ref={balanceRef}
          label={isCash ? 'Balance today' : 'Owed today'}
          value={balance}
          onChange={setBalance}
          negative={isCash}
        />
        <Dropdown variant="row" label="Type" value={kind} options={KINDS} onChange={setKind} />
        {!isCash && (
          <AmountRow label="APR" value={apr} onChange={setApr} unit="percent" placeholder="24.99%" />
        )}
        {!isCash && (
          <AmountRow label="Minimum" value={min} onChange={setMin} placeholder="Estimated" />
        )}
        {!isCash && (
          <AmountRow
            label={dueInvalid ? 'Due day (1 to 31)' : 'Due day'}
            value={dueDay}
            onChange={setDueDay}
            mode="whole"
            unit="number"
            placeholder="15"
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
