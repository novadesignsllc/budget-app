import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AnimatedNumber } from '@/components/animated-number';
import { Card, CardHeader } from '@/components/card';
import { Dropdown } from '@/components/dropdown';
import { Icon } from '@/components/icon';
import { InlineAmount } from '@/components/inline-amount';
import { closeKeypad, useKeypadField } from '@/components/keypad';
import { ActionMenu } from '@/components/action-menu';
import { debtTarget } from '@/domain/debt';
import { Screen } from '@/components/screen';
import { ActionButton, ScreenActions } from '@/components/screen-actions';
import { ScreenTitle } from '@/components/screen-title';
import { SortList, type SortGroup } from '@/components/sort-list';
import { SwipeRow, useSwipeGuard } from '@/components/swipe-row';
import { Text } from '@/components/text';
import { useToast } from '@/components/toast';
import { today } from '@/domain/dates';
import { ceilDollars, floorDollars, formatDollars, formatMoney } from '@/domain/money';
import {
  assignDateFor,
  formatMonth,
  MONTHS_AHEAD,
  targetGaps,
  type EnvelopeMonth,
  type MonthKey,
} from '@/domain/months';
import { envelopePool, type Pool } from '@/domain/pools';
import { isSnoozed, targetSetFor } from '@/domain/targets';
import type { Envelope } from '@/domain/types';
import { currentMonth, useBudgetMonth } from '@/hooks/use-budget-month';
import { useKeyboardReveal } from '@/hooks/use-keyboard-reveal';
import { useLedger } from '@/hooks/use-ledger';
import { AssignedAheadNote } from '@/components/home-cards';
import { coverShortfall, moveToCover, POOL_NAME, POOL_SOURCE, usePools, type PoolView } from '@/hooks/use-pools';
import { isManagedGroup, useStore } from '@/store';
import { groupColor, radius, spacing, useColors } from '@/theme';
import { envelopeStatus, groupSummary, leftPillState, targetBar, type TargetBar } from '@/utils/envelope-status';
import { envelopeEmoji } from '@/utils/envelope-emoji';
import { orderGroups } from '@/utils/group-order';
import { haptic } from '@/utils/haptics';
import { useMonthOptions } from '@/utils/month-options';

export const STARTERS: { name: string; group: string }[] = [
  { name: 'Groceries', group: 'Daily' },
  { name: 'Eating Out', group: 'Daily' },
  { name: 'Gas', group: 'Daily' },
  { name: 'Fun Money', group: 'Daily' },
  { name: 'Emergency Fund', group: 'Savings' },
  { name: 'Car Repairs', group: 'Savings' },
  { name: 'Gifts', group: 'Savings' },
];

/**
 * Assigned, Spent and Left share one width and one gap, so every row and section lines up
 * and a four-digit amount like $5,082 fits with room to spare. Names get "…" first.
 */
const COL = 64;
const COL_GAP = 6;
/** Inner padding of the Left pill box. */
const COL_PAD = 6;
const EMPTY: EnvelopeMonth = {
  assigned: 0,
  activity: 0,
  spent: 0,
  carriedIn: 0,
  available: 0,
};

const monthYear = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
});
const monthOnly = new Intl.DateTimeFormat('en-US', { month: 'long' });
const asDate = (m: MonthKey) => {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1);
};

