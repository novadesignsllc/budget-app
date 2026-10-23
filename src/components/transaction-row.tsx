import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { fromISODate } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import { isDebtAccount, type Account, type Envelope, type Transaction } from '@/domain/types';
import { useStore } from '@/store';
import { haptic } from '@/utils/haptics';
import { spacing, useColors } from '@/theme';

import { Icon } from './icon';
import { Text } from './text';

const month = new Intl.DateTimeFormat('en-US', { month: 'short' });

/** Column widths shared by the row and its TableHeader. */
export const TXN_COLUMNS = { date: 28, money: 62, amount: 70, check: 20 } as const;

function DateBlock({ date, tone }: { date: string; tone?: 'negative' }) {
  const d = fromISODate(date);
  return (
    <View style={{ width: TXN_COLUMNS.date, alignItems: 'center' }}>
      <Text variant="caption" weight="600" tone={tone ?? 'textTertiary'} style={{ fontSize: 8, lineHeight: 10 }} caps>
        {month.format(d)}
      </Text>
      <Text variant="body" weight="600" tone={tone ?? 'text'} style={{ fontVariant: ['tabular-nums'] }}>
        {d.getDate()}
      </Text>
    </View>
  );
}

/** "Groceries · weekly run", "Slip on Chase Freedom · Fun Money", "Debt payment · Capital One". */
export function transactionDetail(
  t: Transaction,
  account?: Account,
  envelope?: Envelope,
  showAccount?: boolean,
  other?: Account,
) {
  const parts: string[] = [];
  if (t.kind === 'slip') parts.push(`Slip on ${account?.name ?? 'a card'}`);
  if (t.kind === 'transfer' && other) {
    if (isDebtAccount(other)) parts.push(`Debt payment · ${other.name}`);
    else if (account && isDebtAccount(account)) parts.push(`Payment from ${other.name}`);
    else parts.push(t.amount < 0 ? `Transfer to ${other.name}` : `Transfer from ${other.name}`);
  } else if (envelope) parts.push(envelope.name);
  else if (t.kind === 'income') parts.push('Ready to assign');
  else if (t.kind === 'interest') parts.push('Interest and fees');
  else if (t.kind === 'adjustment') parts.push('Balance adjustment');
  if (showAccount && account && t.kind !== 'slip') parts.push(account.name);
  if (t.memo) parts.push(t.memo);
  return parts.join(' · ');
}

/**
 * One transaction on one dense line: date, payee with flag or lock, envelope and note,
 * then outflow and inflow columns (or one signed amount). Slips are tinted red.
 * In reconcile mode the row gets a checkbox instead of opening the editor.
 */
export function TransactionRow({
  t,
  account,
  envelope,
  showAccount,
  columns = 'split',
  select,
  last,
}: {
  t: Transaction;
  account?: Account;
  envelope?: Envelope;
  showAccount?: boolean;
  columns?: 'split' | 'single';
  /** Reconcile mode. */
  select?: { selected: boolean; disabled?: boolean; onToggle: () => void };
  last?: boolean;
}) {
  const colors = useColors();
  const other = useStore((s) => (t.transferAccountId ? s.accounts.find((a) => a.id === t.transferAccountId) : undefined));
  const slip = t.kind === 'slip';
  const out = t.amount < 0 ? -t.amount : 0;
  const inn = t.amount > 0 ? t.amount : 0;
  const detail = select?.disabled && t.flagged ? 'Flagged · unflag it to reconcile' : transactionDetail(t, account, envelope, showAccount, other);

  return (
    <Pressable
      accessibilityRole={select ? 'checkbox' : 'button'}
      accessibilityState={select ? { checked: select.selected, disabled: select.disabled } : undefined}
      accessibilityLabel={`${t.payee}, ${formatMoney(t.amount, { signed: true })}, ${t.date}${t.flagged ? ', flagged' : ''}${t.reconciled ? ', reconciled' : ''}`}
      disabled={select?.disabled}
      onPress={() => {
        if (select) {
          haptic('selection');
          select.onToggle();
        } else router.push(`/transaction/${t.id}`);
      }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: 7,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.hairline,
        backgroundColor: pressed ? colors.control : slip ? colors.negativeTint : colors.surface,
        opacity: select?.disabled ? 0.55 : 1,
      })}
    >
      {select && (
        <View
          style={{
            width: 18,
            height: 18,
            marginRight: 2,
            borderRadius: 5,
            borderWidth: select.selected ? 0 : 1.5,
            borderColor: colors.borderStrong,
            backgroundColor: select.selected ? colors.accent : colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {select.selected && <Icon sf="checkmark" md="check" size={11} color={colors.onInk} weight="bold" />}
        </View>
      )}
      <DateBlock date={t.date} tone={slip ? 'negative' : undefined} />
      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text variant="row" weight="600" tone={slip ? 'negative' : 'text'} numberOfLines={1} style={{ flexShrink: 1 }}>
            {t.payee || 'Untitled'}
          </Text>
          {t.flagged && <Icon sf="flag.fill" md="flag" size={10} color={colors.orange} />}
          {t.reconciled && !select && <Icon sf="lock.fill" md="lock" size={9} color={colors.textTertiary} />}
        </View>
        <Text
          variant="caption"
          tone={slip ? 'negative' : select?.disabled ? 'orange' : 'textSecondary'}
          numberOfLines={1}
        >
          {detail}
        </Text>
      </View>
      {columns === 'split' ? (
        <>
          <Text variant="row" align="right" tone={slip ? 'negative' : 'text'} style={{ width: TXN_COLUMNS.money, fontVariant: ['tabular-nums'] }}>
            {out ? formatMoney(out) : ''}
          </Text>
          <Text variant="row" align="right" tone="positive" style={{ width: TXN_COLUMNS.money, fontVariant: ['tabular-nums'] }}>
            {inn ? formatMoney(inn) : ''}
          </Text>
        </>
      ) : (
        <Text
          variant="row"
          align="right"
          tone={t.amount > 0 ? 'positive' : slip ? 'negative' : 'text'}
          style={{ width: TXN_COLUMNS.amount, fontVariant: ['tabular-nums'] }}
        >
          {formatMoney(t.amount, { signed: true })}
        </Text>
      )}
    </Pressable>
  );
}
