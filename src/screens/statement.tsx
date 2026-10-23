import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { Money } from '@/components/money';
import { SheetScreen } from '@/components/screen';
import { Text } from '@/components/text';
import { expectedMonthlyInterest } from '@/domain/debt';
import { formatMoney, parseMoney } from '@/domain/money';
import { useLedger } from '@/hooks/use-ledger';
import { useStore } from '@/store';
import { spacing } from '@/theme';
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
      <Text variant="title">{account.name} statement</Text>
      <View style={{ gap: spacing.xs }}>
        <Text variant="callout" tone="textSecondary">
          The app has you owing
        </Text>
        <Money cents={tracked} variant="largeTitle" />
      </View>
      <Field
        label="Statement says you owe"
        value={text}
        onChangeText={setText}
        placeholder={(tracked / 100).toFixed(2)}
        keyboardType="decimal-pad"
        inputMode="decimal"
        autoFocus
      />
      {diff !== null && (
        <Text variant="callout" tone={diff > 0 ? 'negative' : 'textSecondary'}>
          {diff === 0
            ? 'Matches exactly. Nothing to add.'
            : diff > 0
              ? `${formatMoney(diff)} gets recorded as interest and fees.`
              : `The statement is ${formatMoney(-diff)} lower. That gets recorded as a correction.`}
        </Text>
      )}
      {unusual && (
        <Text variant="callout" tone="warning">
          At {((account.apr ?? 0) / 100).toFixed(2)}% APR, a month of interest should be about {formatMoney(expected)}. Check for a
          missing payment, slip, or fee.
        </Text>
      )}
      <Button
        title="Save"
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
