import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { LinkedMark, StatusButton } from '@/components/bank';
import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import { STARTING_BALANCE } from '@/domain/bank';
import { formatMoney } from '@/domain/money';
import type { Account, Envelope, Transaction } from '@/domain/types';
import { flagHues, radius, spacing, useColors } from '@/theme';

import { shortDate } from './budget';
import { RegisterEditRow } from './edit-row';

/** Column widths, shared by the header, the entry row and every transaction. */
export const W = { check: 22, date: 76, out: 110, in: 110, status: 32 } as const;
export const FLEX = { payee: 1.6, envelope: 1.1, account: 1, note: 1.1 } as const;
export const GAP = 12;

/** Which optional columns a register shows: an account's page drops Account, an envelope's drops Envelope. */
export type RegisterColumns = { envelope?: boolean; account?: boolean; check?: boolean; status?: boolean };

/** The column labels across the top of a register. */
export function RegisterHeader({ columns }: { columns: RegisterColumns }) {
  const colors = useColors();
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: GAP,
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: colors.tableHeader,
        borderBottomWidth: 1,
        borderBottomColor: colors.separator,
      }}
    >
      {columns.check && <View style={{ width: W.check }} />}
      <Label width={W.date}>Date</Label>
      <Label flex={FLEX.payee}>Payee</Label>
      {columns.envelope !== false && <Label flex={FLEX.envelope}>Envelope</Label>}
      {columns.account !== false && <Label flex={FLEX.account}>Account</Label>}
      <Label flex={FLEX.note}>Note</Label>
      <Label width={W.out} right>
        Outflow
      </Label>
      <Label width={W.in} right>
        Inflow
      </Label>
      {columns.status && <View style={{ width: W.status }} />}
    </View>
  );
}

/** What the Envelope column says for money that doesn't come from an envelope. */
function envelopeText(
  t: Transaction,
  envelope?: Envelope,
): { text: string; tone: 'positive' | 'textSecondary' | 'orange' } {
  if (envelope) return { text: envelope.name, tone: 'textSecondary' };
  if (t.kind === 'income') return { text: 'Ready to assign', tone: 'positive' };
  // The payee already says where it went ("To Car Loan"), so the column just says what it is.
  if (t.kind === 'transfer') return { text: 'Transfer', tone: 'textSecondary' };
  if (t.kind === 'interest') return { text: 'Interest', tone: 'textSecondary' };
  if (t.kind === 'adjustment' && t.payee === STARTING_BALANCE) return { text: 'Ready to assign', tone: 'positive' };
  if (t.kind === 'adjustment') return { text: 'Balance adjustment', tone: 'textSecondary' };
  return { text: 'No envelope', tone: 'orange' };
}

/**
 * One transaction on one line. Clicking it opens the editor; in reconcile mode it
 * checks the row off instead. Reconciled rows are grey, slips' outflow is red.
 */
