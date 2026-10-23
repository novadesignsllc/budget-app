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
import { useMonthOptions } from '@/utils/month-options';

const STARTERS: { name: string; group: string }[] = [
  { name: 'Rent', group: 'Bills' },
  { name: 'Utilities', group: 'Bills' },
  { name: 'Phone', group: 'Bills' },
  { name: 'Insurance', group: 'Bills' },
  { name: 'Groceries', group: 'Everyday' },
  { name: 'Eating Out', group: 'Everyday' },
  { name: 'Gas', group: 'Everyday' },
  { name: 'Fun Money', group: 'Everyday' },
  { name: 'Emergency Fund', group: 'Savings' },
  { name: 'Car Repairs', group: 'Savings' },
  { name: 'Gifts', group: 'Savings' },
];

const GROUP_ORDER = ['Bills', 'Everyday', 'Savings'];
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
  const accounts = useStore((s) => s.accounts);
  const addEnvelope = useStore((s) => s.addEnvelope);
  const assign = useStore((s) => s.assign);
  const assignMany = useStore((s) => s.assignMany);
  const removeAllocations = useStore((s) => s.removeAllocations);
  const showToast = useToast((s) => s.show);
  const { scrollRef, onScroll, watch: revealAboveKeyboard } = useKeyboardReveal();
  // The row being edited and the amount typed so far, for the live "to assign" preview.
  const [editing, setEditing] = useState<{ id: string; draft: number } | null>(null);
  // Years are section labels in the menu, so each option only needs the month name.
  const monthOptions = useMonthOptions().map((o) => ({
    ...o,
    label: monthOnly.format(asDate(o.value)),
  }));

  const groups = useMemo(() => {
    const visible = envelopes.filter((e) => !e.hidden);
    const names = [...new Set(visible.map((e) => e.group))].sort((a, b) => {
      const rank = (g: string) => (g === DEBT_GROUP ? 99 : GROUP_ORDER.includes(g) ? GROUP_ORDER.indexOf(g) : 50);
      return rank(a) - rank(b) || a.localeCompare(b);
    });
    return names.map((name) => ({
      name,
      items: visible.filter((e) => e.group === name).sort((a, b) => a.order - b.order),
    }));
  }, [envelopes]);

  const rta = budget.readyToAssign;
  // A past month is drawn in greys so it never passes for this month.
  const past = month < thisMonth;
  const hueFor = (group: string) => (past ? colors.textTertiary : groupColor(group));
  const date = assignDateFor(month, today());
  const gaps = targetGaps(envelopes, budget);
  const existing = new Set(envelopes.map((e) => e.name.toLowerCase()));
  const spendable = envelopes.filter((e) => !e.debtAccountId);

  // The ring: how much of this month's spending money (Bills and Everyday) is gone.
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

  const fillTargets = () =>
    fill(
      gaps.map((g) => ({ envelopeId: g.envelopeId, amount: g.need })),
      `Filled ${gaps.length} ${gaps.length === 1 ? 'envelope' : 'envelopes'}`,
    );

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
              color={hueFor('Everyday')}
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
              Bills and Everyday are money you spend each month. Savings is money you add each month and leave alone.
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
