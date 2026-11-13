import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { fromISODate } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import { isDebtAccount, type Account, type Envelope, type Transaction } from '@/domain/types';
import { useStore } from '@/store';
import { envelopeEmoji } from '@/utils/envelope-emoji';
import { haptic } from '@/utils/haptics';
import { flagHues, radius, spacing, useColors } from '@/theme';

import { LinkedMark, StatusButton } from './bank';
import { Icon } from './icon';
import { Text } from './text';

const month = new Intl.DateTimeFormat('en-US', { month: 'short' });

/** Column widths shared by the row and its TableHeader. Put an empty-label `emoji` column after Date. */
export const TXN_COLUMNS = { date: 36, emoji: 20, money: 72, amount: 80, check: 20, status: 28 } as const;
/** Every row is the same height, note or not. */
const ROW_HEIGHT = 46;
/** The table runs a size smaller than the rest of the app so the money columns breathe. */
const cell = { fontSize: 12, lineHeight: 15 } as const;

export function DateBlock({ date, tone }: { date: string; tone?: 'negative' | 'muted' }) {
  const d = fromISODate(date);
  const ink = tone === 'muted' ? 'textTertiary' : tone;
  return (
    <View style={{ width: TXN_COLUMNS.date, alignItems: 'center' }}>
      <Text variant="caption" weight="600" tone={ink ?? 'textTertiary'} style={{ fontSize: 9, lineHeight: 11 }} caps>
        {month.format(d)}
      </Text>
      <Text variant="row" weight="600" tone={ink ?? 'text'} style={{ fontVariant: ['tabular-nums'] }}>
        {d.getDate()}
      </Text>
    </View>
  );
}

/** The emoji in a row: the envelope's, or one for money that has no envelope. */
export function transactionEmoji(t: Transaction, envelope?: Envelope, other?: Account): string {
  if (envelope) return envelopeEmoji(envelope);
  if (t.kind === 'income') return '💵';
  if (t.kind === 'interest') return '📈';
  if (t.kind === 'adjustment') return '⚖️';
  if (t.kind === 'transfer') return other && isDebtAccount(other) ? '💳' : '🔁';
  return '✉️';
}

/** The line under the payee: which card a slip went on, then the note. Empty when there's neither. */
export function transactionNote(t: Transaction, account?: Account): string {
  const parts: string[] = [];
  if (t.kind === 'slip') parts.push(`Slip on ${account?.name ?? 'a card'}`);
  if (t.memo) parts.push(t.memo);
  return parts.join(' · ');
}

/**
 * One transaction on one line: date, the envelope's emoji, the payee (with its note
 * underneath when there is one), then outflow in red and inflow in green. Slips are tinted
 * red. Reconciled rows go grey, so finished ones are easy to tell apart. In reconcile mode
 * the row gets a checkbox instead of opening the editor.
 */
export function TransactionRow({
  t,
  account,
  envelope,
  showAccount,
  columns = 'split',
  select,
  status,
  last,
}: {
  t: Transaction;
  account?: Account;
  envelope?: Envelope;
  /** Add the account to the note line (lists that mix accounts). */
  showAccount?: boolean;
  columns?: 'split' | 'single';
  /** Reconcile mode. */
  select?: { selected: boolean; disabled?: boolean; onToggle: () => void };
  /** The status column (pending, posted, reconciled), on an account's register. Called to switch it. */
  status?: () => void;
  last?: boolean;
}) {
  const colors = useColors();
  const other = useStore((s) => (t.transferAccountId ? s.accounts.find((a) => a.id === t.transferAccountId) : undefined));
  const done = !!t.reconciled;
  const slip = t.kind === 'slip' && !done;
  const out = t.amount < 0 ? -t.amount : 0;
  const inn = t.amount > 0 ? t.amount : 0;
  const base = transactionNote(t, account);
  const note =
    select?.disabled && t.flagged
      ? 'Flagged · unflag it to reconcile'
      : showAccount && account && !slip
        ? [account.name, base].filter(Boolean).join(' · ')
        : base;

  const rowBg = done ? colors.control : slip ? colors.negativeTint : colors.surface;
  const row = (
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
        height: ROW_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        // With the status column, the row's line and color belong to the wrapper.
        ...(status
          ? { flex: 1, paddingRight: spacing.sm }
          : { borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.hairline }),
        backgroundColor: pressed ? colors.fill : rowBg,
        opacity: select?.disabled ? 0.55 : 1,
      })}
    >
      {select && (
        <View
          style={{
            width: 18,
            height: 18,
            marginRight: 2,
            borderRadius: radius.tiny,
            borderCurve: 'continuous',
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
      <DateBlock date={t.date} tone={slip ? 'negative' : done ? 'muted' : undefined} />
      <Text
        style={{ width: TXN_COLUMNS.emoji, textAlign: 'center', fontSize: 15, lineHeight: 20, opacity: done ? 0.4 : 1 }}
        accessible={false}
      >
        {transactionEmoji(t, envelope, other)}
      </Text>
      {/* Payee centered on the row; the note sits under it only when there is one. */}
      <View style={{ flex: 1, minWidth: 0, justifyContent: 'center', gap: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text
            variant="row"
            weight="600"
            tone={slip ? 'negative' : done ? 'textTertiary' : 'text'}
            numberOfLines={1}
            style={[cell, { flexShrink: 1 }]}
          >
            {t.payee || 'Untitled'}
          </Text>
          {t.flagged && <Icon sf="flag.fill" md="flag" size={10} color={flagHues[t.flagColor ?? 'red']} />}
          {t.bankId && <LinkedMark size={10} />}
        </View>
        {note ? (
          <Text
            variant="caption"
            tone={slip ? 'negative' : select?.disabled ? 'orange' : done ? 'textTertiary' : 'textSecondary'}
            numberOfLines={1}
            style={{ fontSize: 10.5, lineHeight: 13 }}
          >
            {note}
          </Text>
        ) : null}
      </View>
      {columns === 'split' ? (
        <>
          <Text
            variant="row"
            align="right"
            tone={done ? 'textTertiary' : 'negative'}
            style={[cell, { width: TXN_COLUMNS.money, fontVariant: ['tabular-nums'] }]}
          >
            {out ? formatMoney(-out) : ''}
          </Text>
          <Text
            variant="row"
            align="right"
            tone={done ? 'textTertiary' : 'positive'}
            style={[cell, { width: TXN_COLUMNS.money, fontVariant: ['tabular-nums'] }]}
          >
            {inn ? formatMoney(inn, { signed: true }) : ''}
          </Text>
        </>
      ) : (
        <Text
          variant="row"
          align="right"
          tone={done ? 'textTertiary' : t.amount > 0 ? 'positive' : 'negative'}
          style={[cell, { width: TXN_COLUMNS.amount, fontVariant: ['tabular-nums'] }]}
        >
          {formatMoney(t.amount, { signed: true })}
        </Text>
      )}
    </Pressable>
  );
  if (!status) return row;
  // The status button sits beside the row, not inside it, so tapping it never opens the editor.
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingRight: spacing.xs,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.hairline,
        backgroundColor: rowBg,
      }}
    >
      {row}
      <StatusButton t={t} onToggle={status} width={TXN_COLUMNS.status} height={ROW_HEIGHT} />
    </View>
  );
}
