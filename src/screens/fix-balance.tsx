import { useState } from 'react';

import { Button } from '@/components/button';
import { AmountHero, FormCard, FormRow } from '@/components/form';
import { Money } from '@/components/money';
import { SheetScreen } from '@/components/screen';
import { SheetHeader } from '@/components/sheet-header';
import { Text } from '@/components/text';
import { useToast } from '@/components/toast';
import { formatMoney, parseMoney } from '@/domain/money';
import { useLedger } from '@/hooks/use-ledger';
import { useStore } from '@/store';
import { closeSheet } from '@/utils/close-sheet';
import { haptic } from '@/utils/haptics';

/**
 * Fixes a wrong balance: type what the account really has, and the difference posts as an
 * "Error adjustment" with no envelope, so it lands in (or comes out of) Ready to assign.
 */
export function FixBalance({ id }: { id: string }) {
  const ledger = useLedger();
  const account = useStore((s) => s.accounts.find((a) => a.id === id));
  const addAdjustment = useStore((s) => s.addAdjustment);
  const showToast = useToast((s) => s.show);
  const [text, setText] = useState('');

  if (!account) return null;
  const current = ledger.balance.get(id) ?? 0;
  const correct = parseMoney(text);
  const diff = correct === null ? null : correct - current;

  function save() {
    if (diff === null) return;
    if (diff !== 0) addAdjustment(id, diff, { fix: true });
    haptic('success');
    showToast({
      message: diff === 0 ? `${account!.name} was already right.` : `${account!.name} is now ${formatMoney(correct!)}.`,
    });
    closeSheet();
  }

  return (
    <SheetScreen>
      <SheetHeader title="Error adjustment" />
      <AmountHero
        caption="Correct balance"
        value={text}
        onChangeText={setText}
        placeholder={formatMoney(current)}
        allowNegative
        autoFocus
      />
      <FormCard>
        <FormRow label="In the app">
          <Money cents={current} weight="500" />
        </FormRow>
        <FormRow label="Adjustment">
          {diff === null ? (
            <Text variant="body" tone="textTertiary">
              —
            </Text>
          ) : (
            <Money cents={diff} weight="600" signed={diff !== 0} tone="auto" />
          )}
        </FormRow>
      </FormCard>
      <Button
        title={
          diff === null ? 'Type the correct balance' : diff === 0 ? 'Done' : `Adjust by ${formatMoney(diff, { signed: true })}`
        }
        size="lg"
        disabled={diff === null}
        onPress={save}
      />
    </SheetScreen>
  );
}
