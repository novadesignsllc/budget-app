import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { DateField } from '@/components/date-field';
import { Field } from '@/components/field';
import { SheetScreen } from '@/components/screen';
import { Text } from '@/components/text';
import { today } from '@/domain/dates';
import { formatMoney, parseMoney } from '@/domain/money';
import { isCashAccount } from '@/domain/types';
import { useAccounts, useLedger } from '@/hooks/use-ledger';
import { useStore } from '@/store';
import { spacing } from '@/theme';
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

  return (
    <SheetScreen>
      <Text variant="title">{isPayment ? `Pay ${to!.name}` : 'Transfer'}</Text>

      <View style={{ gap: spacing.sm }}>
        <Text variant="footnote" weight="500" tone="textSecondary" style={{ paddingHorizontal: spacing.xs }}>
          From
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {cash.map((a) => (
            <Chip key={a.id} label={a.name} selected={a.id === fromId} onPress={() => setFromId(a.id)} />
          ))}
        </View>
      </View>

      {!toParam && (
        <View style={{ gap: spacing.sm }}>
          <Text variant="footnote" weight="500" tone="textSecondary" style={{ paddingHorizontal: spacing.xs }}>
            To
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {all
              .filter((a) => a.id !== fromId)
              .map((a) => (
                <Chip key={a.id} label={a.name} selected={a.id === toId} onPress={() => setToId(a.id)} />
              ))}
          </View>
        </View>
      )}

      <Field
        label="Amount"
        value={amountText}
        onChangeText={setAmountText}
        placeholder="0.00"
        keyboardType="decimal-pad"
        inputMode="decimal"
        hint={
          isPayment
            ? `Comes out of the ${to!.name} payment envelope, which has ${formatMoney(ready)}.`
            : 'Moving money between your own accounts doesn’t change your budget.'
        }
        error={isPayment && amount && amount > ready ? `That's ${formatMoney(amount - ready)} more than the envelope has. It'll go negative.` : undefined}
      />
      <DateField label="Date" value={date} onChange={setDate} />

      <Button
        title={isPayment ? `Pay ${amount ? formatMoney(amount) : ''}`.trim() : 'Transfer'}
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