export function Budget() {
  const colors = useColors();
  const thisMonth = currentMonth();
  const [month, setMonth] = useState<MonthKey>(thisMonth);
  const budget = useBudgetMonth(month);
  const ledger = useLedger();
  const envelopes = useStore((s) => s.envelopes);
  const groupOrder = useStore((s) => s.settings.groupOrder);
  const startersDone = useStore((s) => !!s.settings.startersDone);
  const updateSettings = useStore((s) => s.updateSettings);
  const reorderEnvelopes = useStore((s) => s.reorderEnvelopes);
  const accounts = useStore((s) => s.accounts);
  const addEnvelope = useStore((s) => s.addEnvelope);
  const assign = useStore((s) => s.assign);
  const assignMany = useStore((s) => s.assignMany);
  const removeAllocations = useStore((s) => s.removeAllocations);
  const showToast = useToast((s) => s.show);
  const { scrollRef, onScroll, watch: revealAboveKeyboard, offset, scrollBy } = useKeyboardReveal();
  // Sort mode: a draft order that only saves on Confirm.
  const [sorting, setSorting] = useState<SortGroup[] | null>(null);
  const [dragging, setDragging] = useState(false);
  const [confirmUnassign, setConfirmUnassign] = useState(false);
  // The row being edited and the amount typed so far, for the live "to assign" preview.
  // Years are section labels in the menu, so each option only needs the month name.
  // Past months sit under their year, so they only need the month's name; months ahead keep the year.
  const monthOptions = useMonthOptions({ ahead: MONTHS_AHEAD }).map((o) =>
    o.section === 'Ahead' ? o : { ...o, label: monthOnly.format(asDate(o.value)) },
  );

  const groups = useMemo(() => {
    const visible = envelopes.filter((e) => !e.hidden);
    return orderGroups(
      visible.map((e) => e.group),
      groupOrder,
    ).map((name) => ({
      name,
      items: visible.filter((e) => e.group === name).sort((a, b) => a.order - b.order),
    }));
  }, [envelopes, groupOrder]);

  const rta = budget.readyToAssign;
  // Spending and savings, once there's a savings account; null means one pool.
  const { pools, readyFor } = usePools(budget);
  const envelopeById = new Map(envelopes.map((e) => [e.id, e] as const));
  const groupY = useRef<Record<string, number>>({});
  // A past month is drawn in greys so it never passes for this month.
  const past = month < thisMonth;
  // A later month: money assigned here is set aside now and counts in that month.
  const ahead = month > thisMonth;
  const hueFor = (group: string) => (past ? colors.textTertiary : groupColor(group));
  const date = assignDateFor(month, today());
  // Debt payments aim for what each debt's page says: the minimum or a custom amount.
  const debtTargets = new Map(
    envelopes.filter((e) => e.debtAccountId).map((e) => [e.id, ceilDollars(debtFor(e)?.target ?? 0)] as const),
  );
  const gaps = targetGaps(envelopes, budget, debtTargets);
  const existing = new Set(envelopes.filter((e) => !e.hidden).map((e) => e.name.toLowerCase()));
  // Suggestions stay until you tap Done or have added them all, so you can add several.
  const starters = startersDone || past ? [] : STARTERS.filter((s) => !existing.has(s.name.toLowerCase()));
  const spendable = envelopes.filter((e) => !e.debtAccountId);

  function fill(entries: { envelopeId: string; amount: number }[], message: string) {
    // Whole dollars only: the cents in Ready to assign stay put. Each envelope draws on its own pool.
    const left: Record<string, number> = pools
      ? { spending: floorDollars(pools.spending.readyToAssign), savings: floorDollars(pools.savings.readyToAssign) }
      : { all: floorDollars(rta) };
    const poolOf = (id: string) => (pools ? envelopePool(envelopeById.get(id) ?? { group: '' }) : 'all');
    const capped = entries
      .map((e) => {
        const k = poolOf(e.envelopeId);
        const amount = Math.min(e.amount, Math.max(left[k], 0));
        left[k] -= amount;
        return { ...e, amount, date };
      })
      .filter((e) => e.amount > 0);
    if (!capped.length) {
      showToast({ message: 'Nothing left to assign this month' });
      return;
    }
    const ids = assignMany(capped);
    showToast({
      message,
      actionLabel: 'Undo',
      onAction: () => removeAllocations(ids),
    });
  }

  function debtFor(e: Envelope) {
    if (!e.debtAccountId) return undefined;
    const a = accounts.find((x) => x.id === e.debtAccountId);
    const owed = -(ledger.balance.get(e.debtAccountId) ?? 0);
    return { owed, target: a ? debtTarget(a, owed) : 0 };
  }

  // Targets in the order the envelopes are listed, so the top of the list fills first.
  const listed = groups.flatMap((g) => g.items.map((e) => e.id));
  const orderedGaps = [...gaps].sort((a, b) => listed.indexOf(a.envelopeId) - listed.indexOf(b.envelopeId));

  const assignedTotal = listed.reduce((sum, id) => sum + (budget.envelopes.get(id)?.assigned ?? 0), 0);
  function unassignAll() {
    if (!confirmUnassign) {
      setConfirmUnassign(true);
      setTimeout(() => setConfirmUnassign(false), 4000);
      return;
    }
    setConfirmUnassign(false);
    const ids = assignMany(
      listed
        .map((id) => ({ envelopeId: id, amount: -(budget.envelopes.get(id)?.assigned ?? 0), date }))
        .filter((e) => e.amount !== 0),
    );
    haptic('warning');
    showToast({
      message: `Sent ${formatDollars(assignedTotal)} back to Ready to assign`,
      actionLabel: 'Undo',
      onAction: () => removeAllocations(ids),
    });
  }

  function startSorting() {
    haptic('light');
    setSorting(
      groups.map((g) => ({
        name: g.name,
        color: groupColor(g.name),
        locked: isManagedGroup(g.name),
        items: g.items.map((e) => ({ id: e.id, name: e.name })),
      })),
    );
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }

  function confirmSorting() {
    if (!sorting) return;
    reorderEnvelopes(
      sorting.filter((g) => g.items.length).map((g) => ({ name: g.name, ids: g.items.map((i) => i.id) })),
    );
    haptic('success');
    setSorting(null);
    showToast({ message: 'Order saved' });
  }

  if (sorting) {
    return (
      <>
        <Screen ref={scrollRef} onScroll={onScroll} scrollEnabled={!dragging}>
          <ScreenTitle title="Sort envelopes" />
          <SortList groups={sorting} onChange={setSorting} scroller={{ offset, scrollBy }} onDragChange={setDragging} />
        </Screen>
        <ScreenActions>
          <ActionButton label="Cancel" onPress={() => setSorting(null)} />
          <ActionButton
            label="Confirm"
            variant="accent"
            icon={{ sf: 'checkmark', md: 'check' }}
            onPress={confirmSorting}
          />
        </ScreenActions>
      </>
    );
  }

  return (
    <>
      <Screen ref={scrollRef} onScroll={onScroll}>
        <ScreenTitle title={`Budget · ${monthYear.format(asDate(month))}`} />

        {past && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              borderRadius: radius.card,
              backgroundColor: colors.textSecondary,
            }}
          >
            <Icon sf="clock.arrow.circlepath" md="history" size={18} color={colors.onInk} />
            <Text variant="body" weight="600" tone="onInk" style={{ flex: 1 }}>
              Past month: {monthOnly.format(asDate(month))}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setMonth(thisMonth)}
              style={({ pressed }) => ({
                height: 30,
                paddingHorizontal: spacing.md,
                borderRadius: radius.button,
                justifyContent: 'center',
                backgroundColor: colors.surface,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text variant="callout" weight="600">
                Back to {monthOnly.format(asDate(thisMonth))}
              </Text>
            </Pressable>
          </View>
        )}

        {ahead && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              borderRadius: radius.card,
              backgroundColor: colors.accentSoft,
            }}
          >
            <Icon sf="calendar.badge.plus" md="event_upcoming" size={18} color={colors.accent} />
            <View style={{ flex: 1, gap: 1 }}>
              <Text variant="body" weight="600" tone="accent">
                Planning ahead: {monthOnly.format(asDate(month))}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => setMonth(thisMonth)}
              style={({ pressed }) => ({
                height: 30,
                paddingHorizontal: spacing.md,
                borderRadius: radius.button,
                justifyContent: 'center',
                backgroundColor: colors.surface,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text variant="callout" weight="600">
                Back to {monthOnly.format(asDate(thisMonth))}
              </Text>
            </Pressable>
          </View>
        )}

        {pools ? (
          <SplitToAssign
            pools={pools}
            past={past}
            onFixEnvelopes={(pool) => {
              const first = groups.find((g) => envelopePool({ group: g.name }) === pool);
              const y = first ? groupY.current[first.name] : undefined;
              if (y !== undefined) scrollRef.current?.scrollTo({ y: Math.max(0, y - spacing.md), animated: true });
            }}
          />
        ) : (
          <LeftToAssign cents={rta} past={past} />
        )}
        {month === thisMonth && (
          <View style={{ paddingHorizontal: spacing.xs, marginTop: -spacing.xs }}>
            <AssignedAheadNote />
          </View>
        )}

        {groups.length > 0 && (
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <TopControl
              icon={{ sf: 'bolt.fill', md: 'bolt' }}
              title="Auto-assign"
              tint={past ? colors.textSecondary : colors.accent}
              disabled={!gaps.some((g) => readyFor(envelopeById.get(g.envelopeId) ?? { group: '' }) >= 100)}
              onPress={() => {
                haptic('light');
                fill(
                  orderedGaps.map((g) => ({ envelopeId: g.envelopeId, amount: g.need })),
                  `Auto-assigned ${gaps.length} ${gaps.length === 1 ? 'envelope' : 'envelopes'}`,
                );
              }}
            />
            <TopControl
              icon={{ sf: 'arrow.up.arrow.down', md: 'swap_vert' }}
              title="Sort"
              tint={colors.textSecondary}
              onPress={startSorting}
            />
          </View>
        )}

        {starters.length > 0 && (
          <Card>
            <CardHeader
              title="Make your envelopes"
              action={{ label: 'Done', onPress: () => updateSettings({ startersDone: true }) }}
            />
            <View style={{ paddingTop: spacing.xs }}>
              {starters.map((s, i, list) => (
                <Pressable
                  key={s.name}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${s.name} to ${s.group}`}
                  onPress={() => addEnvelope({ ...s, month })}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.sm,
                    paddingHorizontal: spacing.md + 2,
                    paddingVertical: 9,
                    borderBottomWidth: i < list.length - 1 ? 1 : 0,
                    borderBottomColor: colors.hairline,
                    backgroundColor: pressed ? colors.control : colors.surface,
                  })}
                >
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: groupColor(s.group),
                    }}
                  />
                  <Text variant="body" weight="500" style={{ flex: 1 }}>
                    {s.name}
                  </Text>
                  <Text variant="footnote" tone="textSecondary">
                    {s.group}
                  </Text>
                  <Text variant="footnote" weight="600" tone="accent" style={{ marginLeft: spacing.sm }}>
                    Add
                  </Text>
                </Pressable>
              ))}
            </View>
          </Card>
        )}

        {groups.length > 0 && (
          <View
            style={{
              flexDirection: 'row',
              paddingHorizontal: spacing.md + 2,
              marginBottom: -6,
            }}
          >
            <Text variant="label" tone="textTertiary" style={{ flex: 1 }}>
              ENVELOPE
            </Text>
            {['ASSIGNED', 'SPENT', 'LEFT'].map((l) => (
              // Centered over its column; it may run a little past the box (ASSIGNED is wider) without wrapping.
              <View key={l} style={{ width: COL, marginLeft: COL_GAP, alignSelf: 'stretch' }}>
                <Text
                  variant="label"
                  tone="textTertiary"
                  align="center"
                  numberOfLines={1}
                  style={{ position: 'absolute', left: -12, right: -12, top: 0 }}
                >
                  {l}
                </Text>
              </View>
            ))}
          </View>
        )}

        {groups.map((g) => {
          // Add up the rounded Left column, so the header always matches the rows under it.
          const total = g.items.reduce((a, e) => a + floorDollars(budget.envelopes.get(e.id)?.available ?? 0), 0);
          const hue = hueFor(g.name);
          return (
            <View key={g.name} onLayout={(e) => (groupY.current[g.name] = e.nativeEvent.layout.y)}>
              <Card>
                <CardHeader
                  title={g.name}
                  dot={hue}
                  detail={
                    pools
                      ? `${groupSummary(g.name, total)} · ${POOL_SOURCE[envelopePool({ group: g.name })]}`
                      : groupSummary(g.name, total)
                  }
                />
                {g.items.map((e, i) => {
                  const row = budget.envelopes.get(e.id) ?? EMPTY;
                  const status = envelopeStatus(e, row, month, debtFor(e));
                  const ready = readyFor(e);
                  const canFill = status.need > 0 && ready >= 100;
                  return (
                    <SwipeRow
                      key={e.id}
                      left={
                        canFill
                          ? {
                              label: `${status.fillLabel} ${formatDollars(Math.min(status.need, ready))}`,
                              sf: 'plus',
                              md: 'add',
                              color: past ? colors.textSecondary : colors.positive,
                              onTrigger: () =>
                                fill(
                                  [{ envelopeId: e.id, amount: status.need }],
                                  `${status.fillLabel === 'Cover' ? 'Covered' : 'Filled'} ${e.name}`,
                                ),
                            }
                          : undefined
                      }
                      right={
                        // A debt's payment envelope has nothing to edit: its name and target come from the debt.
                        e.debtAccountId
                          ? undefined
                          : {
                              label: 'Edit',
                              sf: 'slider.horizontal.3',
                              md: 'tune',
                              color: past ? colors.textTertiary : colors.accent,
                              onTrigger: () =>
                                router.push({
                                  pathname: '/envelope/[id]',
                                  params: { id: e.id, month },
                                }),
                            }
                      }
                    >
                      <EnvelopeRow
                        envelope={e}
                        snoozed={!e.debtAccountId && isSnoozed(e, month) && !!targetSetFor(e, month)}
                        row={row}
                        overspent={status.overspent}
                        bar={targetBar(e, row, month, debtFor(e))}
                        need={past ? 0 : status.need}
                        last={i === g.items.length - 1}
                        past={past}
                        onEditingChange={(on, view) => {
                          revealAboveKeyboard(on ? view : null);
                        }}
                        onAssign={(cents) => assign(e.id, cents - row.assigned, date)}
                        onMoveBack={(cents) => {
                          const ids = assignMany([{ envelopeId: e.id, amount: -cents, date }]);
                          showToast({
                            message: `Moved ${formatDollars(cents)} back to Ready to assign`,
                            actionLabel: 'Undo',
                            onAction: () => removeAllocations(ids),
                          });
                        }}
                        onPress={() =>
                          router.push({
                            pathname: '/budget/[id]',
                            params: { id: e.id, month },
                          })
                        }
                      />
                    </SwipeRow>
                  );
                })}
              </Card>
            </View>
          );
        })}

        {spendable.length > 0 && (
          <Card>
            <CardHeader title={formatMonth(month)} detail={`${formatDollars(rta)} to assign`} />
            <ControlRow
              icon={{ sf: 'arrow.uturn.backward', md: 'undo' }}
              tint={colors.negative}
              soft={colors.negativeSoft}
              title={confirmUnassign ? `Tap again to unassign ${formatDollars(assignedTotal)}` : 'Unassign all'}
              danger
              disabled={assignedTotal === 0}
              last
              onPress={unassignAll}
            />
          </Card>
        )}
      </Screen>

      <ScreenActions>
        <Dropdown variant="compact" value={month} options={monthOptions} onChange={setMonth} label="Month" />
        <ActionButton
          variant="ink"
          icon={{ sf: 'plus', md: 'add' }}
          accessibilityLabel="New envelope"
          onPress={() => router.push({ pathname: '/new-envelope', params: { month } })}
        />
      </ScreenActions>
    </>
  );
}

/**
 * The Left amount, always a colored pill (see leftPillState): yellow means a target needs
 * money, green means good to spend, red means overspent. It's never typed into. Tapping
 * it offers to move money back to Ready to assign: all of it, or an amount you type.
 */
export function LeftCell({
  row,
  bar,
  past,
  tone,
  onEditingChange,
  onMoveBack,
  width = COL,
  onCustomAmount,
  align = 'center',
}: {
  /** Centered on the phone; the desktop's table lines amounts up on the right. */
  align?: 'center' | 'right';
  /** The box's width; the phone's columns are COL, the desktop's wider. */
  width?: number;
  /** Where "Move a custom amount" types its amount instead of the number pad (the desktop's details panel). */
  onCustomAmount?: () => void;
  row: EnvelopeMonth;
  bar: TargetBar | null;
  past: boolean;
  tone: 'negative' | 'textTertiary' | 'text';
  onEditingChange: (editing: boolean, view: React.ComponentRef<typeof View> | null) => void;
  onMoveBack: (cents: number) => void;
}) {
  const colors = useColors();
  const cell = useRef<React.ComponentRef<typeof View>>(null);
  // Whole dollars only, like the rest of the budget: the cents stay put.
  const max = floorDollars(row.available);
  const movable = !past && max >= 100;
  const pad = useKeypadField({
    value: '',
    mode: 'whole',
    live: false,
    title: `Move back to Ready to assign (up to ${formatDollars(max)})`,
    showValue: true,
    onDone: (cents) => {
      const amount = Math.min(max, Math.max(0, cents ?? 0));
      if (amount > 0) onMoveBack(amount);
    },
    onClose: () => onEditingChange(false, null),
  });
  // A past month stays grey, so it never passes for this month.
  const pill = past ? null : LEFT_PILL[leftPillState(row, bar)](colors);
  return (
    <View ref={cell} collapsable={false} style={{ width, marginLeft: COL_GAP }}>
      <ActionMenu
        header={<LeftMath row={row} />}
        items={[
          {
            label: 'Move all back',
            detail: formatDollars(max),
            icon: { sf: 'arrow.uturn.backward', md: 'undo' },
            disabled: !movable,
            onPress: () => onMoveBack(max),
          },
          {
            label: 'Move a custom amount',
            icon: { sf: 'number', md: 'dialpad' },
            disabled: !movable,
            onPress: () => {
              if (onCustomAmount) return onCustomAmount();
              pad.open();
              onEditingChange(true, cell.current);
            },
          },
        ]}
        accessibilityLabel={`${formatDollars(row.available)} left. See how it adds up or move it back to Ready to assign`}
        hitSlop={8}
        style={({ pressed, open }) => ({
          // The same box as the Assigned chip: same width and padding in every row.
          width,
          height: 24,
          paddingHorizontal: COL_PAD,
          borderRadius: 6,
          justifyContent: 'center',
          backgroundColor: pill?.bg ?? (open || pressed ? colors.control : 'transparent'),
          opacity: pressed && pill ? 0.7 : 1,
        })}
      >
        <Text
          variant="row"
          weight="600"
          align={align}
          tone={pill ? undefined : tone}
          color={pill?.fg}
          style={{ fontVariant: ['tabular-nums'] }}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {formatDollars(row.available)}
        </Text>
      </ActionMenu>
    </View>
  );
}

/**
 * How Left adds up, at the top of its menu: everything left from earlier months, plus
 * what was assigned this month, minus what was spent. Exact cents, so it checks out.
 */
export function LeftMath({ row }: { row: EnvelopeMonth }) {
  const colors = useColors();
  const line = (label: string, cents: number, opts: { sign?: boolean; bold?: boolean } = {}) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', height: 22 }}>
      <Text
        variant="footnote"
        tone={opts.bold ? 'text' : 'textSecondary'}
        weight={opts.bold ? '600' : '400'}
        style={{ flex: 1 }}
      >
        {label}
      </Text>
      <Text
        variant="footnote"
        weight={opts.bold ? '600' : '400'}
        tone={opts.bold && cents < 0 ? 'negative' : opts.bold ? 'text' : 'textSecondary'}
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {formatMoney(cents, { signed: opts.sign })}
      </Text>
    </View>
  );
  // Money in and out besides spending (a refund, a slip's payment) also counts.
  const other = row.activity + row.spent;
  return (
    <View
      style={{
        paddingHorizontal: 9,
        paddingTop: 6,
        paddingBottom: 8,
        marginBottom: 4,
        borderBottomWidth: 1,
        borderBottomColor: colors.hairline,
      }}
    >
      {line('From earlier months', row.carriedIn, { sign: true })}
      {line('Assigned this month', row.assigned, { sign: true })}
      {line('Spent this month', -row.spent, { sign: true })}
      {other !== 0 && line('Other money in', other, { sign: true })}
      {line('Left', row.available, { bold: true })}
    </View>
  );
}

/** The Left pill's colors for each state: green funded or money to spend, yellow short, grey at zero, red over. */
export const LEFT_PILL: Record<TargetBar['state'], (c: ReturnType<typeof useColors>) => { bg: string; fg: string }> = {
  funded: (c) => ({ bg: c.positiveSoft, fg: c.positive }),
  short: (c) => ({ bg: c.cautionSoft, fg: c.caution }),
  empty: (c) => ({ bg: c.control, fg: c.textTertiary }),
  over: (c) => ({ bg: c.negativeSoft, fg: c.negative }),
};

/**
 * One envelope: name, then Assigned (tap to edit), Spent and Left in equal columns, and
 * a 3px bar in the group color (red and full when overspent). Greys only in a past month.
 */
function EnvelopeRow({
  envelope,
  snoozed,
  row,
  overspent,
  bar,
  need,
  onMoveBack,
  last,
  past,
  onEditingChange,
  onAssign,
  onPress,
}: {
  envelope: Envelope;
  /** Its target is snoozed this month. */
  snoozed?: boolean;
  row: EnvelopeMonth;
  overspent: boolean;
  /** Set when the envelope has a target: the bar shows how funded it is. */
  bar: TargetBar | null;
  /** What Fill target on the number pad adds. */
  need: number;
  /** Sends some of what's left back to Ready to assign. */
  onMoveBack: (cents: number) => void;
  last: boolean;
  past: boolean;
  onEditingChange: (editing: boolean, view: React.ComponentRef<typeof View> | null) => void;
  onAssign: (cents: number) => void;
  onPress: () => void;
}) {
  const colors = useColors();
  const swiping = useSwipeGuard();
  const red = overspent && !past;
  const leftTone = red ? 'negative' : row.available < 100 || past ? 'textTertiary' : 'text';
  return (
    <View
      style={{
        paddingHorizontal: spacing.md + 2,
        paddingVertical: 11,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.hairline,
        backgroundColor: colors.surface,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${envelope.name}, ${formatDollars(row.available)} left. Open`}
          onPress={() => !swiping() && onPress()}
          hitSlop={{ top: 9, bottom: 9 }}
          style={({ pressed }) => ({
            flex: 1,
            minWidth: 0,
            // Room between a long name's "…" and the Assigned chip.
            paddingRight: 2,
            opacity: pressed ? 0.5 : 1,
          })}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <Text style={{ width: 20, textAlign: 'center', fontSize: 16, lineHeight: 20, opacity: past ? 0.6 : 1 }}>
              {envelopeEmoji(envelope)}
            </Text>
            <Text
              variant="body"
              weight="500"
              tone={red ? 'negative' : past ? 'textSecondary' : 'text'}
              numberOfLines={1}
              ellipsizeMode="tail"
              style={{ flexShrink: 1, minWidth: 0 }}
            >
              {envelope.name}
            </Text>
            {snoozed && (
              <View accessibilityLabel="Target snoozed this month">
                <Icon sf="moon.zzz" md="snooze" size={13} color={colors.textTertiary} />
              </View>
            )}
            <View style={{ flex: 1 }} />
          </View>
        </Pressable>
        <View style={{ marginLeft: COL_GAP }}>
          <InlineAmount
            exact
            align="center"
            cents={row.assigned}
            width={COL}
            accessibilityLabel={`Assigned to ${envelope.name}`}
            muted={past}
            onEditingChange={onEditingChange}
            onCommit={onAssign}
            actions={[
              {
                label: need > 0 ? `Fill ${formatDollars(need)}` : 'Target met',
                icon: { sf: 'bolt.fill', md: 'bolt' },
                disabled: need <= 0,
                onPress: () => {
                  closeKeypad();
                  onAssign(row.assigned + need);
                },
              },
              {
                label: 'Details',
                icon: { sf: 'ellipsis', md: 'more_horiz' },
                onPress: () => {
                  closeKeypad();
                  onPress();
                },
              },
            ]}
          />
        </View>
        <Text
          variant="row"
          tone="textSecondary"
          align="center"
          numberOfLines={1}
          style={{ width: COL, marginLeft: COL_GAP, fontVariant: ['tabular-nums'] }}
        >
          {formatDollars(row.spent, 'up')}
        </Text>
        <LeftCell
          row={row}
          bar={bar}
          past={past}
          tone={leftTone}
          onEditingChange={onEditingChange}
          onMoveBack={onMoveBack}
        />
      </View>
    </View>
  );
}

/** Auto-assign and Sort, side by side at the top of the budget. */
function TopControl({
  icon,
  title,
  tint,
  disabled,
  onPress,
}: {
  icon: { sf: Parameters<typeof Icon>[0]['sf']; md: Parameters<typeof Icon>[0]['md'] };
  title: string;
  tint: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        height: 40,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        borderRadius: radius.control,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: pressed ? colors.control : colors.surface,
        opacity: disabled ? 0.45 : 1,
      })}
    >
      <Icon sf={icon.sf} md={icon.md} size={13} color={tint} weight="semibold" />
      <Text variant="callout" weight="600" color={disabled ? colors.textSecondary : colors.text}>
        {title}
      </Text>
    </Pressable>
  );
}