export function RegisterRow({
  t,
  account,
  other,
  envelope,
  columns,
  select,
  status,
}: {
  t: Transaction;
  account?: Account;
  other?: Account;
  envelope?: Envelope;
  columns: RegisterColumns;
  select?: { selected: boolean; disabled?: boolean; onToggle: () => void };
  /** The status column: switches pending and posted. */
  status?: () => void;
}) {
  const colors = useColors();
  // Clicking a row opens it for editing right here; the full form is only for new ones.
  const [editing, setEditing] = useState(false);
  const done = !!t.reconciled;
  const env = envelopeText(t, envelope);
  if (editing && !select) {
    return <RegisterEditRow t={t} account={account} columns={columns} envelopeLabel={env.text} onDone={() => setEditing(false)} />;
  }
  const ink = done ? colors.textTertiary : colors.text;
  const sub = done ? colors.textMuted : colors.textSecondary;
  const outColor = done ? colors.textTertiary : t.kind === 'slip' ? colors.negative : colors.text;
  const row = (
    <Pressable
      accessibilityRole={select ? 'checkbox' : 'button'}
      accessibilityState={select ? { checked: select.selected, disabled: select.disabled } : undefined}
      accessibilityLabel={`${t.payee}, ${formatMoney(t.amount)}, ${shortDate(t.date)}${select ? '' : '. Edit'}`}
      disabled={select?.disabled}
      onPress={() => (select ? select.onToggle() : setEditing(true))}
      style={({ hovered }: { hovered?: boolean }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: GAP,
        minHeight: 40,
        paddingHorizontal: 16,
        ...(columns.status ? { flex: 1, paddingRight: 0 } : { borderTopWidth: 1, borderTopColor: colors.hairline }),
        opacity: select?.disabled ? 0.55 : 1,
        backgroundColor: hovered ? (done ? colors.rowDoneHover : colors.tableHeader) : done ? colors.rowDone : 'transparent',
      })}
    >
      {columns.check && (
        <View style={{ width: W.check, alignItems: 'center' }}>
          {select ? (
            <View
              style={{
                width: 18,
                height: 18,
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
          ) : done ? (
            <Icon sf="checkmark" md="check" size={12} color={colors.textTertiary} />
          ) : null}
        </View>
      )}
      <Text variant="callout" color={sub} style={{ width: W.date }}>
        {shortDate(t.date)}
      </Text>
      <View style={{ flex: FLEX.payee, minWidth: 0, justifyContent: 'center' }}>
        {/* The flag sits in the gutter, so payees line up with the column. */}
        {t.flagged && !columns.check && (
          <View
            accessibilityLabel="Flagged"
            style={{
              position: 'absolute',
              left: -14,
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: flagHues[t.flagColor ?? 'red'],
            }}
          />
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          {t.flagged && columns.check && (
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: flagHues[t.flagColor ?? 'red'] }} />
          )}
          <Text variant="body" weight="500" color={ink} numberOfLines={1} style={{ flexShrink: 1 }}>
            {t.payee}
          </Text>
          {t.bankId && <LinkedMark size={12} />}
        </View>
      </View>
      {columns.envelope !== false && (
        <Text variant="callout" color={done ? colors.textMuted : colors[env.tone]} numberOfLines={1} style={{ flex: FLEX.envelope }}>
          {env.text}
        </Text>
      )}
      {columns.account !== false && (
        <Text variant="callout" color={sub} numberOfLines={1} style={{ flex: FLEX.account }}>
          {account?.name ?? ''}
        </Text>
      )}
      <Text variant="callout" color={sub} numberOfLines={1} style={{ flex: FLEX.note }}>
        {t.memo ?? ''}
      </Text>
      <Text variant="body" color={outColor} align="right" style={{ width: W.out, fontVariant: ['tabular-nums'] }}>
        {t.amount < 0 ? formatMoney(-t.amount) : ''}
      </Text>
      <Text
        variant="body"
        color={done ? colors.textTertiary : colors.positive}
        align="right"
        style={{ width: W.in, fontVariant: ['tabular-nums'] }}
      >
        {t.amount > 0 ? formatMoney(t.amount) : ''}
      </Text>
    </Pressable>
  );
  if (!columns.status) return row;
  // The status button sits beside the row, not inside it, so clicking it never opens the editor.
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: GAP,
        paddingRight: 16,
        borderTopWidth: 1,
        borderTopColor: colors.hairline,
        backgroundColor: done ? colors.rowDone : 'transparent',
      }}
    >
      {row}
      {status ? <StatusButton t={t} onToggle={status} width={W.status} height={36} /> : <View style={{ width: W.status }} />}
    </View>
  );
}

/** A grey strip naming a month inside a register, with what went out that month. */
export function MonthDivider({ label, detail }: { label: string; detail?: string }) {
  const colors = useColors();
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 6,
        borderTopWidth: 1,
        borderTopColor: colors.separator,
      }}
    >
      <Text variant="callout" weight="700">
        {label}
      </Text>
      {detail ? (
        <Text variant="footnote" tone="textSecondary">
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

/** A filter pill. Pills are for filters only; selectors are dropdowns. */
export function Pill({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={({ hovered }: { hovered?: boolean }) => ({
        height: 30,
        paddingHorizontal: 12,
        borderRadius: 15,
        justifyContent: 'center',
        borderWidth: on ? 0 : 1,
        borderColor: colors.borderStrong,
        backgroundColor: on ? colors.ink : hovered ? colors.control : colors.surface,
      })}
    >
      <Text variant="callout" weight={on ? '600' : '500'} color={on ? colors.onInk : colors.text}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Label({
  children,
  width,
  flex,
  right,
}: {
  children: string;
  width?: number;
  flex?: number;
  right?: boolean;
}) {
  return (
    <Text variant="label" caps tone="textTertiary" align={right ? 'right' : 'left'} style={flex ? { flex } : { width }}>
      {children}
    </Text>
  );
}
