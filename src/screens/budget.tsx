import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AnimatedNumber } from '@/components/animated-number';
import { Card, CardHeader } from '@/components/card';
import { Dropdown } from '@/components/dropdown';
import { Icon } from '@/components/icon';
import { AmountKeyboardBar, InlineAmount } from '@/components/inline-amount';
import { debtTarget } from '@/domain/debt';
import { targetKindOf } from '@/domain/targets';
import { Screen } from '@/components/screen';
import { ActionButton, ScreenActions } from '@/components/screen-actions';
import { ScreenTitle } from '@/components/screen-title';
import { SortList, type SortGroup } from '@/components/sort-list';
import { SwipeRow, useSwipeGuard } from '@/components/swipe-row';
import { Text } from '@/components/text';
import { useToast } from '@/components/toast';
import { today } from '@/domain/dates';
import { ceilDollars, floorDollars, formatDollars } from '@/domain/money';
import { assignDateFor, formatMonth, targetGaps, type EnvelopeMonth, type MonthKey } from '@/domain/months';
import type { Envelope } from '@/domain/types';
import { currentMonth, useBudgetMonth } from '@/hooks/use-budget-month';
import { useKeyboardReveal } from '@/hooks/use-keyboard-reveal';
import { useLedger } from '@/hooks/use-ledger';
import { isManagedGroup, useStore } from '@/store';
import { groupColor, radius, spacing, useColors } from '@/theme';
import { envelopeStatus, groupSummary, targetBar, type TargetBar } from '@/utils/envelope-status';
import { envelopeEmoji } from '@/utils/envelope-emoji';
import { orderGroups } from '@/utils/group-order';
import { haptic } from '@/utils/haptics';
import { useMonthOptions } from '@/utils/month-options';

const STARTERS: { name: string; group: string }[] = [
  { name: 'Groceries', group: 'Daily' },
  { name: 'Eating Out', group: 'Daily' },
  { name: 'Gas', group: 'Daily' },
  { name: 'Fun Money', group: 'Daily' },
  { name: 'Emergency Fund', group: 'Savings' },
  { name: 'Car Repairs', group: 'Savings' },
  { name: 'Gifts', group: 'Savings' },
];

