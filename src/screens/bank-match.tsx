import { useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { LinkedMark } from '@/components/bank';
import { Card, CardHeader } from '@/components/card';
import { SheetScreen } from '@/components/screen';
import { SheetHeader } from '@/components/sheet-header';
import { Text } from '@/components/text';
import { useToast } from '@/components/toast';
import { DateBlock } from '@/components/transaction-row';
import { daysBetween, formatShortDate } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import { useStore } from '@/store';
import { spacing, useColors } from '@/theme';
import { closeSheet } from '@/utils/close-sheet';
import { haptic } from '@/utils/haptics';

/**
 * Links a bank transaction to one you entered when Slip didn't find it on its own: the
 * same account and direction, within two weeks, closest first. The bank's amount wins.
 */
export function BankMatch({ id }: { id: string }) {
  const colors = useColors();
  const bank = useStore((s) => s.bankTransactions.find((b) => b.id === id));
  const account = useStore((s) => s.accounts.find((a) => a.id === bank?.accountId));
  const transactions = useStore((s) => s.transactions);
  const linkBank = useStore((s) => s.linkBank);
  const restoreBank = useStore((s) => s.restoreBank);
  const showToast = useToast((s) => s.show);

  const options = useMemo(() => {
    if (!bank) return [];
    return transactions
      .filter(
        (t) =>
          t.accountId === bank.accountId &&
          !t.bankId &&
          t.kind !== 'adjustment' &&
          Math.sign(t.amount) === Math.sign(bank.amount) &&
          Math.abs(daysBetween(t.date, bank.date)) <= 14,
      )
      .sort(
        (a, b) =>
          Math.abs(a.amount - bank.amount) - Math.abs(b.amount - bank.amount) ||
          Math.abs(daysBetween(a.date, bank.date)) - Math.abs(daysBetween(b.date, bank.date)),
      );
  }, [bank, transactions]);

  if (!bank) {
    return (
      <SheetScreen>
        <SheetHeader title="Link" />
        <Card padded>
          <Text variant="callout" tone="textSecondary">
            This bank transaction is gone.
          </Text>
        </Card>
      </SheetScreen>
    );
  }

  return (
    <SheetScreen>
      <SheetHeader title="Link to one you entered" />
      <Card padded>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <LinkedMark size={13} color={colors.accent} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="body" weight="600" numberOfLines={1}>
              {bank.name}
            </Text>
            <Text variant="footnote" tone="textSecondary" numberOfLines={1}>
              {formatShortDate(bank.date)} · {account?.name ?? ''}
              {bank.pending ? ' · Pending' : ''}
            </Text>
          </View>
          <Text variant="body" weight="600" tone={bank.amount < 0 ? 'negative' : 'positive'} style={{ fontVariant: ['tabular-nums'] }}>
            {formatMoney(bank.amount, { signed: bank.amount > 0 })}
          </Text>
        </View>
      </Card>
      <Card>
        <CardHeader title="Yours" detail="Two weeks either side" />
        {options.length === 0 ? (
          <Text variant="callout" tone="textSecondary" style={{ padding: spacing.md + 2 }}>
            Nothing close to this in {account?.name ?? 'this account'}. Approve it from Home instead.
          </Text>
        ) : (
          options.map((t, i) => (
            <Pressable
              key={t.id}
              accessibilityRole="button"
              accessibilityLabel={`Link to ${t.payee}, ${formatMoney(t.amount)}, ${formatShortDate(t.date)}`}
              onPress={() => {
                linkBank(bank.id, t.id);
                haptic('success');
                showToast({ message: `Linked to your ${t.payee}`, actionLabel: 'Undo', onAction: () => restoreBank(bank.id) });
                closeSheet();
              }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                minHeight: 46,
                paddingHorizontal: spacing.md,
                borderBottomWidth: i === options.length - 1 ? 0 : 1,
                borderBottomColor: colors.hairline,
                backgroundColor: pressed ? colors.control : colors.surface,
              })}
            >
              <DateBlock date={t.date} />
              <Text variant="row" weight="600" numberOfLines={1} style={{ flex: 1 }}>
                {t.payee}
              </Text>
              <Text variant="row" tone={t.amount < 0 ? 'negative' : 'positive'} style={{ fontVariant: ['tabular-nums'] }}>
                {formatMoney(t.amount, { signed: t.amount > 0 })}
              </Text>
            </Pressable>
          ))
        )}
      </Card>
    </SheetScreen>
  );
}
