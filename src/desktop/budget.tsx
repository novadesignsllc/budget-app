import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { ActionMenu } from '@/components/action-menu';
import { Icon } from '@/components/icon';
import { InlineAmount } from '@/components/inline-amount';
import { closeKeypad, keypadIsOpen } from '@/components/keypad';
import { desktopSheetOpen } from '@/components/screen';
import { SortList, type SortGroup } from '@/components/sort-list';
import { useAssignedAhead } from '@/components/home-cards';
import { SnoozeRow } from '@/components/snooze-row';
import { Text } from '@/components/text';
import { TypedAmount } from '@/components/typed-amount';
import { useToast } from '@/components/toast';
import { today } from '@/domain/dates';
import { textCents } from '@/domain/keypad';
import { debtTarget } from '@/domain/debt';
import { ceilDollars, floorDollars, formatDollars, formatMoney } from '@/domain/money';
import {
  addMonthKey,
  assignDateFor,
  MONTHS_AHEAD,
  monthOf,
  targetGaps,
  type EnvelopeMonth,
  type MonthKey,
} from '@/domain/months';
import { builderEnded, isSnoozed, nextDue, targetFor, targetKindName, targetKindOf, targetSetFor } from '@/domain/targets';
import { envelopePool } from '@/domain/pools';
import type { Envelope } from '@/domain/types';
import { currentMonth, useBudgetMonth } from '@/hooks/use-budget-month';
import { useKeyboardReveal } from '@/hooks/use-keyboard-reveal';
import { useLedger } from '@/hooks/use-ledger';
import { LeftCell, LeftMath, STARTERS } from '@/screens/budget';
import { newestFirst } from '@/screens/transactions';
import { coverShortfall, moveToCover, POOL_NAME, POOL_SOURCE, usePools } from '@/hooks/use-pools';
import { isManagedGroup, useStore } from '@/store';
import { groupColor, radius, spacing, useColors } from '@/theme';
import { envelopeStatus, groupSummary, monthName, targetBar, type TargetBar } from '@/utils/envelope-status';
import { envelopeEmoji } from '@/utils/envelope-emoji';
import { orderGroups } from '@/utils/group-order';
import { haptic } from '@/utils/haptics';

import { DButton, DCard, DPage, PageTitle, SearchField, Spacer, usePageKeys } from './ui';

/** Assigned, Spent and Left: one width for all three, roomy enough for $12,345. */
const COL = 84;
const GAP = 12;
const EMPTY: EnvelopeMonth = { assigned: 0, activity: 0, spent: 0, carriedIn: 0, available: 0 };

const monthYear = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
const monthOnly = new Intl.DateTimeFormat('en-US', { month: 'long' });
const asDate = (m: MonthKey) => {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1);
};

type Row = { envelope: Envelope; row: EnvelopeMonth };

/**
 * The budget on a computer: every envelope in one table with its target, and the
 * selected envelope's details on the right (how Left adds up, its target, this month's
 * spending). Arrow keys move the selection.
 */
