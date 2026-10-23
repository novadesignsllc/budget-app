import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text as RNText, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Dropdown } from '@/components/dropdown';
import { Screen } from '@/components/screen';
import { ActionButton, ScreenActions } from '@/components/screen-actions';
import { ScreenTitle } from '@/components/screen-title';
import { Text } from '@/components/text';
import { useToast } from '@/components/toast';
import { daysBetween, formatShortDate, today } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import { isCashAccount, type Envelope, type Recurring as RecurringItem } from '@/domain/types';
import { useAccounts } from '@/hooks/use-ledger';
import { useStore } from '@/store';
import { softOf, spacing, useColors } from '@/theme';
import { envelopeEmoji } from '@/utils/envelope-emoji';
import { haptic } from '@/utils/haptics';

type Sort = 'date' | 'amount' | 'bill' | 'subscription';

const COLUMNS = 3;
const GAP = 8;

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
    <ActionButton
      variant="ink"
      icon={{ sf: 'plus', md: 'add' }}
      accessibilityLabel="Add a bill or subscription"
      onPress={() => router.push('/edit-recurring')}
    />
  );

  if (items.length === 0) {
    return (
      <>
        <Screen>
          <ScreenTitle title="Recurring" />
          <Card padded>
            <Text variant="section">Add your bills and subscriptions</Text>
            <Button
              title="Add one"
              onPress={() => router.push('/edit-recurring')}
              style={{ alignSelf: 'flex-start' }}
            />
          </Card>
        </Screen>
        <ScreenActions>{add}</ScreenActions>
      </>
    );
  }

  return (
    <>
      <Screen>
        <ScreenTitle title="Recurring" />

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
                  envelope={envelope}
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
      </Screen>
      <ScreenActions>
        <Dropdown
          variant="compact"
          value={view}
          onChange={setView}
          label="Show"
          options={[
            { value: 'date', label: 'By date' },
            { value: 'amount', label: 'By amount' },
            { value: 'bill', label: 'Bills' },
            { value: 'subscription', label: 'Subscriptions' },
          ]}
        />
        {add}
      </ScreenActions>
    </>
  );
}

/** One bill or subscription: its envelope's emoji, name, amount, and when it's due (or Approve). */
function Tile({
  item,
  width,
  day,
  onCard,
  envelope,
  onApprove,
}: {
  item: RecurringItem;
  width: number;
  day: string;
  onCard: boolean;
  envelope?: Envelope;
  onApprove: () => void;
}) {
  const colors = useColors();
  const due = item.active && item.nextDue <= day;
  const days = daysBetween(day, item.nextDue);
  const emoji = envelopeEmoji(envelope ?? { name: item.name });
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
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: onCard ? softOf(colors.negativeStrong, 0.14) : colors.control,
          }}
        >
          <RNText style={{ fontSize: 22, lineHeight: 28 }}>{emoji}</RNText>
        </View>
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
