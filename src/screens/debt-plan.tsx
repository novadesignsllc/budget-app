import { useMemo, useState } from 'react';

import { Button } from '@/components/button';
import { AmountHero, FormCard, FormRow } from '@/components/form';
import { Money } from '@/components/money';
import { SheetScreen } from '@/components/screen';
import { Text } from '@/components/text';
import { comparePlan } from '@/domain/debt';
import { formatMoney, parseMoney } from '@/domain/money';
import { useDebtPlan } from '@/hooks/use-ledger';
import { payoffLabel } from '@/screens/debt';
import { SheetHeader } from '@/components/sheet-header';
import { useStore } from '@/store';
import { closeSheet } from '@/utils/close-sheet';
import { haptic } from '@/utils/haptics';

/** The monthly amount that goes to debt. Previews the payoff date as you type. */
export function DebtPlan() {
  const strategy = useStore((s) => s.settings.debtStrategy);
  const updateSettings = useStore((s) => s.updateSettings);
  const { inputs, minimums, monthly } = useDebtPlan();
  const [text, setText] = useState((monthly / 100).toFixed(2));
  const amount = parseMoney(text);
  const below = amount !== null && amount < minimums;

  const preview = useMemo(
    () => (amount !== null && inputs.length && !below ? comparePlan(inputs, amount, strategy) : null),
    [amount, inputs, strategy, below],
  );

  const save = () => {
    if (amount === null || below) return;
    updateSettings({ monthlyDebtPayment: amount });
    haptic('success');
    closeSheet();
  };

  return (
    <SheetScreen>
      <SheetHeader title="Debt payment" />
      <AmountHero
        caption="Each month"
        value={text}
        onChangeText={setText}
        placeholder={formatMoney(minimums)}
        autoFocus
        tone={below ? 'negative' : undefined}
      />
      <FormCard>
        <FormRow label="Minimums">
          <Money cents={minimums} weight="500" tone={below ? 'negative' : 'text'} />
        </FormRow>
        <FormRow label="Debt-free by">
          <Text variant="body" weight="600" tone={!preview || preview.plan.months == null ? 'negative' : 'text'}>
            {preview ? payoffLabel(preview.plan.months) : '—'}
          </Text>
        </FormRow>
        {preview && preview.interestSaved > 0 && (
          <FormRow label="Interest saved">
            <Money cents={preview.interestSaved} whole weight="500" tone="positive" />
          </FormRow>
        )}
      </FormCard>
      <Button
        title={amount !== null && !below ? `Save ${formatMoney(amount, { whole: amount % 100 === 0 })} a month` : 'Save'}
        size="lg"
        disabled={amount === null || below}
        onPress={save}
      />
    </SheetScreen>
  );
}
