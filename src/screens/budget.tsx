import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { EmptyState } from '@/components/empty-state';
import { FloatingAction } from '@/components/floating-action';
import { HeroCard } from '@/components/hero-card';
import { ICON_INSET, Row, RowIcon, Section } from '@/components/list';
import { Money } from '@/components/money';
import { MonthSwitcher } from '@/components/month-switcher';
import { ProgressBar } from '@/components/progress-bar';
import { Screen } from '@/components/screen';
import { SwipeRow } from '@/components/swipe-row';
import { Text } from '@/components/text';
import { useToast } from '@/components/toast';
import { today } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import { assignDateFor, formatMonth, monthEnd, targetGaps, type EnvelopeMonth, type MonthKey } from '@/domain/months';
import type { Envelope } from '@/domain/types';
import { currentMonth, useBudgetMonth } from '@/hooks/use-budget-month';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useLedger } from '@/hooks/use-ledger';
import { DEBT_GROUP, useStore } from '@/store';
import { groupHue, spacing, useColors } from '@/theme';
import { envelopeIcon } from '@/utils/envelope-icon';
import { envelopeStatus, groupSummary } from '@/utils/envelope-status';

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

export function Budget() {
  const colors = useColors();
  const scheme = useColorScheme();
  const thisMonth = currentMonth();
  const [month, setMonth] = useState<MonthKey>(thisMonth);
  const budget = useBudgetMonth(month);
  const ledger = useLedger();
  const envelopes = useStore((s) => s.envelopes);
  const accounts = useStore((s) => s.accounts);
  const addEnvelope = useStore((s) => s.addEnvelope);
  const assignMany = useStore((s) => s.assignMany);
  const removeAllocations = useStore((s) => s.removeAllocations);
  const showToast = useToast((s) => s.show);

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
  const date = assignDateFor(month, today());
  const gaps = targetGaps(envelopes, budget);
  const existing = new Set(envelopes.map((e) => e.name.toLowerCase()));
  const spendable = envelopes.filter((e) => !e.debtAccountId);
  const empty: EnvelopeMonth = { assigned: 0, activity: 0, spent: 0, carriedIn: 0, available: 0 };

  function fill(entries: { envelopeId: string; amount: number }[], message: string) {
    let left = rta;
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
    showToast({ message, actionLabel: 'Undo', onAction: () => removeAllocations(ids) });
  }

  function debtFor(e: Envelope) {
    if (!e.debtAccountId) return undefined;
    const a = accounts.find((x) => x.id === e.debtAccountId);
    return { owed: -(ledger.balance.get(e.debtAccountId) ?? 0), minPayment: a?.minPayment };
  }

  // A fragment, not a wrapping View: the scroll view has to be the screen's first child
  // for the large title to collapse on iPhone.
  return (
    <>
      <Screen>
        <Stack.Screen
          options={{ headerRight: () => <MonthSwitcher month={month} current={thisMonth} onChange={setMonth} /> }}
        />

        <HeroCard compact>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
            <View style={{ flex: 1, gap: 1 }}>
              <Text variant="footnote" weight="500" tone="textSecondary">
                Ready to assign{month !== thisMonth ? ` in ${formatMonth(month)}` : ''}
              </Text>
              <Money cents={rta} variant="title" weight="700" tone={rta < 0 ? 'negative' : 'text'} style={{ fontSize: 24, lineHeight: 29 }} />
            </View>
            {rta > 0 && gaps.length > 0 && (
              <Button
                title="Fill targets"
                size="sm"
                onPress={() =>
                  fill(
                    gaps.map((g) => ({ envelopeId: g.envelopeId, amount: g.need })),
                    `Filled ${gaps.length} ${gaps.length === 1 ? 'envelope' : 'envelopes'}`,
                  )
                }
              />
            )}
          </View>
          {rta < 0 && (
            <Text variant="footnote" tone="negative">
              More is assigned than you have. Take some back from an envelope.
            </Text>
          )}
        </HeroCard>

        {month < thisMonth && (
          <Text variant="footnote" tone="textSecondary" style={{ marginTop: -spacing.sm }}>
            Looking back at {formatMonth(month)}. Anything you assign here is dated {monthEnd(month).slice(5).replace('-', '/')}.
          </Text>
        )}

        {spendable.length === 0 && (
          <EmptyState
            title="Make your envelopes"
            body="Bills and Everyday are money you spend each month. Savings is money you add each month and leave alone. Tap the ones you need."
            action={
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2 }}>
                {STARTERS.filter((s) => !existing.has(s.name.toLowerCase())).map((s) => (
                  <Chip key={s.name} label={s.name} onPress={() => addEnvelope(s)} />
                ))}
              </View>
            }
          />
        )}

        {groups.map((g) => {
          const total = g.items.reduce((a, e) => a + (budget.envelopes.get(e.id)?.available ?? 0), 0);
          const hue = groupHue(g.name, scheme);
          return (
            <Section key={g.name} title={g.name} detail={groupSummary(g.name, total)} inset={ICON_INSET}>
              {g.items.map((e) => {
                const row = budget.envelopes.get(e.id) ?? empty;
                const status = envelopeStatus(e, row, debtFor(e));
                const icon = envelopeIcon(e.name, !!e.debtAccountId);
                const canFill = status.need > 0 && rta > 0;
                return (
                  <SwipeRow
                    key={e.id}
                    left={
                      canFill
                        ? {
                            label: `${status.fillLabel} ${formatMoney(Math.min(status.need, rta), { whole: true })}`,
                            sf: 'plus',
                            md: 'add',
                            color: colors.positive,
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
                      color: colors.blue,
                      onTrigger: () => router.push(`/envelope/${e.id}`),
                    }}
                  >
                    <Row
                      onPress={() => router.push({ pathname: '/budget/[id]', params: { id: e.id, month } })}
                      leading={<RowIcon sf={icon.sf} md={icon.md} fg={hue.fg} bg={hue.soft} />}
                      title={e.name}
                      titleTone={status.overspent ? 'negative' : 'text'}
                      subtitle={status.subtitle}
                      subtitleTone={status.tone}
                      trailing={
                        <Money
                          cents={row.available}
                          weight="600"
                          tone={row.available < 0 ? 'negative' : row.available === 0 ? 'textTertiary' : 'text'}
                        />
                      }
                      below={
                        <View style={{ marginLeft: 34 + spacing.md }}>
                          <ProgressBar value={status.progress} color={status.overspent ? colors.negative : hue.fg} />
                        </View>
                      }
                    />
                  </SwipeRow>
                );
              })}
            </Section>
          );
        })}

        {spendable.length > 0 && (
          <Text variant="footnote" tone="textTertiary" align="center">
            Swipe right on an envelope to fill it, left to edit it.
          </Text>
        )}
      </Screen>
      <FloatingAction label="New envelope" onPress={() => router.push('/new-envelope')} />
    </>
  );
}