export function DesktopBudget() {
  const colors = useColors();
  const thisMonth = currentMonth();
  const [month, setMonth] = useState<MonthKey>(thisMonth);
  const budget = useBudgetMonth(month);
  const ledger = useLedger();
  const envelopes = useStore((s) => s.envelopes);
  const accounts = useStore((s) => s.accounts);
  const groupOrder = useStore((s) => s.settings.groupOrder);
  const startersDone = useStore((s) => !!s.settings.startersDone);
  const updateSettings = useStore((s) => s.updateSettings);
  const addEnvelope = useStore((s) => s.addEnvelope);
  const reorderEnvelopes = useStore((s) => s.reorderEnvelopes);
  const assign = useStore((s) => s.assign);
  const assignMany = useStore((s) => s.assignMany);
  const removeAllocations = useStore((s) => s.removeAllocations);
  const showToast = useToast((s) => s.show);
  const { scrollRef, onScroll, offset, scrollBy } = useKeyboardReveal();
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortGroup[] | null>(null);
  const [dragging, setDragging] = useState(false);
  const [confirmUnassign, setConfirmUnassign] = useState(false);
  // The envelope whose "Move a custom amount" field is open in the details panel.
  const [movingId, setMovingId] = useState<string | null>(null);

  const past = month < thisMonth;
  // Budgeting ahead: up to MONTHS_AHEAD months after this one.
  const ahead = month > thisMonth;
  const aheadMoney = useAssignedAhead();
  const lastMonth = addMonthKey(thisMonth, MONTHS_AHEAD);
  const rta = budget.readyToAssign;
  // Spending and savings, once there's a savings account; null means one pool.
  const { pools, readyFor } = usePools(budget);
  const envelopeById = new Map(envelopes.map((e) => [e.id, e] as const));
  const date = assignDateFor(month, today());

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

  const q = query.trim().toLowerCase();
  const shown = groups
    .map((g) => ({ ...g, items: q ? g.items.filter((e) => e.name.toLowerCase().includes(q)) : g.items }))
    .filter((g) => g.items.length);
  const flat: Row[] = shown.flatMap((g) =>
    g.items.map((e) => ({ envelope: e, row: budget.envelopes.get(e.id) ?? EMPTY })),
  );
  const selected = flat.find((r) => r.envelope.id === selectedId) ?? flat[0];

  function debtFor(e: Envelope) {
    if (!e.debtAccountId) return undefined;
    const a = accounts.find((x) => x.id === e.debtAccountId);
    const owed = -(ledger.balance.get(e.debtAccountId) ?? 0);
    return { owed, target: a ? debtTarget(a, owed) : 0 };
  }

  const debtTargets = new Map(
    envelopes.filter((e) => e.debtAccountId).map((e) => [e.id, ceilDollars(debtFor(e)?.target ?? 0)] as const),
  );
  const gaps = targetGaps(envelopes, budget, debtTargets);
  const listed = groups.flatMap((g) => g.items.map((e) => e.id));
  const orderedGaps = [...gaps].sort((a, b) => listed.indexOf(a.envelopeId) - listed.indexOf(b.envelopeId));
  const assignedTotal = listed.reduce((sum, id) => sum + (budget.envelopes.get(id)?.assigned ?? 0), 0);
  const existing = new Set(envelopes.filter((e) => !e.hidden).map((e) => e.name.toLowerCase()));
  const starters = startersDone || past ? [] : STARTERS.filter((s) => !existing.has(s.name.toLowerCase()));

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
    showToast({ message, actionLabel: 'Undo', onAction: () => removeAllocations(ids) });
  }

  function moveBack(e: Envelope, cents: number) {
    const ids = assignMany([{ envelopeId: e.id, amount: -cents, date }]);
    showToast({
      message: `Moved ${formatDollars(cents)} back to Ready to assign`,
      actionLabel: 'Undo',
      onAction: () => removeAllocations(ids),
    });
  }

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
    showToast({
      message: `Sent ${formatDollars(assignedTotal)} back to Ready to assign`,
      actionLabel: 'Undo',
      onAction: () => removeAllocations(ids),
    });
  }

  // Up and down pick the envelope; left and right change the month.
  usePageKeys((e) => {
    if (keypadIsOpen() || desktopSheetOpen() || sorting || !flat.length) return;
    const i = Math.max(
      0,
      flat.findIndex((r) => r.envelope.id === selected?.envelope.id),
    );
    if (e.key === 'ArrowDown') setSelectedId(flat[Math.min(flat.length - 1, i + 1)].envelope.id);
    else if (e.key === 'ArrowUp') setSelectedId(flat[Math.max(0, i - 1)].envelope.id);
    else if (e.key === 'ArrowLeft') setMonth((m) => addMonthKey(m, -1));
    else if (e.key === 'ArrowRight') setMonth((m) => (m < lastMonth ? addMonthKey(m, 1) : m));
    else return;
    e.preventDefault();
  });

  if (sorting) {
    return (
      <DPage
        title="Sort envelopes"
        scrollRef={scrollRef}
        onScroll={onScroll}
        scrollEnabled={!dragging}
        contentStyle={{ maxWidth: 760 }}
        header={
          <>
            <PageTitle>Sort envelopes</PageTitle>
            <Spacer />
            <DButton label="Cancel" onPress={() => setSorting(null)} />
            <DButton
              label="Save order"
              variant="accent"
              onPress={() => {
                reorderEnvelopes(
                  sorting.filter((g) => g.items.length).map((g) => ({ name: g.name, ids: g.items.map((i) => i.id) })),
                );
                setSorting(null);
                showToast({ message: 'Order saved' });
              }}
            />
          </>
        }
      >
        <SortList groups={sorting} onChange={setSorting} scroller={{ offset, scrollBy }} onDragChange={setDragging} />
      </DPage>
    );
  }

  return (
    <DPage
      title={`Budget · ${monthYear.format(asDate(month))}`}
      scrollRef={scrollRef}
      onScroll={onScroll}
      header={
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <MonthStep
              label="Previous month"
              glyph="chevron_left"
              sf="chevron.left"
              onPress={() => setMonth(addMonthKey(month, -1))}
            />
            <View style={{ minWidth: 176, alignItems: 'center' }}>
              <PageTitle>{monthYear.format(asDate(month))}</PageTitle>
            </View>
            <MonthStep
              label="Next month"
              glyph="chevron_right"
              sf="chevron.right"
              disabled={month >= lastMonth}
              onPress={() => setMonth(addMonthKey(month, 1))}
            />
          </View>
          {pools ? (
            <>
              <ReadyPill cents={pools.spending.readyToAssign} past={past} what="spending" />
              <ReadyPill cents={pools.savings.readyToAssign} past={past} what="savings" />
              {!past &&
                (['spending', 'savings'] as const)
                  .filter((p) => floorDollars(pools[p].readyToAssign) < 0)
                  .slice(0, 1)
                  .map((p) => (
                    <View key={p} style={{ flexDirection: 'row', gap: spacing.sm }}>
                      {floorDollars(pools[p === 'savings' ? 'spending' : 'savings'].readyToAssign) >= 0 && (
                        <DButton
                          label={`Move ${formatDollars(moveToCover(pools[p]))} from ${p === 'savings' ? 'checking' : 'savings'}`}
                          variant="accent"
                          onPress={() => coverShortfall(pools, p)}
                        />
                      )}
                      <DButton
                        label="Fix in envelopes"
                        onPress={() => {
                          // Open "move money back" on the fullest envelope in that pool.
                          const fullest = flat
                            .filter((r) => envelopePool(r.envelope) === p && r.row.available >= 100)
                            .sort((a, b) => b.row.available - a.row.available)[0];
                          if (!fullest) return;
                          setSelectedId(fullest.envelope.id);
                          setMovingId(fullest.envelope.id);
                        }}
                      />
                    </View>
                  ))}
            </>
          ) : (
            <ReadyPill cents={rta} past={past} />
          )}
          {month === thisMonth && aheadMoney && (
            <View style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.control }}>
              <Text variant="callout" weight="600" tone="textSecondary">
                {formatDollars(aheadMoney.total)} assigned ahead
              </Text>
            </View>
          )}
          {ahead && (
            <View
              style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.accentSoft }}
            >
              <Text variant="callout" weight="600" tone="accent">
                Planning ahead
              </Text>
            </View>
          )}
          {(past || ahead) && (
            <DButton label={`Back to ${monthOnly.format(asDate(thisMonth))}`} onPress={() => setMonth(thisMonth)} />
          )}
          <Spacer />
          <SearchField value={query} onChange={setQuery} placeholder="Find an envelope" width={210} />
          <DButton
            label="Auto-assign"
            icon={{ sf: 'bolt.fill', md: 'bolt' }}
            disabled={!gaps.some((g) => readyFor(envelopeById.get(g.envelopeId) ?? { group: '' }) >= 100)}
            onPress={() =>
              fill(
                orderedGaps.map((g) => ({ envelopeId: g.envelopeId, amount: g.need })),
                `Auto-assigned ${gaps.length} ${gaps.length === 1 ? 'envelope' : 'envelopes'}`,
              )
            }
          />
          <DButton
            label="Sort"
            icon={{ sf: 'arrow.up.arrow.down', md: 'swap_vert' }}
            onPress={() =>
              setSorting(
                groups.map((g) => ({
                  name: g.name,
                  color: groupColor(g.name),
                  locked: isManagedGroup(g.name),
                  items: g.items.map((e) => ({ id: e.id, name: e.name })),
                })),
              )
            }
          />
          <DButton
            label="Envelope"
            icon={{ sf: 'plus', md: 'add' }}
            accessibilityLabel="New envelope"
            onPress={() => router.push({ pathname: '/new-envelope', params: { month } })}
          />
        </>
      }
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 20 }}>
        <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 560, maxWidth: 680, minWidth: 0, gap: spacing.md }}>
          {starters.length > 0 && (
            <Starters
              starters={starters}
              onAdd={(s) => addEnvelope({ ...s, month })}
              onDone={() => updateSettings({ startersDone: true })}
            />
          )}

          {shown.length > 0 ? (
            <View style={{ gap: spacing.md }}>
              {/* Column labels over the cards, like the phone. */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: GAP, paddingHorizontal: 17, marginBottom: -4 }}>
                <ColumnLabel flex>Envelope</ColumnLabel>
                <ColumnLabel width={COL} right>
                  Assigned
                </ColumnLabel>
                <ColumnLabel width={COL} right>
                  Spent
                </ColumnLabel>
                <ColumnLabel width={COL + 6} right>
                  Left
                </ColumnLabel>
              </View>
              {shown.map((g) => {
                const rows = g.items.map((e) => budget.envelopes.get(e.id) ?? EMPTY);
                const sum = (k: 'assigned' | 'spent') => rows.reduce((a, r) => a + r[k], 0);
                const left = rows.reduce((a, r) => a + floorDollars(r.available), 0);
                return (
                  // Each group is its own card, so the whole budget reads at a glance.
                  <DCard key={g.name}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: GAP,
                        paddingHorizontal: 16,
                        paddingVertical: 11,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.separator,
                      }}
                    >
                      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                        <View
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: past ? colors.textTertiary : groupColor(g.name),
                          }}
                        />
                        <Text variant="section" style={{ fontSize: 15 }}>
                          {g.name}
                        </Text>
                        {pools && (
                          <Text variant="footnote" tone="textSecondary">
                            {POOL_SOURCE[envelopePool({ group: g.name })]}
                          </Text>
                        )}
                      </View>
                      <GroupSum>{formatDollars(sum('assigned'))}</GroupSum>
                      <GroupSum>{formatDollars(sum('spent'), 'up')}</GroupSum>
                      <View style={{ width: COL + 6, alignItems: 'flex-end', paddingRight: 6 }}>
                        <Text variant="footnote" weight="600" tone="textSecondary" numberOfLines={1}>
                          {groupSummary(g.name, left)}
                        </Text>
                      </View>
                    </View>
                    {g.items.map((e, i) => {
                      const row = budget.envelopes.get(e.id) ?? EMPTY;
                      const debt = debtFor(e);
                      const status = envelopeStatus(e, row, month, debt);
                      return (
                        <View key={e.id} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: colors.hairline }}>
                          <EnvelopeRow
                            envelope={e}
                            snoozed={!e.debtAccountId && isSnoozed(e, month) && !!targetSetFor(e, month)}
                            row={row}
                            past={past}
                            selected={selected?.envelope.id === e.id}
                            bar={targetBar(e, row, month, debt)}
                            need={past ? 0 : status.need}
                            onSelect={() => setSelectedId(e.id)}
                            onAssign={(cents) => assign(e.id, cents - row.assigned, date)}
                            onMoveBack={(cents) => moveBack(e, cents)}
                            onCustomAmount={() => {
                              setSelectedId(e.id);
                              setMovingId(e.id);
                            }}
                          />
                        </View>
                      );
                    })}
                  </DCard>
                );
              })}
            </View>
          ) : (
            <DCard padded>
              <Text variant="callout" tone="textSecondary">
                {q ? 'No envelope matches that.' : 'No envelopes yet. Add one with the Envelope button.'}
              </Text>
            </DCard>
          )}

          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 4 }}>
            {!past && assignedTotal !== 0 && (
              <Pressable accessibilityRole="button" onPress={unassignAll} hitSlop={6}>
                <Text variant="footnote" weight="600" tone="negative">
                  {confirmUnassign ? `Click again to unassign ${formatDollars(assignedTotal)}` : 'Unassign all'}
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        {selected && (
          <Inspector
            key={selected.envelope.id}
            envelope={selected.envelope}
            row={selected.row}
            month={month}
            past={past}
            rta={readyFor(selected.envelope)}
            source={
              pools
                ? `${POOL_NAME[envelopePool(selected.envelope)]} · ${pools[envelopePool(selected.envelope)].accountsLabel}`
                : undefined
            }
            debt={debtFor(selected.envelope)}
            onFill={(need) =>
              fill([{ envelopeId: selected.envelope.id, amount: need }], `Filled ${selected.envelope.name}`)
            }
            onMoveBack={(cents) => moveBack(selected.envelope, cents)}
            moving={movingId === selected.envelope.id}
            onMoving={(on) => setMovingId(on ? selected.envelope.id : null)}
          />
        )}
      </View>
    </DPage>
  );
}

