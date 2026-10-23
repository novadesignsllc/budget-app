import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/button';
import { Card, IconTile } from '@/components/card';
import { FilterPills } from '@/components/filter-pills';
import { Screen } from '@/components/screen';
import { ActionButton, ScreenActions } from '@/components/screen-actions';
import { ScreenTitle } from '@/components/screen-title';
import { Text } from '@/components/text';
import { useToast } from '@/components/toast';
import { daysBetween, formatShortDate, today } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import { monthlyCost } from '@/domain/recurring';
import { isCashAccount, type Recurring as RecurringItem } from '@/domain/types';
import { useAccounts } from '@/hooks/use-ledger';
import { useStore } from '@/store';
import { groupColor, softOf, spacing, useColors } from '@/theme';
import { envelopeIcon } from '@/utils/envelope-icon';
import { haptic } from '@/utils/haptics';

type Sort = 'date' | 'amount' | 'bill' | 'subscription';

const COLUMNS = 3;
const GAP = 8;
const BILLS = groupColor('Bills');

export function Recurring() {
  const items = useStore((s) => s.recurring);
  const envelopes = useStore((s) => s.envelopes);
  const approve = useStore((s) => s.approveRecurring);
  const showToast = useToast((s) => s.show);
  const { all: accounts } = useAccounts();
  const [view, setView] = useState<Sort>('date');
  const [width, setWidth] = useState(0);

  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const envelopeById = new Map(envelopes.map((e) => [e.id, e]));
  const day = today();
  const active = items.filter((r) => r.active);
  const monthly = active.reduce((a, r) => a + monthlyCost(r), 0);
  const context = `${formatMoney(monthly, { whole: true })} a month · ${items.length} ${
    items.length === 1 ? 'bill or subscription' : 'bills and subscriptions'
  }`;

  const byDate = (a: RecurringItem, b: RecurringItem) =>
    Number(b.active) - Number(a.active) || a.nextDue.localeCompare(b.nextDue);
  const list = items
    .filter((r) => (view === 'bill' || view === 'subscription' ? r.kind === view : true))
    .sort(view === 'amount' ? (a, b) => b.amount - a.amount || byDate(a, b) : byDate);
  const tileWidth = width > 0 ? (width - GAP * (COLUMNS - 1)) / COLUMNS : 0;

  function approveItem(r: RecurringItem) {
    approve(r.id);
    haptic('success');
    showToast({ message: `Added ${r.name} · ${formatMoney(r.amount)}` });
  }

  const add = (
    <ScreenActions>
      <ActionButton
        variant="ink"
        icon={{ sf: 'plus', md: 'add' }}
        label="Add"
        accessibilityLabel="Add a bill or subscription"
        onPress={() => router.push('/edit-recurring')}
      />
    </ScreenActions>
  );

  if (items.length === 0) {
    return (
      <>
        <Screen>
          <ScreenTitle title="Recurring" context="Bills and subscriptions" />
          <Card padded>
            <Text variant="section">Add your bills and subscriptions</Text>
            <Text variant="callout" tone="textSecondary">
              Rent, utilities, Netflix. When one comes due it shows up on Home for a one-tap approve, so nothing comes
              out without you seeing it.
            </Text>
            <Button
              title="Add one"
              onPress={() => router.push('/edit-recurring')}
              style={{ alignSelf: 'flex-start' }}
            />
          </Card>
        </Screen>
        {add}
      </>
    );
  }

  return (
    <>
      <Screen>
        <ScreenTitle title="Recurring" context={context} />

        <FilterPills
          center
          value={view}
          onChange={setView}
          options={[
            { value: 'date', label: 'By date' },
            { value: 'amount', label: 'By amount' },
            { value: 'bill', label: 'Bills' },
            { value: 'subscription', label: 'Subscriptions' },
          ]}
        />

        <View
          onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}
        >
          {tileWidth > 0 &&
            list.map((r) => {
              const account = accountById.get(r.accountId);
              const envelope = r.envelopeId ? envelopeById.get(r.envelopeId) : undefined;
              return (
                <Tile
                  key={r.id}
                  item={r}
                  width={tileWidth}
                  day={day}
                  onCard={!!account && !isCashAccount(account)}
                  envelopeName={envelope?.name}
                  onApprove={() => approveItem(r)}
                />
              );
            })}
        </View>

        {list.length === 0 && (
          <Text variant="footnote" tone="textSecondary" align="center">
            Nothing here yet.
          </Text>
        )}
        {list.some((r) => r.kind === 'bill') && (
          <Text variant="footnote" tone="textSecondary" align="center">
            Bills marked ~ change each month. Tap the transaction after you approve to fix the amount.
          </Text>
        )}
      </Screen>
      {add}
    </>
  );
}

/** One bill or subscription: icon, name, amount, and when it's due (or Approve). */
function Tile({
  item,
  width,
  day,
  onCard,
  envelopeName,
  onApprove,
}: {
  item: RecurringItem;
  width: number;
  day: string;
  onCard: boolean;
  envelopeName?: string;
  onApprove: () => void;
}) {
  const colors = useColors();
  const due = item.active && item.nextDue <= day;
  const days = daysBetween(day, item.nextDue);
  const byName = envelopeIcon(item.name);
  const icon = onCard
    ? { sf: 'creditcard.fill' as const, md: 'credit_card' as const }
    : byName.md === 'inbox' && envelopeName
      ? envelopeIcon(envelopeName)
      : byName;
  const amount =
    item.kind === 'bill'
      ? `~${formatMoney(item.amount, { whole: item.amount % 100 === 0 })}`
      : formatMoney(item.amount);
  const when = !item.active
    ? 'Paused'
    : onCard
      ? 'Slip · on a card'
      : days === 1
        ? 'Tomorrow'
        : days <= 7
          ? `In ${days} days`
          : formatShortDate(item.nextDue);
  const ink = onCard ? 'negative' : 'text';

  return (
    <Card tone={due ? 'due' : onCard ? 'slip' : 'default'} style={{ width, opacity: item.active ? 1 : 0.6 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${amount}, ${due ? 'due' : when}`}
        onPress={() => router.push({ pathname: '/edit-recurring', params: { id: item.id } })}
        style={({ pressed }) => ({
          alignItems: 'center',
          gap: 4,
          paddingTop: spacing.md,
          paddingBottom: due ? 2 : spacing.md,
          paddingHorizontal: 6,
          backgroundColor: pressed ? colors.control : 'transparent',
        })}
      >
        <IconTile
          sf={icon.sf}
          md={icon.md}
          color={onCard ? colors.negativeStrong : BILLS}
          bg={onCard ? softOf(colors.negativeStrong, 0.14) : colors.blueSoft}
        />
        <Text variant="row" weight="600" tone={ink} numberOfLines={1} align="center">
          {item.name}
        </Text>
        <Text variant="row" tone={ink} style={{ fontVariant: ['tabular-nums'] }}>
          {amount}
        </Text>
        {!due && (
          <Text variant="caption" tone={onCard ? 'negative' : 'textSecondary'} numberOfLines={1}>
            {when}
          </Text>
        )}
      </Pressable>
      {due && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Approve ${item.name}`}
          hitSlop={4}
          onPress={onApprove}
          style={({ pressed }) => ({
            alignItems: 'center',
            paddingTop: 2,
            paddingBottom: spacing.md,
            backgroundColor: pressed ? colors.control : 'transparent',
          })}
        >
          <Text variant="caption" weight="600" tone="orange">
            Approve
          </Text>
        </Pressable>
      )}
    </Card>
  );
}
