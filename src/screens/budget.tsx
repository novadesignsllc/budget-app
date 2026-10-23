import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AnimatedNumber } from '@/components/animated-number';
import { Card, CardHeader } from '@/components/card';
import { Dropdown } from '@/components/dropdown';
import { Icon } from '@/components/icon';
import { InlineAmount } from '@/components/inline-amount';
import { ProgressRing } from '@/components/progress-ring';
import { Screen } from '@/components/screen';
import { ActionButton, ScreenActions } from '@/components/screen-actions';
import { ScreenTitle } from '@/components/screen-title';
import { SortList, type SortGroup } from '@/components/sort-list';
import { SwipeRow, useSwipeGuard } from '@/components/swipe-row';
import { Text } from '@/components/text';
import { useToast } from '@/components/toast';
import { today } from '@/domain/dates';
import { floorDollars, formatDollars } from '@/domain/money';
import { assignDateFor, formatMonth, monthEnd, targetGaps, type EnvelopeMonth, type MonthKey } from '@/domain/months';
import type { Envelope } from '@/domain/types';
import { currentMonth, useBudgetMonth } from '@/hooks/use-budget-month';
import { useKeyboardReveal } from '@/hooks/use-keyboard-reveal';
import { useLedger } from '@/hooks/use-ledger';
import { DEBT_GROUP, useStore } from '@/store';
import { groupColor, radius, spacing, useColors } from '@/theme';
import { envelopeStatus, groupSummary } from '@/utils/envelope-status';
import { orderGroups } from '@/utils/group-order';
import { haptic } from '@/utils/haptics';
import { useMonthOptions } from '@/utils/month-options';

