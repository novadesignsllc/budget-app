import { Modal, Pressable, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import type { BankTransaction } from '@/domain/bank';
import { formatShortDate } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import type { Transaction } from '@/domain/types';
import { radius, spacing, useColors } from '@/theme';
import { haptic } from '@/utils/haptics';

import { Button } from './button';
import { useIsDesktop } from './dock';
import { Text } from './text';

export type TxnStatus = 'pending' | 'posted' | 'reconciled';

/** Pending (not at the bank yet, or still pending there), posted, or reconciled and locked. */
export function statusOf(t: Pick<Transaction, 'cleared' | 'reconciled'>): TxnStatus {
  return t.reconciled ? 'reconciled' : t.cleared ? 'posted' : 'pending';
}

const STATUS_LABEL: Record<TxnStatus, string> = {
  pending: 'Pending',
  posted: 'Posted',
  reconciled: 'Reconciled',
};

/** One shape for all three: a dash in an empty circle, a check in green, a lock in grey. */
export function StatusIcon({ status, size = 20 }: { status: TxnStatus; size?: number }) {
  const colors = useColors();
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      {status === 'pending' ? (
        <>
          <Circle cx={10} cy={10} r={8.25} fill="none" stroke={colors.disabled} strokeWidth={1.5} />
          <Path d="M6.75 10h6.5" stroke={colors.textTertiary} strokeWidth={1.75} strokeLinecap="round" />
        </>
      ) : status === 'posted' ? (
        <>
          <Circle cx={10} cy={10} r={9} fill={colors.positive} />
          <Path
            d="M6.3 10.3l2.4 2.4 5-5.2"
            fill="none"
            stroke={colors.onInk}
            strokeWidth={1.9}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : (
        <>
          <Circle cx={10} cy={10} r={9} fill={colors.textMuted} />
          <Rect x={6.9} y={9.3} width={6.2} height={4.7} rx={1.1} fill={colors.onInk} />
          <Path d="M8.3 9.3V8.1a1.7 1.7 0 0 1 3.4 0v1.2" fill="none" stroke={colors.onInk} strokeWidth={1.4} />
        </>
      )}
    </Svg>
  );
}

/** The status column: tap to switch pending and posted. Reconciled ones are locked. */
export function StatusButton({
  t,
  onToggle,
  width = 28,
  height = 44,
}: {
  t: Pick<Transaction, 'cleared' | 'reconciled' | 'payee'>;
  onToggle: () => void;
  width?: number;
  height?: number;
}) {
  const status = statusOf(t);
  const locked = status === 'reconciled';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${STATUS_LABEL[status]}${locked ? '' : status === 'posted' ? '. Mark pending' : '. Mark posted'}`}
      accessibilityState={{ disabled: locked }}
      disabled={locked}
      hitSlop={{ left: 6, right: 6 }}
      onPress={() => {
        haptic('selection');
        onToggle();
      }}
      style={({ pressed }) => ({ width, height, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
    >
      <StatusIcon status={status} />
    </Pressable>
  );
}

/** Small chain: this transaction is linked to the bank's copy. */
export function LinkedMark({ size = 11, color }: { size?: number; color?: string }) {
  const colors = useColors();
  return (
    <View accessible accessibilityLabel="Linked to the bank">
      <Svg width={size} height={size} viewBox="0 0 12 12">
        <Path
          d="M5 7l2-2M4.2 5.3 3.1 6.4a1.9 1.9 0 0 0 2.7 2.7l1.1-1.1M7.8 6.7l1.1-1.1a1.9 1.9 0 0 0-2.7-2.7L5.1 4"
          fill="none"
          stroke={color ?? colors.textTertiary}
          strokeWidth={1.3}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}

/** "The bank shows $10.00 more." Facts only; it never guesses why. */
export function matchDifference(mine: Pick<Transaction, 'amount' | 'date'>, bank: Pick<BankTransaction, 'amount' | 'date'>): string {
  const gap = Math.abs(bank.amount) - Math.abs(mine.amount);
  if (gap > 0) return `The bank shows ${formatMoney(gap)} more.`;
  if (gap < 0) return `The bank shows ${formatMoney(-gap)} less.`;
  return 'Same amount on a different day.';
}

/**
 * Approving a bank transaction that's close to one you entered, but not the same: link the
 * two (the bank's amount wins), or add the bank's as its own.
 */
export function MatchDialog({
  mine,
  bank,
  onLink,
  onAddNew,
  onCancel,
}: {
  mine: Transaction | null;
  bank: BankTransaction | null;
  onLink: () => void;
  onAddNew: () => void;
  onCancel: () => void;
}) {
  const colors = useColors();
  const desktop = useIsDesktop();
  const open = !!mine && !!bank;
  const line = (label: string, payee: string, date: string, amount: number, last?: boolean) => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm + 2,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm + 2,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.hairline,
      }}
    >
      <Text variant="footnote" tone="textSecondary" style={{ width: desktop ? 92 : 78 }}>
        {label}
      </Text>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="callout" weight="600" numberOfLines={1}>
          {payee}
        </Text>
        <Text variant="caption" tone="textSecondary">
          {formatShortDate(date)}
        </Text>
      </View>
      <Text variant="callout" weight="600" tone={amount < 0 ? 'negative' : 'positive'} style={{ fontVariant: ['tabular-nums'] }}>
        {formatMoney(amount, { signed: true })}
      </Text>
    </View>
  );
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable
        accessibilityLabel="Cancel"
        onPress={onCancel}
        style={{ flex: 1, backgroundColor: colors.backdrop, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}
      >
        {open && (
          // Taps inside the card stay in the card (a View, so web doesn't nest buttons).
          <View
            accessibilityViewIsModal
            onStartShouldSetResponder={() => true}
            style={{
              width: '100%',
              maxWidth: desktop ? 420 : 340,
              backgroundColor: colors.surface,
              borderRadius: radius.xl,
              borderCurve: 'continuous',
              padding: spacing.lg,
              gap: spacing.md + 2,
            }}
          >
            <View style={{ gap: 4 }}>
              <Text variant="section" align={desktop ? 'left' : 'center'} style={{ fontSize: 17, lineHeight: 22, fontWeight: '700' }} accessibilityRole="header">
                Same as one you entered?
              </Text>
              <Text variant="callout" tone="textSecondary" align={desktop ? 'left' : 'center'}>
                {matchDifference(mine!, bank!)}
              </Text>
            </View>
            <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.menu, borderCurve: 'continuous', overflow: 'hidden' }}>
              {line('You entered', mine!.payee, mine!.date, mine!.amount)}
              {line('Bank shows', bank!.name, bank!.date, bank!.amount, true)}
            </View>
            {desktop ? (
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm }}>
                <Button title="Cancel" variant="ghost" onPress={onCancel} />
                <Button title="Add new" variant="secondary" onPress={onAddNew} />
                <Button title="Link" onPress={onLink} />
              </View>
            ) : (
              <View style={{ gap: spacing.sm }}>
                <Button title="Link" size="lg" onPress={onLink} />
                <Button title="Add new" size="lg" variant="secondary" onPress={onAddNew} />
                <Button title="Cancel" variant="ghost" onPress={onCancel} />
              </View>
            )}
          </View>
        )}
      </Pressable>
    </Modal>
  );
}
