import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/icon';
import { InlineAmount } from '@/components/inline-amount';
import { closeKeypad } from '@/components/keypad';
import { Text } from '@/components/text';
import { useToast } from '@/components/toast';
import { today } from '@/domain/dates';
import { debtTarget } from '@/domain/debt';
import { floorDollars, formatDollars } from '@/domain/money';
import { assignDateFor, type EnvelopeMonth } from '@/domain/months';
import type { Envelope } from '@/domain/types';
import { currentMonth, useBudgetMonth } from '@/hooks/use-budget-month';
import { useCollapsedGroups } from '@/hooks/use-collapsed-groups';
import { useLedger } from '@/hooks/use-ledger';
import { LeftCell } from '@/screens/budget';
import { useStore } from '@/store';
import { spacing, useColors } from '@/theme';
import { envelopeStatus, targetBar } from '@/utils/envelope-status';

const EMPTY: EnvelopeMonth = { assigned: 0, activity: 0, spent: 0, carriedIn: 0, available: 0 };
const noop = () => {};
const FOLD_KEY = 'Debt tab: payments';

/** What each debt's payment envelope has assigned this month, added up. Shown on the Budget. */
export function useDebtAssigned(month: string): number {
  const budget = useBudgetMonth(month);
  const envelopes = useStore((s) => s.envelopes);
  return envelopes
    .filter((e) => e.debtAccountId && !e.hidden)
    .reduce((sum, e) => sum + (budget.envelopes.get(e.id)?.assigned ?? 0), 0);
}

/**
 * Each debt's payment envelope for this month, one line per debt: Auto (card spending moved
 * in from other envelopes), Manual (what you assigned, tap to change), Paid (payments sent to
 * the debt) and Left. The money works the same as any envelope; it lives on the Debt tab
 * because it belongs with the debts. Draws only the inside, so it sits in a phone Card or a
 * desktop card.
 */
