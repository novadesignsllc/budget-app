import { useState } from 'react';

import { Button } from '@/components/button';
import { DateRow } from '@/components/date-picker';
import { Dropdown, type DropdownOption } from '@/components/dropdown';
import { AmountHero, FormCard } from '@/components/form';
import { SheetScreen } from '@/components/screen';
import { today } from '@/domain/dates';
import { formatMoney, parseMoney } from '@/domain/money';
import { isCashAccount, type Account } from '@/domain/types';
import { useAccounts, useLedger } from '@/hooks/use-ledger';
import { SheetHeader } from '@/components/sheet-header';
import { useStore } from '@/store';
import { closeSheet } from '@/utils/close-sheet';
import { haptic } from '@/utils/haptics';

/** Moves money between accounts. Paying a debt is a transfer from cash to that debt. */
export function Transfer({ from: fromParam, to: toParam }: { from?: string; to?: string }) {
  const ledger = useLedger();
  const { cash, all } = useAccounts();
  const envelopes = useStore((s) => s.envelopes);
  const transfer = useStore((s) => s.transfer);
  const [fromId, setFromId] = useState(fromParam ?? cash[0]?.id);
  const [toId, setToId] = useState(toParam ?? all.find((a) => a.id !== (fromParam ?? cash[0]?.id))?.id);
  const to = all.find((a) => a.id === toId);
  const isPayment = !!to && !isCashAccount(to);
  const envelope = isPayment ? envelopes.find((e) => e.debtAccountId === to!.id) : undefined;
  const ready = envelope ? (ledger.available.get(envelope.id) ?? 0) : 0;
  const [amountText, setAmountText] = useState(isPayment && ready > 0 ? (ready / 100).toFixed(2) : '');
  const [date, setDate] = useState(today());
  const amount = parseMoney(amountText);

  const valid = !!fromId && !!toId && fromId !== toId && !!amount && amount > 0;

  const option = (a: Account): DropdownOption<string> => {
    const balance = ledger.balance.get(a.id) ?? 0;
    const debt = !isCashAccount(a);
    return {
      value: a.id,
      label: a.name,
      face: a.order,
      detail: debt ? `${formatMoney(-balance)} owed` : formatMoney(balance),
      section: debt ? 'Debts' : 'Accounts',
    };
  };
  const toOptions = [...all.filter(isCashAccount), ...all.filter((a) => !isCashAccount(a))]
    .filter((a) => a.id !== fromId)
    .map(option);

  return (
    <SheetScreen>
      <SheetHeader title={isPayment ? `Pay ${to!.name}` : 'Transfer'} />

      <AmountHero
        value={amountText}
        onChangeText={setAmountText}
        autoFocus
        tone={isPayment && amount && amount > ready ? 'negative' : undefined}
      />

      <FormCard>
        <Dropdown
          variant="row"
          label="From"
          value={fromId}
          options={cash.map(option)}
          onChange={(v) => {
            setFromId(v);
            if (v === toId) setToId(undefined);
          }}
        />
        <Dropdown variant="row" label="To" value={toId} options={toOptions} onChange={setToId} placeholder="Choose" />
        <DateRow label="Date" value={date} onChange={setDate} max={today()} last />
      </FormCard>

      <Button
        title={isPayment ? `Pay ${amount ? formatMoney(amount) : ''}`.trim() : amount ? `Move ${formatMoney(amount)}` : 'Transfer'}
        size="lg"
        disabled={!valid}
        onPress={() => {
          if (!valid || !amount) return;
          transfer({ fromAccountId: fromId!, toAccountId: toId!, amount, date, envelopeId: envelope?.id });
          haptic('success');
          closeSheet();
        }}
      />
    </SheetScreen>
  );
}
