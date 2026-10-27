import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Dropdown } from '@/components/dropdown';
import { InlineAmount } from '@/components/inline-amount';
import { Text } from '@/components/text';
import { useToast } from '@/components/toast';
import { today } from '@/domain/dates';
import { debtTarget } from '@/domain/debt';
import { ceilDollars, floorDollars, formatDollars, formatMoney } from '@/domain/money';
import { assignDateFor, formatMonth, monthOf, type MonthKey } from '@/domain/months';
import type { Transaction } from '@/domain/types';
import { currentMonth, useBudgetMonth } from '@/hooks/use-budget-month';
import { useLedger } from '@/hooks/use-ledger';
import { LeftMath } from '@/screens/budget';
import { newestFirst } from '@/screens/transactions';
import { useStore } from '@/store';
import { groupColor, spacing } from '@/theme';
import { envelopeStatus } from '@/utils/envelope-status';
import { envelopeEmoji } from '@/utils/envelope-emoji';

import { MonthDivider, RegisterHeader, RegisterRow } from './register';
import { DButton, DCard, DPage, PageTitle, Spacer } from './ui';

const EMPTY = { assigned: 0, activity: 0, spent: 0, carriedIn: 0, available: 0 };

/**
 * One envelope on a computer: every transaction it has paid for, by month, on the left;
 * the month's numbers on the right, with a way to cover overspending from another envelope.
 */
