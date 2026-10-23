import type { Account, Envelope, Transaction } from '@/domain/types';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { groupHue, useColors } from '@/theme';
import { envelopeIcon } from '@/utils/envelope-icon';

import { Row, RowIcon } from './list';
import { Money } from './money';

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
  const scheme = useColorScheme();

  let leading: React.ReactNode;
  if (t.kind === 'slip') {
    leading = <RowIcon sf="creditcard.fill" md="credit_card" fg={colors.negative} bg={colors.negativeSoft} round />;
  } else if (t.kind === 'income') {
    leading = <RowIcon sf="arrow.down" md="south" fg={colors.positive} bg={colors.positiveSoft} round />;
  } else if (t.kind === 'transfer') {
    leading = <RowIcon sf="arrow.left.arrow.right" md="swap_horiz" fg={colors.textSecondary} bg={colors.fill} round />;
  } else if (t.kind === 'interest') {
    leading = <RowIcon sf="percent" md="percent" fg={colors.negative} bg={colors.negativeSoft} round />;
  } else if (t.kind === 'adjustment') {
    leading = <RowIcon sf="checkmark.seal" md="verified" fg={colors.textSecondary} bg={colors.fill} round />;
  } else {
    const hue = envelope ? groupHue(envelope.group, scheme) : { fg: colors.textSecondary, soft: colors.fill };
    const icon = envelopeIcon(envelope?.name ?? '');
    leading = <RowIcon sf={icon.sf} md={icon.md} fg={hue.fg} bg={hue.soft} round />;
  }

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
        <Money
          cents={t.amount}
          weight="500"
          signed
          tone={t.amount > 0 ? 'positive' : t.kind === 'slip' ? 'negative' : 'text'}
        />
      }
    />
  );
}
