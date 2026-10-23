import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { Field } from '@/components/field';
import { Section } from '@/components/list';
import { Money } from '@/components/money';
import { SheetScreen } from '@/components/screen';
import { Text } from '@/components/text';
import { formatShortDate, today } from '@/domain/dates';
import { formatMoney, parseMoney } from '@/domain/money';
import { useLedger } from '@/hooks/use-ledger';
import { useStore } from '@/store';
import { spacing } from '@/theme';
import { closeSheet } from '@/utils/close-sheet';
import { haptic } from '@/utils/haptics';

/**
 * Weekly check: does the app's balance match the bank? If not, mark what's still
 * pending at the bank, and whatever difference remains is posted as an adjustment.
 */
export function Reconcile({ id }: { id: string }) {
  const ledger = useLedger();
  const account = useStore((s) => s.accounts.find((a) => a.id === id));
  const transactions = useStore((s) => s.transactions);
  const reconcile = useStore((s) => s.reconcile);
  const [mode, setMode] = useState<'ask' | 'fix'>('ask');
  const [bankText, setBankText] = useState('');
  const [pending, setPending] = useState<string[]>([]);

  const uncleared = useMemo(
    () =>
      transactions
        .filter((t) => t.accountId === id && !t.cleared && t.date <= today())
        .sort((a, b) => b.date.localeCompare(a.date)),
    [transactions, id],
  );

  if (!account) return null;
  const balance = ledger.balance.get(id) ?? 0;
  const bank = parseMoney(bankText);
  const pendingTotal = uncleared.filter((t) => pending.includes(t.id)).reduce((a, t) => a + t.amount, 0);
  const expected = balance - pendingTotal;
  const diff = bank === null ? null : bank - expected;

  function finish(bankBalance: number, pendingIds: string[]) {
    reconcile(id, bankBalance, pendingIds);
    haptic('success');
    closeSheet();
  }

  if (mode === 'ask') {
    return (
      <SheetScreen>
        <View style={{ gap: spacing.xs }}>
          <Text variant="callout" weight="500" tone="textSecondary">
            Does your bank app say
          </Text>
          <Money cents={balance} variant="display" />
          <Text variant="callout" tone="textSecondary">
            for {account.name}?
          </Text>
        </View>
        <Button title="Yes, it matches" size="lg" onPress={() => finish(balance, [])} />
        <Button title="No, it's different" size="lg" variant="secondary" onPress={() => setMode('fix')} />
      </SheetScreen>
    );
  }

  return (
    <SheetScreen>
      <Text variant="title">What does the bank say?</Text>
      <Field
        label="Bank balance"
        value={bankText}
        onChangeText={setBankText}
        placeholder={(balance / 100).toFixed(2)}
        keyboardType="numbers-and-punctuation"
        inputMode="decimal"
        autoFocus
      />

      {uncleared.length > 0 && (
        <Section
          title="Still pending at the bank?"
          footer="Tap anything the bank hasn't posted yet. It stays in your balance here but is left out of the comparison."
        >
          {uncleared.map((t) => {
            const isPending = pending.includes(t.id);
            return (
              <View
                key={t.id}
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg }}
              >
                <View style={{ flex: 1 }}>
                  <Text variant="body" numberOfLines={1}>
                    {t.payee}
                  </Text>
                  <Text variant="footnote" tone="textSecondary">
                    {formatShortDate(t.date)} · {formatMoney(t.amount, { signed: true })}
                  </Text>
                </View>
                <Chip
                  label={isPending ? 'Pending' : 'Posted'}
                  selected={isPending}
                  onPress={() => setPending((p) => (isPending ? p.filter((x) => x !== t.id) : [...p, t.id]))}
                />
              </View>
            );
          })}
        </Section>
      )}

      {diff !== null && (
        <Text variant="callout" tone={diff === 0 ? 'positive' : 'textSecondary'}>
          {diff === 0
            ? 'That matches.'
            : `Off by ${formatMoney(Math.abs(diff))}. Look for a missing transaction first. If you can't find it, save and the app adds a ${formatMoney(diff, { signed: true })} adjustment to Ready to assign.`}
        </Text>
      )}

      <Button
        title={diff === null ? 'Enter the bank balance' : diff === 0 ? 'Mark as checked' : 'Save with adjustment'}
        size="lg"
        disabled={bank === null}
        onPress={() => bank !== null && finish(bank, pending)}
      />
    </SheetScreen>
  );
}
