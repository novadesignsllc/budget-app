import { useState } from 'react';

import { Button } from '@/components/button';
import { AmountHero, FormCard, FormRow } from '@/components/form';
import { Money } from '@/components/money';
import { SheetScreen } from '@/components/screen';
import { Text } from '@/components/text';
import { expectedMonthlyInterest } from '@/domain/debt';
import { formatMoney, parseMoney } from '@/domain/money';
import { useLedger } from '@/hooks/use-ledger';
import { SheetHeader } from '@/components/sheet-header';
import { useStore } from '@/store';
import { closeSheet } from '@/utils/close-sheet';
import { haptic } from '@/utils/haptics';

/**
 * Monthly: type the statement balance. The app already knows the payments and slips,
 * so anything extra is interest or fees. No AI, just subtraction.
 */
export function Statement({ id }: { id: string }) {
  const ledger = useLedger();
  const account = useStore((s) => s.accounts.find((a) => a.id === id));
  const recordStatement = useStore((s) => s.recordStatement);
  const [text, setText] = useState('');
  if (!account) return null;

  const tracked = -(ledger.balance.get(id) ?? 0);
  const statement = parseMoney(text);
  const diff = statement === null ? null : statement - tracked;
  const expected = expectedMonthlyInterest(tracked, account.apr ?? 0);
  const unusual = diff !== null && diff > 0 && expected > 0 && (diff > expected * 1.5 + 500 || diff < expected * 0.5 - 500);

  return (
    <SheetScreen>
      <SheetHeader title={`${account.name} statement`} />

      <AmountHero
        caption="Statement balance"
        value={text}
        onChangeText={setText}
        placeholder={formatMoney(tracked)}
        autoFocus
      />

      <FormCard>
        <FormRow label="In the app">
          <Money cents={tracked} weight="500" />
        </FormRow>
        <FormRow label={diff !== null && diff < 0 ? 'Correction' : 'Interest and fees'}>
          {diff === null ? (
            <Text variant="body" tone="textTertiary">
              —
            </Text>
          ) : (
            <Money cents={Math.abs(diff)} weight="600" tone={diff > 0 ? 'negative' : 'text'} />
          )}
        </FormRow>
        {unusual && (
          <FormRow label="Usual interest" tone="negative">
            <Money cents={expected} weight="500" tone="negative" />
          </FormRow>
        )}
      </FormCard>

      <Button
        title={diff !== null && diff > 0 ? `Record ${formatMoney(diff)} interest` : 'Save'}
        size="lg"
        disabled={statement === null}
        onPress={() => {
          if (statement === null) return;
          recordStatement(id, statement, tracked);
          haptic('success');
          closeSheet();
        }}
      />
    </SheetScreen>
  );
}