/**
 * Ready to assign in the header: green with money waiting, red when more is assigned than
 * the account holds, grey when it's all assigned. `what` names the pool when there are two.
 */
function ReadyPill({ cents, past, what }: { cents: number; past: boolean; what?: 'spending' | 'savings' }) {
  const colors = useColors();
  const left = floorDollars(cents);
  const look =
    past || left === 0
      ? { bg: colors.control, fg: colors.textSecondary }
      : left < 0
        ? { bg: colors.negativeSoft, fg: colors.negative }
        : { bg: colors.positiveSoft, fg: colors.positive };
  const label =
    left === 0
      ? what
        ? `${what === 'spending' ? 'Spending' : 'Savings'} all assigned`
        : 'All money assigned'
      : left < 0
        ? what
          ? `${what} short`
          : 'assigned more than you have'
        : what
          ? `${what} to assign`
          : 'ready to assign';
  return (
    <View
      accessibilityRole="summary"
      style={{
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: spacing.sm,
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 10,
        borderCurve: 'continuous',
        backgroundColor: look.bg,
      }}
    >
      {left !== 0 && (
        <Text
          style={{ fontSize: 20, lineHeight: 24, fontWeight: '700', color: look.fg, fontVariant: ['tabular-nums'] }}
        >
          {left < 0 ? `−${formatDollars(-left)}` : formatDollars(left)}
        </Text>
      )}
      <Text variant={left === 0 ? 'body' : 'callout'} weight="600" color={look.fg}>
        {label}
      </Text>
    </View>
  );
}