export function DesktopEnvelope({ id, month: monthParam }: { id: string; month?: MonthKey }) {
  const month = monthParam ?? currentMonth();
  const budget = useBudgetMonth(month);
  const ledger = useLedger();
  const envelope = useStore((s) => s.envelopes.find((e) => e.id === id));
  const envelopes = useStore((s) => s.envelopes);
  const accounts = useStore((s) => s.accounts);
  const transactions = useStore((s) => s.transactions);
  const assign = useStore((s) => s.assign);
  const moveMoney = useStore((s) => s.moveMoney);
  const showToast = useToast((s) => s.show);
  const [donorId, setDonorId] = useState<string>();

  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const mine = useMemo(() => transactions.filter((t) => t.envelopeId === id).sort(newestFirst), [transactions, id]);

  if (!envelope) {
    return (
      <DPage title="Envelope" back="Budget" header={<PageTitle>Envelope</PageTitle>}>
        <DCard padded>
          <Text variant="callout" tone="textSecondary">
            This envelope is gone.
          </Text>
        </DCard>
      </DPage>
    );
  }

  const row = budget.envelopes.get(id) ?? EMPTY;
  const debtAccount = accounts.find((a) => a.id === envelope.debtAccountId);
  const owed = debtAccount ? -(ledger.balance.get(debtAccount.id) ?? 0) : 0;
  const debt = debtAccount ? { owed, target: debtTarget(debtAccount, owed) } : undefined;
  const status = envelopeStatus(envelope, row, month, debt);
  const past = month < currentMonth();
  const date = assignDateFor(month, today());

  const donors = envelopes
    .filter((e) => e.id !== id && !e.hidden && floorDollars(budget.envelopes.get(e.id)?.available ?? 0) >= 100)
    .sort((a, b) => (budget.envelopes.get(b.id)?.available ?? 0) - (budget.envelopes.get(a.id)?.available ?? 0));
  const donor = donors.find((d) => d.id === donorId) ?? donors[0];
  const take = donor ? Math.min(floorDollars(budget.envelopes.get(donor.id)?.available ?? 0), ceilDollars(-row.available)) : 0;

  const items: ({ kind: 'month'; key: string; out: number } | { kind: 'row'; t: Transaction })[] = [];
  let last = '';
  for (const t of mine) {
    const m = monthOf(t.date);
    if (m !== last) {
      const out = mine.filter((x) => monthOf(x.date) === m).reduce((a, x) => a + (x.amount < 0 ? -x.amount : 0), 0);
      items.push({ kind: 'month', key: m, out });
      last = m;
    }
    items.push({ kind: 'row', t });
  }

  return (
    <DPage
      title={envelope.name}
      back="Budget"
      header={
        <>
          <PageTitle>
            {envelopeEmoji(envelope)} {envelope.name}
          </PageTitle>
          <Text variant="body" tone="textSecondary">
            {envelope.group} · {formatMonth(month)}
          </Text>
          <Spacer />
          {envelope.debtAccountId ? (
            <DButton label="Open debt" onPress={() => router.navigate(`/debt/${envelope.debtAccountId}`)} />
          ) : (
            <DButton
              label="Edit envelope"
              icon={{ sf: 'slider.horizontal.3', md: 'tune' }}
              onPress={() => router.push({ pathname: '/envelope/[id]', params: { id, month } })}
            />
          )}
        </>
      }
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 20 }}>
        <View style={{ flexGrow: 999, flexShrink: 1, flexBasis: 640, minWidth: 0 }}>
          <DCard style={{ minWidth: 640 }}>
            <RegisterHeader columns={{ envelope: false }} />
            {items.length === 0 ? (
              <Text variant="callout" tone="textSecondary" style={{ padding: 16 }}>
                No transactions in this envelope yet.
              </Text>
            ) : (
              items.map((item) =>
                item.kind === 'month' ? (
                  <MonthDivider key={item.key} label={formatMonth(item.key)} detail={`${formatDollars(item.out, 'up')} spent`} />
                ) : (
                  <RegisterRow
                    key={item.t.id}
                    t={item.t}
                    columns={{ envelope: false }}
                    account={accountById.get(item.t.accountId)}
                    envelope={envelope}
                  />
                ),
              )
            )}
          </DCard>
        </View>

        <View style={{ flexGrow: 1, flexShrink: 0, flexBasis: 300, maxWidth: 380, gap: 14 }}>
          <DCard padded>
            <Text variant="footnote" tone="textSecondary">
              {row.available < 0 ? 'Overspent' : 'Available'}
            </Text>
            <Text
              style={{ fontSize: 30, lineHeight: 36, fontWeight: '700', letterSpacing: -0.5, fontVariant: ['tabular-nums'] }}
              tone={row.available < 0 ? 'negative' : 'text'}
            >
              {formatMoney(row.available)}
            </Text>
            <Text variant="callout" tone={status.tone}>
              {status.subtitle}
            </Text>
            <View style={{ marginHorizontal: -9 }}>
              <LeftMath row={row} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text variant="callout" weight="600" tone={past ? 'textSecondary' : 'accent'}>
                Assigned in {formatMonth(month)}
              </Text>
              <InlineAmount
                exact
                cents={row.assigned}
                width={96}
                muted={past}
                accessibilityLabel={`Assigned to ${envelope.name} in ${formatMonth(month)}`}
                onCommit={(cents) => assign(id, cents - row.assigned, date)}
              />
            </View>
          </DCard>

          {row.available < 0 && donor && (
            <DCard padded>
              <Text variant="callout" weight="700">
                Cover the overspending
              </Text>
              <Dropdown
                label="Take it from"
                value={donor.id}
                onChange={setDonorId}
                searchable={donors.length > 8}
                options={donors.map((d) => ({
                  value: d.id,
                  label: d.name,
                  dot: groupColor(d.group),
                  section: d.group,
                  detail: formatDollars(budget.envelopes.get(d.id)?.available ?? 0),
                }))}
              />
              <DButton
                label={`Move ${formatDollars(take)}`}
                variant="accent"
                disabled={take < 100}
                onPress={() => {
                  moveMoney(donor.id, id, take, date);
                  showToast({ message: `Moved ${formatDollars(take)} from ${donor.name}` });
                }}
              />
            </DCard>
          )}

          {!envelope.debtAccountId && (
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push({ pathname: '/envelope/[id]', params: { id, month } })}
              style={{ paddingHorizontal: 4, flexDirection: 'row', gap: spacing.xs }}
            >
              <Text variant="callout" weight="600" tone="accent">
                Change the target, name or group ›
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </DPage>
  );
}