/** One of the month controls at the bottom of the budget: icon tile, title, one line. */
function ControlRow({
  icon,
  tint,
  soft,
  title,
  danger,
  disabled,
  last,
  onPress,
}: {
  icon: { sf: Parameters<typeof Icon>[0]['sf']; md: Parameters<typeof Icon>[0]['md'] };
  tint: string;
  soft: string;
  title: string;
  danger?: boolean;
  disabled?: boolean;
  last?: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingHorizontal: spacing.md + 2,
        paddingVertical: 12,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.hairline,
        backgroundColor: pressed ? colors.control : colors.surface,
        opacity: disabled ? 0.45 : 1,
      })}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          backgroundColor: soft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon sf={icon.sf} md={icon.md} size={14} color={tint} weight="semibold" />
      </View>
      <Text variant="body" weight="600" tone={danger ? 'negative' : 'text'} style={{ flex: 1 }}>
        {title}
      </Text>
    </Pressable>
  );
}

/**
 * The top of the budget once there's a savings account: spending money (checking) on the
 * left and savings on the right, each with what's left to assign. A side that's short
 * turns red and says how to fix it: move money over from the other account, or take it
 * back out of an envelope.
 */
function SplitToAssign({
  pools,
  past,
  onFixEnvelopes,
}: {
  pools: Record<Pool, PoolView>;
  past: boolean;
  onFixEnvelopes: (pool: Pool) => void;
}) {
  const colors = useColors();
  const shorts = (['spending', 'savings'] as const).filter((p) => !past && floorDollars(pools[p].readyToAssign) < 0);
  const half = (p: Pool, i: number) => {
    const left = floorDollars(pools[p].readyToAssign);
    const look = past || left === 0 ? 'zero' : left < 0 ? 'short' : 'ok';
    const ink = look === 'short' ? colors.negative : look === 'ok' ? colors.positive : colors.textSecondary;
    const soft = look === 'short' ? colors.negativeInk : look === 'ok' ? colors.okInk : colors.textSecondary;
    return (
      <View
        key={p}
        accessibilityRole="summary"
        style={{
          flex: 1,
          gap: 2,
          paddingHorizontal: spacing.md + 2,
          paddingVertical: spacing.md + 2,
          backgroundColor: look === 'short' ? colors.negativeSoft : look === 'ok' ? colors.okSoft : colors.neutralSoft,
          borderLeftWidth: i ? 1 : 0,
          borderLeftColor: colors.separator,
        }}
      >
        <Text variant="label" caps color={soft}>
          {POOL_NAME[p]}
        </Text>
        {left === 0 ? (
          <Text variant="section" color={ink} style={{ lineHeight: 32 }}>
            All assigned
          </Text>
        ) : (
          <AnimatedNumber
            variant="display"
            color={ink}
            value={left}
            format={(v) => (v < 0 ? `−${formatDollars(-v)}` : formatDollars(v))}
          />
        )}
        <Text variant="footnote" color={soft} numberOfLines={1}>
          {left < 0
            ? `short · ${pools[p].accountsLabel}`
            : left === 0
              ? pools[p].accountsLabel
              : `to assign · ${pools[p].accountsLabel}`}
        </Text>
      </View>
    );
  };
  const short = shorts[0];
  const other: Pool | undefined = short === 'savings' ? 'spending' : short === 'spending' ? 'savings' : undefined;
  return (
    <View
      style={{
        borderRadius: radius.card,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
        backgroundColor: colors.surface,
      }}
    >
      <View style={{ flexDirection: 'row' }}>{(['spending', 'savings'] as const).map(half)}</View>
      {short && other && (
        <View
          accessibilityLiveRegion="polite"
          style={{
            gap: spacing.md - 2,
            padding: spacing.md + 2,
            borderTopWidth: 1,
            borderTopColor: colors.negativeBorder,
            backgroundColor: colors.negativeTint,
          }}
        >
          <Text variant="callout" color={colors.negativeInk}>
            <Text variant="callout" weight="600" tone="negative">
              {shorts.length === 2
                ? 'You’re overspent in spending and savings. '
                : `You’re overspent in ${short === 'savings' ? 'savings' : 'spending'}. `}
            </Text>
            {shorts.length === 2
              ? 'Both hold less than their envelopes. Take money back out of envelopes until they match.'
              : `${pools[short].accountsLabel} holds ${formatMoney(-pools[short].readyToAssign)} less than your ${
                  short === 'savings' ? 'Savings envelopes' : 'spending envelopes'
                }. Move money over from ${other === 'savings' ? 'savings' : 'checking'}, or take it out of an envelope.`}
          </Text>
          {/* Stacked, so a four-digit amount always fits on the phone. */}
          <View style={{ gap: spacing.sm }}>
            {shorts.length === 1 && (
              <Pressable
                accessibilityRole="button"
                onPress={() => coverShortfall(pools, short)}
                style={({ pressed }) => ({
                  height: 40,
                  borderRadius: radius.control,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.accent,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text variant="callout" weight="600" tone="onInk" numberOfLines={1}>
                  Move {formatDollars(moveToCover(pools[short]))} from {other === 'savings' ? 'savings' : 'checking'}
                </Text>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              onPress={() => onFixEnvelopes(short)}
              style={({ pressed }) => ({
                height: 40,
                borderRadius: radius.control,
                borderWidth: 1,
                borderColor: colors.borderStrong,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: pressed ? colors.control : colors.surface,
              })}
            >
              <Text variant="callout" weight="600" numberOfLines={1}>
                Fix in envelopes
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

/**
 * The top of the budget, one message: green while money is waiting for a job, red when
 * more is assigned than you have, grey with a check once every dollar is assigned.
 * Whole dollars, rounded down, so a few leftover cents count as assigned.
 */
function LeftToAssign({ cents, past }: { cents: number; past: boolean }) {
  const colors = useColors();
  const left = floorDollars(cents);
  if (left === 0) {
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          padding: spacing.lg,
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.neutralSoft,
        }}
      >
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: past ? colors.textTertiary : colors.positive,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon sf="checkmark" md="check" size={12} color={colors.onInk} weight="bold" />
        </View>
        <Text variant="section" tone="textSecondary">
          All money assigned
        </Text>
      </View>
    );
  }
  const over = left < 0;
  const ink = past ? colors.textSecondary : over ? colors.negative : colors.positive;
  const soft = past ? colors.textSecondary : over ? colors.negativeInk : colors.okInk;
  return (
    <View
      accessibilityRole="summary"
      style={{
        alignItems: 'center',
        gap: 2,
        padding: spacing.lg,
        borderRadius: radius.card,
        borderWidth: 1,
        borderColor: past ? colors.border : over ? colors.negativeBorder : colors.positiveBorder,
        backgroundColor: past ? colors.neutralSoft : over ? colors.negativeSoft : colors.okSoft,
      }}
    >
      <Text variant="callout" color={soft}>
        {over ? 'You assigned' : 'You have'}
      </Text>
      <AnimatedNumber variant="display" color={ink} value={Math.abs(left)} format={formatDollars} />
      <Text variant="callout" color={soft}>
        {over ? 'more than you have' : 'left to assign'}
      </Text>
    </View>
  );
}