/** "$600 a month · $40 short": the target and where this month stands against it. */
function targetLabel(
  e: Envelope,
  row: EnvelopeMonth,
  month: MonthKey,
  need: number,
  debt?: { owed: number; target: number },
): { text: string; tone: 'textSecondary' | 'textTertiary' | 'negative' | 'caution' } {
  if (row.available < 0) return { text: `Over by ${formatDollars(-row.available, 'up')}`, tone: 'negative' };
  const target = e.debtAccountId ? (debt?.target ?? 0) : (targetFor(e, month) ?? 0);
  if (target <= 0) {
    if (!e.debtAccountId && isSnoozed(e, month) && targetSetFor(e, month))
      return { text: 'Snoozed this month', tone: 'textSecondary' };
    return { text: 'No target', tone: 'textTertiary' };
  }
  const amount = formatDollars(ceilDollars(target));
  const kind = e.debtAccountId ? 'spending' : targetKindOf(e);
  if (kind === 'builder') {
    const by = e.targetDate ? ` by ${monthName(e.targetDate)}` : '';
    if (row.carriedIn + row.assigned >= target) return { text: `${amount}${by} · reached`, tone: 'textSecondary' };
    if (builderEnded(e, month)) return { text: `${amount} · ended ${monthName(e.targetDate!)}`, tone: 'textSecondary' };
    if (need >= 100) return { text: `${amount}${by} · ${formatDollars(need)} this month`, tone: 'caution' };
    return { text: `${amount}${by} · on track`, tone: 'textSecondary' };
  }
  if (kind === 'repeat') {
    const due = nextDue(e, month);
    const base = `${amount} due ${due ? monthName(due) : '—'}`;
    if (need >= 100) return { text: `${base} · ${formatDollars(need)} this month`, tone: 'caution' };
    if (row.carriedIn + row.assigned >= target) return { text: `${base} · ready`, tone: 'textSecondary' };
    return { text: `${base} · on track`, tone: 'textSecondary' };
  }
  if (kind === 'percent') {
    const base = `${target / 100}% of income`;
    if (need >= 100) return { text: `${base} · ${formatDollars(need)} short`, tone: 'caution' };
    if (!row.monthIncome) return { text: `${base} · no income yet`, tone: 'textSecondary' };
    return { text: `${base} · funded`, tone: 'textSecondary' };
  }
  if (kind === 'bank') {
    if (need >= 100) return { text: `Keep ${amount} · ${formatDollars(need)} to refill`, tone: 'caution' };
    return { text: `Keep ${amount} · full`, tone: 'textSecondary' };
  }
  const base = kind === 'goal' ? `Save ${amount} a month` : kind === 'weekly' ? `${amount} a week` : `${amount} a month`;
  if (e.debtAccountId && debt && debt.owed <= 0) return { text: 'Paid off', tone: 'textSecondary' };
  if (need >= 100) return { text: `${base} · ${formatDollars(need)} short`, tone: 'caution' };
  if (row.available < 100 && row.spent > 0) return { text: `${base} · paid`, tone: 'textSecondary' };
  return { text: `${base} · funded`, tone: 'textSecondary' };
}