/** Assigned, Spent and Left share one width, so the columns always line up. Names get "…" first. */
const COL = 70;
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
  const monthOptions = useMonthOptions().map((o) => ({
    ...o,
    label: monthOnly.format(asDate(o.value)),
  }));

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
  // A past month is drawn in greys so it never passes for this month.
  const past = month < thisMonth;
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
    // Whole dollars only: the cents in Ready to assign stay put.
    let left = floorDollars(rta);
    const capped = entries
      .map((e) => {
        const amount = Math.min(e.amount, Math.max(left, 0));
        left -= amount;
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
    reorderEnvelopes(sorting.filter((g) => g.items.length).map((g) => ({ name: g.name, ids: g.items.map((i) => i.id) })));
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
          <ActionButton label="Confirm" variant="accent" icon={{ sf: 'checkmark', md: 'check' }} onPress={confirmSorting} />
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

        <LeftToAssign cents={rta} past={past} />

        {starters.length > 0 && (
          <Card>
            <CardHeader
              title="Make your envelopes"
              action={{ label: 'Done', onPress: () => updateSettings({ startersDone: true }) }}
            />
            <Text
              variant="callout"
              tone="textSecondary"
              style={{
                paddingHorizontal: spacing.md + 2,
                paddingTop: spacing.md - 2,
              }}
            >
              Bills and Daily are money you spend each month. Savings is money you add each month and leave alone.
            </Text>
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
              <Text key={l} variant="label" tone="textTertiary" align="right" style={{ width: COL }}>
                {l}
              </Text>
            ))}
          </View>
        )}

        {groups.map((g) => {
          // Add up the rounded Left column, so the header always matches the rows under it.
          const total = g.items.reduce((a, e) => a + floorDollars(budget.envelopes.get(e.id)?.available ?? 0), 0);
          const hue = hueFor(g.name);
          return (
            <Card key={g.name}>
              <CardHeader title={g.name} dot={hue} detail={groupSummary(g.name, total)} />
              {g.items.map((e, i) => {
                const row = budget.envelopes.get(e.id) ?? EMPTY;
                const status = envelopeStatus(e, row, month, debtFor(e));
                const canFill = status.need > 0 && rta >= 100;
                return (
                  <SwipeRow
                    key={e.id}
                    left={
                      canFill
                        ? {
                            label: `${status.fillLabel} ${formatDollars(Math.min(status.need, rta))}`,
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
                      row={row}
                      color={hue}
                      progress={status.progress}
                      overspent={status.overspent}
                      bar={targetBar(e, row, month, debtFor(e))}
                      last={i === g.items.length - 1}
                      past={past}
                      onEditingChange={(on, view) => {
                        revealAboveKeyboard(on ? view : null);
                      }}
                      onAssign={(cents) => assign(e.id, cents - row.assigned, date)}
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
          );
        })}

        {spendable.length > 0 && (
          <Card>
            <CardHeader title={formatMonth(month)} detail={`${formatDollars(rta)} to assign`} />
            <ControlRow
              icon={{ sf: 'bolt.fill', md: 'bolt' }}
              tint={past ? colors.textSecondary : colors.accent}
              soft={past ? colors.control : colors.accentSoft}
              title="Auto-assign"
              disabled={gaps.length === 0 || rta < 100}
              onPress={() => {
                haptic('light');
                fill(
                  orderedGaps.map((g) => ({ envelopeId: g.envelopeId, amount: g.need })),
                  `Auto-assigned ${gaps.length} ${gaps.length === 1 ? 'envelope' : 'envelopes'}`,
                );
              }}
            />
            <ControlRow
              icon={{ sf: 'arrow.up.arrow.down', md: 'swap_vert' }}
              tint={colors.textSecondary}
              soft={colors.control}
              title="Sort envelopes"
              onPress={startSorting}
            />
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
      <AmountKeyboardBar />

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

/** Target bar colors: yellow short of the target, green funded, red over. Empty shows only the grey track. */
const BAR_COLOR: Record<TargetBar['state'], (c: ReturnType<typeof useColors>) => string> = {
  short: (c) => c.cautionDot,
  funded: (c) => c.positive,
  empty: (c) => c.fill,
  over: (c) => c.negativeStrong,
};

/**
 * One envelope: name, then Assigned (tap to edit), Spent and Left in equal columns, and
 * a 3px bar in the group color (red and full when overspent). Greys only in a past month.
 */
function EnvelopeRow({
  envelope,
  row,
  color,
  progress,
  overspent,
  bar,
  last,
  past,
  onEditingChange,
  onAssign,
  onPress,
}: {
  envelope: Envelope;
  row: EnvelopeMonth;
  color: string;
  progress: number;
  overspent: boolean;
  /** Set when the envelope has a target: the bar shows how funded it is. */
  bar: TargetBar | null;
  last: boolean;
  past: boolean;
  onEditingChange: (editing: boolean, view: React.ComponentRef<typeof View> | null) => void;
  onAssign: (cents: number) => void;
  onPress: () => void;
}) {
  const colors = useColors();
  const swiping = useSwipeGuard();
  const savings = targetKindOf(envelope) === 'goal' && !envelope.debtAccountId;
  const red = overspent && !past;
  const leftTone = red ? 'negative' : row.available < 100 || past ? 'textTertiary' : 'text';
  return (
    <View
      style={{
        gap: 6,
        paddingHorizontal: spacing.md + 2,
        paddingVertical: 9,
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
              // Room between a long name's "…" and the Assigned chip, which reaches 6pt into this side.
              paddingRight: spacing.md,
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
                style={{ flex: 1, minWidth: 0 }}
              >
                {envelope.name}
              </Text>
            </View>
          </Pressable>
          <InlineAmount
            cents={row.assigned}
            width={COL}
            accessibilityLabel={`Assigned to ${envelope.name}`}
            muted={past}
            onEditingChange={onEditingChange}
            onCommit={onAssign}
          />
          <Text variant="row" tone="textSecondary" align="right" style={{ width: COL, fontVariant: ['tabular-nums'] }}>
            {formatDollars(row.spent, 'up')}
          </Text>
          <Text
            variant="row"
            weight="600"
            tone={leftTone}
            align="right"
            style={{ width: COL, fontVariant: ['tabular-nums'] }}
          >
            {formatDollars(row.available)}
          </Text>
        </View>
        {(bar || !savings) && (
          <View
            style={{
              height: 3,
              borderRadius: 2,
              backgroundColor: !bar && overspent ? (past ? colors.textSecondary : colors.negativeStrong) : colors.fill,
            }}
          >
            {(bar ? bar.progress : overspent ? 0 : progress) > 0 && (
              <Animated.View
                style={{
                  width: `${Math.min(1, bar ? bar.progress : progress) * 100}%`,
                  height: 3,
                  borderRadius: 2,
                  backgroundColor: bar ? (past ? colors.textTertiary : BAR_COLOR[bar.state](colors)) : color,
                  transitionProperty: ['width', 'backgroundColor'],
                  transitionDuration: 300,
                }}
              />
            )}
          </View>
        )}
    </View>
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
        style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: soft, alignItems: 'center', justifyContent: 'center' }}
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
          backgroundColor: '#E9EDF3',
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
  const soft = past ? colors.textSecondary : over ? '#7A271A' : '#2E6B45';
  return (
    <View
      accessibilityRole="summary"
      style={{
        alignItems: 'center',
        gap: 2,
        padding: spacing.lg,
        borderRadius: radius.card,
        borderWidth: 1,
        borderColor: past ? colors.border : over ? 'rgba(180,35,24,0.25)' : 'rgba(19,128,63,0.25)',
        backgroundColor: past ? '#E9EDF3' : over ? colors.negativeSoft : '#E9F6EE',
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
