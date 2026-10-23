import { View } from 'react-native';

import type { Account, Envelope, Transaction } from '@/domain/types';
import { radius, useColors } from '@/theme';

import { Icon } from './icon';
import { Row, RowIcon } from './list';
import { Money } from './money';
import { Text } from './text';

function Initial({ name }: { name: string }) {
  const colors = useColors();
  return (
    <View
      style={{
        width: 36,
        height: 36,
        borderRadius: radius.full,
        backgroundColor: colors.fill,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text variant="headline" tone="textSecondary">
        {(name.trim()[0] ?? '?').toUpperCase()}
      </Text>
    </View>
  );
}

export function TransactionRow({
  t,
  account,
  envelope,
  showAccount = true,
}: {
  t: Transaction;
  account?: Account;
  envelope?: Envelope;
  showAccount?: boolean;
}) {
  const colors = useColors();
  const leading =
    t.kind === 'slip' ? (
      <RowIcon sf="creditcard.fill" md="credit_card" tone="negative" />
    ) : t.kind === 'income' ? (
      <RowIcon sf="arrow.down" md="south" tone="positive" />
    ) : t.kind === 'transfer' ? (
      <RowIcon sf="arrow.left.arrow.right" md="swap_horiz" />
    ) : t.kind === 'interest' ? (
      <RowIcon sf="percent" md="percent" tone="negative" />
    ) : t.kind === 'adjustment' ? (
      <RowIcon sf="checkmark.seal" md="verified" />
    ) : (
      <Initial name={t.payee} />
    );

  const parts = [
    t.kind === 'slip' ? 'Card slip' : null,
    envelope?.name ?? (t.kind === 'income' ? 'Ready to assign' : null),
    showAccount ? account?.name : null,
  ].filter(Boolean);

  return (
    <Row
      href={`/transaction/${t.id}`}
      title={t.payee || 'Untitled'}
      titleTone={t.kind === 'slip' ? 'negative' : 'text'}
      subtitle={parts.join(' · ')}
      leading={leading}
      trailing={
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          <Money
            cents={t.amount}
            variant="body"
            weight="500"
            signed
            tone={t.amount > 0 ? 'positive' : t.kind === 'slip' ? 'negative' : 'text'}
          />
          {!t.cleared && t.kind !== 'adjustment' ? null : (
            <Icon sf="checkmark.circle.fill" md="check_circle" size={12} color={colors.textTertiary} />
          )}
        </View>
      }
    />
  );
}