function EnvelopeRow({
  envelope,
  snoozed,
  row,
  past,
  selected,
  bar,
  need,
  onSelect,
  onAssign,
  onMoveBack,
  onCustomAmount,
}: {
  envelope: Envelope;
  /** Its target is snoozed this month. */
  snoozed?: boolean;
  row: EnvelopeMonth;
  past: boolean;
  selected: boolean;
  bar: TargetBar | null;
  need: number;
  onSelect: () => void;
  onAssign: (cents: number) => void;
  onMoveBack: (cents: number) => void;
  onCustomAmount: () => void;
}) {
  const colors = useColors();
  const red = row.available < 0 && !past;
  // The name selects the row; Assigned and Left are their own buttons beside it.
  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: selected ? colors.accentFaint : 'transparent',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: GAP }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${envelope.name}, ${formatDollars(row.available)} left. Show details`}
          accessibilityState={{ selected }}
          onPress={onSelect}
          style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: GAP, alignSelf: 'stretch' }}
        >
          <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text style={{ width: 20, textAlign: 'center', fontSize: 15, lineHeight: 20, opacity: past ? 0.6 : 1 }}>
              {envelopeEmoji(envelope)}
            </Text>
            <Text
              variant="body"
              weight="500"
              tone={red ? 'negative' : past ? 'textSecondary' : 'text'}
              numberOfLines={1}
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
        <View>
          <InlineAmount
            exact
            cents={row.assigned}
            width={COL}
            accessibilityLabel={`Assigned to ${envelope.name}`}
            muted={past}
            onEditingChange={(on) => on && onSelect()}
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
            ]}
          />
        </View>
        <Text
          variant="body"
          tone="textSecondary"
          align="right"
          style={{ width: COL, paddingRight: 6, fontVariant: ['tabular-nums'] }}
        >
          {formatDollars(row.spent, 'up')}
        </Text>
        <LeftCell
          width={COL}
          row={row}
          bar={bar}
          past={past}
          tone={red ? 'negative' : row.available < 100 || past ? 'textTertiary' : 'text'}
          onEditingChange={(on) => on && onSelect()}
          onMoveBack={onMoveBack}
          onCustomAmount={onCustomAmount}
          align="right"
        />
      </View>
    </View>
  );
}

/** The right-hand panel for the selected envelope. */
function Inspector({
  envelope,
  row,
  month,
  past,
  rta,
  source,
  debt,
  onFill,
  onMoveBack,
  moving,
  onMoving,
}: {
  envelope: Envelope;
  row: EnvelopeMonth;
  month: MonthKey;
  past: boolean;
  rta: number;
  /** Which pool and account this envelope's money comes from, when there are two. */
  source?: string;
  debt?: { owed: number; target: number };
  onFill: (need: number) => void;
  onMoveBack: (cents: number) => void;
  /** The "Move a custom amount" field is open. */
  moving: boolean;
  onMoving: (on: boolean) => void;
}) {
  const colors = useColors();
  const transactions = useStore((s) => s.transactions);
  const status = envelopeStatus(envelope, row, month, debt);
  const bar = targetBar(envelope, row, month, debt);
  const label = targetLabel(envelope, row, month, status.need, debt);
  const snoozed = !envelope.debtAccountId && isSnoozed(envelope, month) && !!targetSetFor(envelope, month);
  const max = floorDollars(row.available);
  const movable = !past && max >= 100;
  const spending = useMemo(
    () => transactions.filter((t) => t.envelopeId === envelope.id && monthOf(t.date) === month).sort(newestFirst),
    [transactions, envelope.id, month],
  );
  const leftColor = row.available < 0 ? colors.negative : row.available < 100 ? colors.textSecondary : colors.positive;

  return (
    <View style={{ flexGrow: 1, flexShrink: 0, flexBasis: 360, maxWidth: 480, gap: 14 }}>
      <DCard padded>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="footnote" tone="textSecondary">
              {envelope.group}
            </Text>
            <Text
              accessibilityRole="header"
              style={{ fontSize: 20, lineHeight: 25, fontWeight: '700', letterSpacing: -0.3 }}
              numberOfLines={2}
            >
              {envelopeEmoji(envelope)} {envelope.name}
            </Text>
          </View>
          <Pressable
            accessibilityRole="link"
            onPress={() =>
              envelope.debtAccountId
                ? router.navigate(`/debt/${envelope.debtAccountId}`)
                : router.push({ pathname: '/envelope/[id]', params: { id: envelope.id, month } })
            }
            hitSlop={6}
          >
            <Text variant="callout" weight="600" tone="accent">
              {envelope.debtAccountId ? 'Open debt' : 'Edit'}
            </Text>
          </Pressable>
        </View>
        <View style={{ gap: 2 }}>
          <Text variant="footnote" tone="textSecondary">
            {row.available < 0 ? 'Overspent' : 'Left to spend'}
          </Text>
          <Text
            style={{
              fontSize: 30,
              lineHeight: 36,
              fontWeight: '700',
              letterSpacing: -0.5,
              color: leftColor,
              fontVariant: ['tabular-nums'],
            }}
          >
            {formatMoney(row.available)}
          </Text>
        </View>
        <View style={{ marginHorizontal: -9 }}>
          <LeftMath row={row} />
        </View>
        {source && (
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              gap: spacing.md,
              paddingHorizontal: 12,
              paddingVertical: 9,
              borderRadius: 10,
              borderCurve: 'continuous',
              backgroundColor: colors.background,
            }}
          >
            <Text variant="callout" tone="textSecondary">
              Comes from
            </Text>
            <Text variant="callout" weight="600" numberOfLines={1} style={{ flexShrink: 1 }}>
              {source}
            </Text>
          </View>
        )}
      </DCard>

      <DCard padded>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
          <Text variant="callout" weight="700">
            Target
          </Text>
          <Text variant="callout" tone="textSecondary" numberOfLines={1} style={{ flexShrink: 1 }}>
            {bar
              ? envelope.debtAccountId
                ? 'Payment'
                : targetKindName(targetKindOf(envelope))
              : snoozed
                ? 'Snoozed'
                : 'None set'}
          </Text>
        </View>
        <Text variant="callout" weight="600" color={colors[label.tone]}>
          {label.text}
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <DButton
            label={
              status.need > 0
                ? `${status.fillLabel} ${formatDollars(Math.min(status.need, Math.max(0, floorDollars(rta))))}`
                : snoozed
                  ? 'Snoozed'
                  : 'Target met'
            }
            variant="accent"
            disabled={past || status.need <= 0 || rta < 100}
            onPress={() => onFill(status.need)}
            style={{ flex: 1 }}
          />
          <ActionMenu
            accessibilityLabel="Move money back to Ready to assign"
            disabled={!movable}
            items={[
              {
                label: 'Move all back',
                detail: formatDollars(max),
                icon: { sf: 'arrow.uturn.backward', md: 'undo' },
                onPress: () => onMoveBack(max),
              },
              { label: 'Move a custom amount', icon: { sf: 'number', md: 'dialpad' }, onPress: () => onMoving(true) },
            ]}
            style={({ pressed, open }) => ({
              flex: 1,
              height: 34,
              paddingHorizontal: 12,
              borderRadius: radius.button,
              borderCurve: 'continuous',
              borderWidth: 1,
              borderColor: open ? colors.accent : colors.borderStrong,
              backgroundColor: pressed ? colors.control : colors.surface,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: movable ? 1 : 0.45,
            })}
          >
            <Text variant="body" weight="600" numberOfLines={1}>
              Move money back
            </Text>
          </ActionMenu>
        </View>
        {moving && movable && (
          <View style={{ gap: 6 }}>
            <Text variant="footnote" tone="textSecondary">
              Move back to Ready to assign, up to {formatDollars(max)}. Enter moves it.
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <TypedAmount
                value=""
                mode="whole"
                autoFocus
                placeholder="$0"
                accessibilityLabel={`Amount to move back, up to ${formatDollars(max)}`}
                onCommit={(text) => {
                  // Leaving the field empty keeps it open (the menu hands focus back as it closes).
                  const amount = Math.min(max, Math.max(0, textCents(text, 'whole') ?? 0));
                  if (!text) return;
                  onMoving(false);
                  if (amount > 0) onMoveBack(amount);
                }}
                onCancel={() => onMoving(false)}
                style={{
                  flex: 1,
                  height: 34,
                  paddingHorizontal: 10,
                  borderWidth: 1.5,
                  borderColor: colors.accent,
                  borderRadius: radius.button,
                  borderCurve: 'continuous',
                  backgroundColor: colors.surface,
                  fontSize: 15,
                  fontWeight: '600',
                }}
              />
              <Pressable accessibilityRole="button" onPress={() => onMoving(false)} hitSlop={6}>
                <Text variant="callout" weight="600" tone="accent">
                  Cancel
                </Text>
              </Pressable>
            </View>
          </View>
        )}
        {!bar && !snoozed && !envelope.debtAccountId && (
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push({ pathname: '/envelope/[id]', params: { id: envelope.id, month } })}
          >
            <Text variant="callout" weight="600" tone="accent">
              Set a target ›
            </Text>
          </Pressable>
        )}
        {!past && !envelope.debtAccountId && !!targetSetFor(envelope, month) && (
          <View style={{ paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.separator }}>
            <SnoozeRow envelope={envelope} month={month} flat />
          </View>
        )}
      </DCard>

      <DCard>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingHorizontal: 18,
            paddingTop: 14,
            paddingBottom: 10,
          }}
        >
          <Text variant="callout" weight="700">
            {month === currentMonth() ? 'This month' : monthOnly.format(asDate(month))}
          </Text>
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push({ pathname: '/budget/[id]', params: { id: envelope.id, month } })}
          >
            <Text variant="callout" weight="600" tone="accent">
              All ›
            </Text>
          </Pressable>
        </View>
        {spending.length === 0 ? (
          <Text variant="callout" tone="textSecondary" style={{ paddingHorizontal: 18, paddingBottom: 14 }}>
            Nothing spent yet.
          </Text>
        ) : (
          spending.slice(0, 8).map((t) => (
            <Pressable
              key={t.id}
              accessibilityRole="button"
              accessibilityLabel={`${t.payee}, ${formatMoney(t.amount)}. Edit`}
              onPress={() => router.push(`/transaction/${t.id}`)}
              style={({ hovered }: { hovered?: boolean }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                paddingHorizontal: 18,
                paddingVertical: 9,
                borderTopWidth: 1,
                borderTopColor: colors.hairline,
                backgroundColor: hovered ? colors.tableHeader : 'transparent',
              })}
            >
              <Text variant="footnote" tone="textSecondary" style={{ width: 48 }}>
                {shortDate(t.date)}
              </Text>
              <Text variant="callout" weight="500" numberOfLines={1} style={{ flex: 1 }}>
                {t.payee}
              </Text>
              <Text
                variant="callout"
                color={t.amount < 0 ? colors.negative : colors.positive}
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {formatMoney(t.amount)}
              </Text>
            </Pressable>
          ))
        )}
      </DCard>
    </View>
  );
}

const short = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
export function shortDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return short.format(new Date(y, m - 1, d));
}

function MonthStep({
  label,
  glyph,
  sf,
  disabled,
  onPress,
}: {
  label: string;
  glyph: 'chevron_left' | 'chevron_right';
  sf: 'chevron.left' | 'chevron.right';
  disabled?: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => {
        haptic('selection');
        onPress();
      }}
      style={({ hovered }: { hovered?: boolean }) => ({
        width: 32,
        height: 32,
        borderRadius: 8,
        borderCurve: 'continuous',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: hovered && !disabled ? colors.control : 'transparent',
        opacity: disabled ? 0.3 : 1,
      })}
    >
      <Icon sf={sf} md={glyph} size={16} color={colors.accent} weight="semibold" />
    </Pressable>
  );
}

function ColumnLabel({ children, width, right, flex }: { children: string; width?: number; right?: boolean; flex?: boolean }) {
  return (
    <Text
      variant="label"
      caps
      tone="textTertiary"
      align={right ? 'right' : 'left'}
      // Right-aligned labels end where the digits below them end.
      style={[flex ? { flex: 1 } : { width }, right && { paddingRight: 6 }]}
    >
      {children}
    </Text>
  );
}

function GroupSum({ children }: { children: string }) {
  return (
    <Text variant="footnote" tone="textSecondary" align="center" style={{ width: COL, fontVariant: ['tabular-nums'] }}>
      {children}
    </Text>
  );
}

function Starters({
  starters,
  onAdd,
  onDone,
}: {
  starters: typeof STARTERS;
  onAdd: (s: (typeof STARTERS)[number]) => void;
  onDone: () => void;
}) {
  const colors = useColors();
  return (
    <DCard>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 14 }}>
        <Text variant="section" style={{ flex: 1 }}>
          Make your envelopes
        </Text>
        <Pressable accessibilityRole="button" onPress={onDone} hitSlop={6}>
          <Text variant="callout" weight="600" tone="accent">
            Done
          </Text>
        </Pressable>
      </View>
      <View
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: 16, paddingBottom: 16 }}
      >
        {starters.map((s) => (
          <Pressable
            key={s.name}
            accessibilityRole="button"
            accessibilityLabel={`Add ${s.name} to ${s.group}`}
            onPress={() => onAdd(s)}
            style={({ hovered }: { hovered?: boolean }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              height: 32,
              paddingHorizontal: 12,
              borderRadius: 8,
              borderCurve: 'continuous',
              borderWidth: 1,
              borderColor: colors.borderStrong,
              backgroundColor: hovered ? colors.control : colors.surface,
            })}
          >
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: groupColor(s.group) }} />
            <Text variant="callout" weight="500">
              {s.name}
            </Text>
            <Text variant="callout" weight="600" tone="accent">
              + Add
            </Text>
          </Pressable>
        ))}
      </View>
    </DCard>
  );
}