const STARTERS: { name: string; group: string }[] = [
  { name: 'Rent', group: 'Bills' },
  { name: 'Utilities', group: 'Bills' },
  { name: 'Phone', group: 'Bills' },
  { name: 'Insurance', group: 'Bills' },
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
  const [editing, setEditing] = useState<{ id: string; draft: number } | null>(null);
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
  const gaps = targetGaps(envelopes, budget);
  const existing = new Set(envelopes.map((e) => e.name.toLowerCase()));
  const spendable = envelopes.filter((e) => !e.debtAccountId);

  // The ring: how much of this month's spending money (Bills and Daily) is gone.
  let spent = 0;
  let spendingTotal = 0;
  for (const e of envelopes) {
    if (e.hidden || e.debtAccountId || e.group === 'Savings') continue;
    const row = budget.envelopes.get(e.id) ?? EMPTY;
    spent += row.spent;
    spendingTotal += Math.max(0, row.spent + row.available);
  }
  const ringValue = spendingTotal > 0 ? spent / spendingTotal : 0;

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
    return {
      owed: -(ledger.balance.get(e.debtAccountId) ?? 0),
      minPayment: a?.minPayment,
    };
  }

  // Targets in the order the envelopes are listed, so the top of the list fills first.
  const listed = groups.flatMap((g) => g.items.map((e) => e.id));
  const orderedGaps = [...gaps].sort((a, b) => listed.indexOf(a.envelopeId) - listed.indexOf(b.envelopeId));
  const fillTargets = () =>
    fill(
      orderedGaps.map((g) => ({ envelopeId: g.envelopeId, amount: g.need })),
      `Filled ${gaps.length} ${gaps.length === 1 ? 'envelope' : 'envelopes'}`,
    );

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
        locked: g.name === DEBT_GROUP,
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
          <ScreenTitle title="Budget" context="Sorting envelopes" />
          <Text variant="footnote" tone="textSecondary" align="center">
            Press and hold to pick something up. Drag a group to move it with its envelopes, or drop an envelope into
            any group.
          </Text>
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
        <ScreenTitle
          title="Budget"
          context={past ? `${monthYear.format(asDate(month))} · past month` : monthYear.format(asDate(month))}
        />

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
            <View style={{ flex: 1, gap: 1 }}>
              <Text variant="body" weight="600" tone="onInk">
                Past month: {monthOnly.format(asDate(month))}
              </Text>
              <Text variant="footnote" color="rgba(255,255,255,0.8)">
                Anything you assign here is dated {monthEnd(month).slice(5).replace('-', '/')}.
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

        <Card padded>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View style={{ flex: 1, gap: 1 }}>
              <AnimatedNumber
                variant="number"
                tone={rta < 0 && !past ? 'negative' : past ? 'textSecondary' : 'text'}
                value={rta}
                format={formatDollars}
              />
              <Text variant="footnote" tone="textSecondary">
                to assign
              </Text>
            </View>
            <ProgressRing
              value={ringValue}
              color={hueFor('Daily')}
              accessibilityLabel={`${Math.round(ringValue * 100)} percent of ${formatMonth(month)}'s spending money spent`}
            />
            <View style={{ flex: 1, gap: 1, alignItems: 'flex-end' }}>
              <AnimatedNumber
                variant="number"
                tone={past ? 'textSecondary' : 'text'}
                value={spent}
                format={(v) => formatDollars(v, 'up')}
              />
              <Text variant="footnote" tone="textSecondary">
                spent of {formatDollars(spendingTotal)}
              </Text>
            </View>
          </View>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: spacing.sm,
              borderTopWidth: 1,
              borderTopColor: colors.separator,
              paddingTop: spacing.md - 2,
            }}
          >
            <Text variant="footnote" tone={rta < 0 && !past ? 'negative' : 'textSecondary'} style={{ flex: 1 }}>
              {rta < 0
                ? 'More is assigned than you have. Take some back.'
                : gaps.length > 0
                  ? `${gaps.length} ${gaps.length === 1 ? 'envelope still needs' : 'envelopes still need'} money`
                  : spendable.length > 0
                    ? 'Every target is funded'
                    : 'No envelopes yet'}
            </Text>
            {rta >= 100 && gaps.length > 0 && !past && (
              <Pressable accessibilityRole="button" hitSlop={8} onPress={fillTargets}>
                <Text variant="footnote" weight="600" tone="accent">
                  Fill targets ›
                </Text>
              </Pressable>
            )}
          </View>
        </Card>

        {spendable.length === 0 && (
          <Card>
            <CardHeader title="Make your envelopes" detail="Tap to add" />
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
              {STARTERS.filter((s) => !existing.has(s.name.toLowerCase())).map((s, i, list) => (
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
          const total = g.items.reduce((a, e) => a + (budget.envelopes.get(e.id)?.available ?? 0), 0);
          const hue = hueFor(g.name);
          return (
            <Card key={g.name}>
              <CardHeader title={g.name} dot={hue} detail={groupSummary(g.name, total)} />
              {g.items.map((e, i) => {
                const row = budget.envelopes.get(e.id) ?? EMPTY;
                const status = envelopeStatus(e, row, month, debtFor(e));
                const canFill = status.need > 0 && rta >= 100;
                const change = editing?.id === e.id ? editing.draft - row.assigned : 0;
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
                    right={{
                      label: 'Edit',
                      sf: 'slider.horizontal.3',
                      md: 'tune',
                      color: past ? colors.textTertiary : colors.accent,
                      onTrigger: () =>
                        router.push({
                          pathname: '/envelope/[id]',
                          params: { id: e.id, month },
                        }),
                    }}
                  >
                    <EnvelopeRow
                      envelope={e}
                      row={row}
                      color={hue}
                      progress={status.progress}
                      overspent={status.overspent}
                      last={i === g.items.length - 1}
                      past={past}
                      status={`Ready to assign ${formatDollars(rta - change)}`}
                      onDraft={(draft) => setEditing({ id: e.id, draft })}
                      onEditingChange={(on, view) => {
                        setEditing(on ? { id: e.id, draft: row.assigned } : null);
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
              detail={
                gaps.length === 0
                  ? 'Every target is already funded'
                  : rta < 100
                    ? 'Nothing left to assign'
                    : 'Fill every target, top to bottom, with what’s left to assign'
              }
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
              detail="Drag groups and envelopes into a new order"
              onPress={startSorting}
            />
            <ControlRow
              icon={{ sf: 'arrow.uturn.backward', md: 'undo' }}
              tint={colors.negative}
              soft={colors.negativeSoft}
              title={confirmUnassign ? `Tap again to unassign ${formatDollars(assignedTotal)}` : 'Unassign all'}
              detail={`Send all of ${formatMonth(month)}’s assigned money back to Ready to assign`}
              danger
              disabled={assignedTotal === 0}
              last
              onPress={unassignAll}
            />
          </Card>
        )}

        {spendable.length > 0 && (
          <Text variant="footnote" tone="textTertiary" align="center">
            Tap an amount to change it. Swipe right to fill, left to edit.
          </Text>
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
 * One envelope: name, then Assigned (tap to edit), Spent and Left in equal columns, and
 * a 3px bar in the group color (red and full when overspent). Greys only in a past month.
 */
function EnvelopeRow({
  envelope,
  row,
  color,
  progress,
  overspent,
  last,
  past,
  status,
  onDraft,
  onEditingChange,
  onAssign,
  onPress,
}: {
  envelope: Envelope;
  row: EnvelopeMonth;
  color: string;
  progress: number;
  overspent: boolean;
  last: boolean;
  past: boolean;
  status: string;
  onDraft: (cents: number) => void;
  onEditingChange: (editing: boolean, view: React.ComponentRef<typeof View> | null) => void;
  onAssign: (cents: number) => void;
  onPress: () => void;
}) {
  const colors = useColors();
  const swiping = useSwipeGuard();
  const savings = envelope.group === 'Savings' && !envelope.debtAccountId;
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
              opacity: pressed ? 0.5 : 1,
            })}
          >
            <Text variant="body" weight="500" tone={red ? 'negative' : past ? 'textSecondary' : 'text'} numberOfLines={1}>
              {envelope.name}
            </Text>
          </Pressable>
          <InlineAmount
            cents={row.assigned}
            width={COL}
            accessibilityLabel={`Assigned to ${envelope.name}`}
            muted={past}
            status={status}
            onDraft={onDraft}
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
        {!savings && (
          <View
            style={{
              height: 3,
              borderRadius: 2,
              backgroundColor: overspent ? (past ? colors.textSecondary : colors.negativeStrong) : colors.fill,
            }}
          >
            {!overspent && progress > 0 && (
              <Animated.View
                style={{
                  width: `${Math.min(1, progress) * 100}%`,
                  height: 3,
                  borderRadius: 2,
                  backgroundColor: color,
                  transitionProperty: 'width',
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
  detail,
  danger,
  disabled,
  last,
  onPress,
}: {
  icon: { sf: Parameters<typeof Icon>[0]['sf']; md: Parameters<typeof Icon>[0]['md'] };
  tint: string;
  soft: string;
  title: string;
  detail: string;
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
        paddingVertical: 11,
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
      <View style={{ flex: 1, gap: 1 }}>
        <Text variant="body" weight="600" tone={danger ? 'negative' : 'text'}>
          {title}
        </Text>
        <Text variant="footnote" tone="textSecondary">
          {detail}
        </Text>
      </View>
    </Pressable>
  );
}
