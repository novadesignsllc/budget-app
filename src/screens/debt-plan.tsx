import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { SheetScreen } from '@/components/screen';
import { Text } from '@/components/text';
import { comparePlan } from '@/domain/debt';
import { formatMoney, parseMoney } from '@/domain/money';
import { useDebtPlan } from '@/hooks/use-ledger';
import { payoffLabel } from '@/screens/debt';
import { SheetHeader } from '@/components/sheet-header';
import { useStore } from '@/store';
import { spacing } from '@/theme';
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
      <Field
        label="Each month toward debt"
        value={text}
        onChangeText={setText}
        placeholder={(minimums / 100).toFixed(2)}
        keyboardType="decimal-pad"
        inputMode="decimal"
        selectTextOnFocus
        autoFocus
        onSubmitEditing={save}
        error={below ? `That’s less than your minimums. They add up to ${formatMoney(minimums)}.` : undefined}
      />
      {preview && (
        <View style={{ paddingHorizontal: 2, gap: 2 }}>
          <Text variant="callout">
            Debt-free by{' '}
            <Text variant="callout" weight="600" tone={preview.plan.months == null ? 'negative' : 'text'}>
              {payoffLabel(preview.plan.months)}
            </Text>
          </Text>
          {preview.interestSaved > 0 && (
            <Text variant="footnote" tone="positive">
              Saves {formatMoney(preview.interestSaved, { whole: true })} in interest
              {preview.monthsSaved ? ` and ${preview.monthsSaved} months` : ''} vs paying minimums.
            </Text>
          )}
        </View>
      )}
      <Button
        title={amount !== null && !below ? `Save ${formatMoney(amount, { whole: amount % 100 === 0 })} a month` : 'Save'}
        size="lg"
        disabled={amount === null || below}
        onPress={save}
        style={{ marginTop: spacing.xs }}
      />
    </SheetScreen>
  );
}
