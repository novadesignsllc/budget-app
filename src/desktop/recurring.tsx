import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Dropdown } from '@/components/dropdown';
import { Text } from '@/components/text';
import { useToast } from '@/components/toast';
import { daysBetween, formatDay, today } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import { monthlyCost } from '@/domain/recurring';
import { isCashAccount, type Frequency, type Recurring } from '@/domain/types';
import { useAccounts } from '@/hooks/use-ledger';
import { useStore } from '@/store';
import { spacing, useColors } from '@/theme';
import { envelopeEmoji } from '@/utils/envelope-emoji';

import { shortDate } from './budget';
import { Label, Pill } from './register';
import { DButton, DCard, DPage, PageTitle, Spacer } from './ui';

type Show = 'all' | 'bill' | 'subscription' | 'paused';
type Sort = 'date' | 'amount' | 'name';

const HOW_OFTEN: Record<Frequency, string> = {
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  monthly: 'Monthly',
  quarterly: 'Every 3 months',
  yearly: 'Yearly',
};
const COL = { due: 120, envelope: 160, account: 150, often: 120, amount: 100, action: 96 } as const;

/** Bills and subscriptions on a computer: what they cost a month, then one table of all of them. */
export function DesktopRecurring() {
  const colors = useColors();
  const items = useStore((s) => s.recurring);
  const envelopes = useStore((s) => s.envelopes);
  const approve = useStore((s) => s.approveRecurring);
  const showToast = useToast((s) => s.show);
  const { all: accounts } = useAccounts();
  const [show, setShow] = useState<Show>('all');
  const [sort, setSort] = useState<Sort>('date');

  const day = today();
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const envelopeById = new Map(envelopes.map((e) => [e.id, e]));
  const active = items.filter((r) => r.active);
  const total = (kind?: Recurring['kind']) =>
    active.filter((r) => !kind || r.kind === kind).reduce((a, r) => a + monthlyCost(r), 0);
  const dueNow = active.filter((r) => r.nextDue <= day);
  const thisWeek = active.filter((r) => r.nextDue > day && daysBetween(day, r.nextDue) <= 7);

  const byDate = (a: Recurring, b: Recurring) => Number(b.active) - Number(a.active) || a.nextDue.localeCompare(b.nextDue);
  const list = items
    .filter((r) => (show === 'paused' ? !r.active : show === 'all' ? true : r.kind === show))
    .sort(sort === 'amount' ? (a, b) => b.amount - a.amount || byDate(a, b) : sort === 'name' ? (a, b) => a.name.localeCompare(b.name) : byDate);

  function approveItem(r: Recurring) {
    approve(r.id);
    showToast({ message: `Added ${r.name} · ${formatMoney(r.amount)}` });
  }

  const add = () => router.push('/edit-recurring');

  return (
    <DPage
      title="Recurring"
      header={
        <>
          <PageTitle>Recurring</PageTitle>
          <Spacer />
          <Dropdown
            variant="compact"
            value={sort}
            onChange={setSort}
            label="Sort"
            options={[
              { value: 'date', label: 'By next due' },
              { value: 'amount', label: 'By amount' },
              { value: 'name', label: 'By name' },
            ]}
          />
          <DButton label="Bill or subscription" icon={{ sf: 'plus', md: 'add' }} onPress={add} />
        </>
      }
    >
      {items.length === 0 ? (
        <DCard padded style={{ maxWidth: 560 }}>
          <Text variant="section">Add your bills and subscriptions</Text>
          <Text variant="callout" tone="textSecondary">
            Rent, utilities, phone, streaming. Each one gets an envelope, and you approve it when it comes due.
          </Text>
          <DButton label="Add one" variant="accent" onPress={add} style={{ alignSelf: 'flex-start' }} />
        </DCard>
      ) : (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg }}>
            <Summary label="Bills a month" value={formatMoney(total('bill'), { whole: true })} />
            <Summary label="Subscriptions a month" value={formatMoney(total('subscription'), { whole: true })} />
            <Summary label="All together" value={formatMoney(total(), { whole: true })} />
            <Summary
              label="Coming up"
              value={dueNow.length ? `${dueNow.length} to approve` : `${thisWeek.length} this week`}
              tone={dueNow.length ? 'orange' : 'text'}
            />
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <Pill label="All" on={show === 'all'} onPress={() => setShow('all')} />
            <Pill label="Bills" on={show === 'bill'} onPress={() => setShow('bill')} />
            <Pill label="Subscriptions" on={show === 'subscription'} onPress={() => setShow('subscription')} />
            <Pill label="Paused" on={show === 'paused'} onPress={() => setShow('paused')} />
          </View>

          <DCard style={{ minWidth: 820 }}>
            <View
              style={{
                flexDirection: 'row',
                gap: 12,
                paddingHorizontal: 16,
                paddingVertical: 10,
                backgroundColor: colors.tableHeader,
                borderBottomWidth: 1,
                borderBottomColor: colors.separator,
              }}
            >
              <Label width={COL.due}>Next due</Label>
              <Label flex={1}>Name</Label>
              <Label width={COL.envelope}>Envelope</Label>
              <Label width={COL.account}>Account</Label>
              <Label width={COL.often}>How often</Label>
              <Label width={COL.amount} right>
                Amount
              </Label>
              <View style={{ width: COL.action }} />
            </View>
            {list.length === 0 ? (
              <Text variant="callout" tone="textSecondary" style={{ padding: 16 }}>
                Nothing here.
              </Text>
            ) : (
              list.map((r, i) => {
                const account = accountById.get(r.accountId);
                const envelope = r.envelopeId ? envelopeById.get(r.envelopeId) : undefined;
                const onCard = !!account && !isCashAccount(account);
                const due = r.active && r.nextDue <= day;
                const days = daysBetween(day, r.nextDue);
                const when = !r.active
                  ? 'Paused'
                  : days < 0
                    ? `Due ${formatDay(r.nextDue, day).toLowerCase()}`
                    : days === 0
                      ? 'Due today'
                      : days === 1
                        ? 'Tomorrow'
                        : days <= 7
                          ? `In ${days} days`
                          : shortDate(r.nextDue);
                return (
                  <View
                    key={r.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      minHeight: 48,
                      paddingHorizontal: 16,
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderTopColor: colors.hairline,
                      backgroundColor: onCard ? colors.negativeTint : 'transparent',
                      opacity: r.active ? 1 : 0.6,
                    }}
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${r.name}, ${formatMoney(r.amount)}, ${when}. Edit`}
                      onPress={() => router.push({ pathname: '/edit-recurring', params: { id: r.id } })}
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'stretch' }}
                    >
                      <Text variant="callout" weight={due ? '600' : '400'} tone={due ? 'orange' : 'textSecondary'} style={{ width: COL.due }}>
                        {when}
                      </Text>
                      <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                        <Text style={{ fontSize: 16, lineHeight: 20 }}>{envelopeEmoji(envelope ?? { name: r.name })}</Text>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text variant="body" weight="600" tone={onCard ? 'negative' : 'text'} numberOfLines={1}>
                            {r.name}
                          </Text>
                          <Text variant="footnote" tone={onCard ? 'negative' : 'textTertiary'} numberOfLines={1}>
                            {onCard ? 'Slip: this goes on a card' : r.kind === 'bill' ? 'Bill' : 'Subscription'}
                          </Text>
                        </View>
                      </View>
                      <Text variant="callout" tone="textSecondary" numberOfLines={1} style={{ width: COL.envelope }}>
                        {envelope?.name ?? '—'}
                      </Text>
                      <Text variant="callout" tone={onCard ? 'negative' : 'textSecondary'} numberOfLines={1} style={{ width: COL.account }}>
                        {account?.name ?? '—'}
                      </Text>
                      <Text variant="callout" tone="textSecondary" style={{ width: COL.often }}>
                        {HOW_OFTEN[r.frequency]}
                      </Text>
                      <Text variant="body" weight="600" tone={onCard ? 'negative' : 'text'} align="right" style={{ width: COL.amount, fontVariant: ['tabular-nums'] }}>
                        {formatMoney(r.amount)}
                      </Text>
                    </Pressable>
                    <View style={{ width: COL.action, alignItems: 'flex-end' }}>
                      {due && <DButton label="Approve" onPress={() => approveItem(r)} style={{ height: 30 }} />}
                    </View>
                  </View>
                );
              })
            )}
          </DCard>
        </>
      )}
    </DPage>
  );
}

function Summary({ label, value, tone = 'text' }: { label: string; value: string; tone?: 'text' | 'orange' }) {
  return (
    <DCard padded style={{ flexGrow: 1, flexShrink: 1, flexBasis: 200, gap: 2 }}>
      <Text variant="footnote" tone="textSecondary">
        {label}
      </Text>
      <Text style={{ fontSize: 22, lineHeight: 28, fontWeight: '700', fontVariant: ['tabular-nums'] }} tone={tone}>
        {value}
      </Text>
    </DCard>
  );
}