export function PaymentEnvelopes({
  desktop,
  onEditingChange,
}: {
  desktop?: boolean;
  /** The phone keeps the edited row above the number pad. */
  onEditingChange?: (editing: boolean, view: React.ComponentRef<typeof View> | null) => void;
}) {
  const colors = useColors();
  const month = currentMonth();
  const budget = useBudgetMonth(month);
  const ledger = useLedger();
  const envelopes = useStore((s) => s.envelopes);
  const accounts = useStore((s) => s.accounts);
  const assign = useStore((s) => s.assign);
  const assignMany = useStore((s) => s.assignMany);
  const removeAllocations = useStore((s) => s.removeAllocations);
  const showToast = useToast((s) => s.show);
  // Folds closed like a Budget group, remembered on this device.
  const open = useCollapsedGroups((s) => !s.closed.includes(FOLD_KEY));
  const toggle = useCollapsedGroups((s) => s.toggle);
  const date = assignDateFor(month, today());

  const items = envelopes.filter((e) => e.debtAccountId && !e.hidden).sort((a, b) => a.order - b.order);
  if (!items.length) return null;

  // The phone fits four columns on one line by keeping them narrow; names get "…" first.
  const col = desktop ? 84 : 54;
  const gap = desktop ? 12 : 6;
  const padX = desktop ? 16 : spacing.md + 2;
  const align = desktop ? 'right' : 'center';
  const ready = items.reduce((sum, e) => sum + floorDollars(budget.envelopes.get(e.id)?.available ?? 0), 0);

  function debtFor(e: Envelope) {
    const owed = -(ledger.balance.get(e.debtAccountId!) ?? 0);
    const a = accounts.find((x) => x.id === e.debtAccountId);
    return { owed, target: a ? debtTarget(a, owed) : 0 };
  }

  function moveBack(e: Envelope, cents: number) {
    const ids = assignMany([{ envelopeId: e.id, amount: -cents, date }]);
    showToast({
      message: `Moved ${formatDollars(cents)} back to Ready to assign`,
      actionLabel: 'Undo',
      onAction: () => removeAllocations(ids),
    });
  }

  const label = (text: string, flex?: boolean) => (
    <Text
      key={text}
      variant="label"
      caps
      tone="textTertiary"
      numberOfLines={1}
      align={flex ? 'left' : align}
      // Tighter tracking on the phone so MANUAL fits its narrow column.
      style={[
        flex ? { flex: 1 } : { width: col, marginLeft: gap, paddingRight: desktop ? 6 : 0 },
        !desktop && !flex && { letterSpacing: 0.2 },
      ]}
    >
      {text}
    </Text>
  );
  const amount = (cents: number, round: 'down' | 'up', strong?: boolean) => (
    <Text
      variant={desktop ? 'body' : 'row'}
      tone={cents === 0 ? 'textTertiary' : strong ? 'text' : 'textSecondary'}
      align={align}
      numberOfLines={1}
      style={{ width: col, marginLeft: gap, paddingRight: desktop ? 6 : 0, fontVariant: ['tabular-nums'] }}
    >
      {formatDollars(cents, round)}
    </Text>
  );

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`Debt payments, ${formatDollars(ready)} ready to pay. ${open ? 'Collapse' : 'Expand'}`}
        onPress={() => toggle(FOLD_KEY)}
        style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingHorizontal: padX,
          paddingVertical: desktop ? 11 : spacing.md - 1,
          borderBottomWidth: open ? 1 : 0,
          borderBottomColor: colors.separator,
          backgroundColor: pressed || hovered ? colors.control : 'transparent',
        })}
      >
        <View style={{ transform: [{ rotate: open ? '0deg' : '-90deg' }] }}>
          <Icon sf="chevron.down" md="expand_more" size={desktop ? 14 : 12} color={colors.textTertiary} weight="semibold" />
        </View>
        <Text variant="section" accessibilityRole="header" style={{ flex: 1 }} numberOfLines={1}>
          Debt payments
        </Text>
        <Text variant="footnote" weight="600" tone="textSecondary">
          {formatDollars(ready)} ready to pay
        </Text>
      </Pressable>
      {open && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: padX,
            paddingVertical: 7,
            backgroundColor: colors.tableHeader,
            borderBottomWidth: 1,
            borderBottomColor: colors.separator,
          }}
        >
          {label('Payment', true)}
          {label('Auto')}
          {label('Manual')}
          {label('Paid')}
          {label('Left')}
        </View>
      )}
      {open &&
        items.map((e, i) => {
          const row = budget.envelopes.get(e.id) ?? EMPTY;
          const debt = debtFor(e);
          const status = envelopeStatus(e, row, month, debt);
          const red = row.available < 0;
          return (
            <View
              key={e.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: padX,
                paddingVertical: desktop ? 10 : 11,
                borderTopWidth: i ? 1 : 0,
                borderTopColor: colors.hairline,
              }}
            >
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={`${e.name}, ${formatDollars(row.available)} left. Open debt`}
                onPress={() => router.navigate(`/debt/${e.debtAccountId}`)}
                hitSlop={{ top: 9, bottom: 9 }}
                style={({ pressed }) => ({ flex: 1, minWidth: 0, opacity: pressed ? 0.5 : 1 })}
              >
                <Text
                  variant={desktop ? 'body' : 'row'}
                  weight="500"
                  tone={red ? 'negative' : 'text'}
                  numberOfLines={1}
                >
                  {e.name}
                </Text>
              </Pressable>
              {amount(row.moved ?? 0, 'down', true)}
              <View style={{ marginLeft: gap }}>
                <InlineAmount
                  exact
                  align={align}
                  cents={row.assigned}
                  width={col}
                  accessibilityLabel={`Assigned to ${e.name}`}
                  onEditingChange={onEditingChange}
                  onCommit={(cents) => assign(e.id, cents - row.assigned, date)}
                  actions={[
                    {
                      label: status.need > 0 ? `Fill ${formatDollars(status.need)}` : 'Target met',
                      icon: { sf: 'bolt.fill', md: 'bolt' },
                      disabled: status.need <= 0,
                      onPress: () => {
                        closeKeypad();
                        assign(e.id, status.need, date);
                      },
                    },
                  ]}
                />
              </View>
              {amount(row.spent, 'up')}
              <LeftCell
                width={col}
                row={row}
                bar={targetBar(e, row, month, debt)}
                past={false}
                tone={red ? 'negative' : row.available < 100 ? 'textTertiary' : 'text'}
                onEditingChange={onEditingChange ?? noop}
                onMoveBack={(cents) => moveBack(e, cents)}
                align={align}
              />
            </View>
          );
        })}
    </View>
  );
}
