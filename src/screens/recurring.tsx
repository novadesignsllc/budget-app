import { router, Stack } from 'expo-router';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { HeaderButton } from '@/components/header-button';
import { Row, Section } from '@/components/list';
import { Money } from '@/components/money';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { formatDay } from '@/domain/dates';
import { FREQUENCY_LABEL, monthlyCost } from '@/domain/recurring';
import { isCashAccount, type Recurring as RecurringItem, type RecurringKind } from '@/domain/types';
import { useAccounts } from '@/hooks/use-ledger';
import { useStore } from '@/store';
import { radius, spacing, useColors } from '@/theme';

export function Recurring() {
  const colors = useColors();
  const items = useStore((s) => s.recurring);
  const { all: accounts } = useAccounts();
  const accountById = new Map(accounts.map((a) => [a.id, a]));

  const byKind = (k: RecurringKind) =>
    items.filter((r) => r.kind === k).sort((a, b) => a.nextDue.localeCompare(b.nextDue));
  const total = (list: RecurringItem[]) => list.filter((r) => r.active).reduce((a, r) => a + monthlyCost(r), 0);
  const bills = byKind('bill');
  const subs = byKind('subscription');
  const onCards = items.filter((r) => {
    const a = accountById.get(r.accountId);
    return a && !isCashAccount(a);
  });

  const header = (
    <Stack.Screen
      options={{
        headerRight: () => (
          <HeaderButton sf="plus" md="add" label="Add recurring" onPress={() => router.push('/edit-recurring')} />
        ),
      }}
    />
  );

  if (items.length === 0) {
    return (
      <Screen>
        {header}
        <EmptyState
          title="Add your bills and subscriptions"
          body="Rent, utilities, Netflix. When one comes due it shows up on Home for a one-tap approve, so nothing comes out without you seeing it."
          action={<Button title="Add one" onPress={() => router.push('/edit-recurring')} />}
        />
      </Screen>
    );
  }

  function rows(list: RecurringItem[]) {
    return list.map((r) => {
      const account = accountById.get(r.accountId);
      const onCard = account && !isCashAccount(account);
      return (
        <Row
          key={r.id}
          href={{ pathname: '/edit-recurring', params: { id: r.id } }}
          title={r.name}
          titleTone={onCard ? 'negative' : 'text'}
          subtitle={[
            r.active ? `Next: ${formatDay(r.nextDue)}` : 'Paused',
            FREQUENCY_LABEL[r.frequency],
            account?.name,
          ]
            .filter(Boolean)
            .join(' · ')}
          trailing={
            <Money
              cents={r.amount}
              weight="500"
              tone={onCard ? 'negative' : r.active ? 'text' : 'textTertiary'}
            />
          }
        />
      );
    });
  }

  return (
    <Screen>
      {header}
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        {[
          { label: 'Bills a month', value: total(bills) },
          { label: 'Subscriptions a month', value: total(subs) },
        ].map((s) => (
          <View
            key={s.label}
            style={{ flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, borderCurve: 'continuous', padding: spacing.lg, gap: spacing.xs }}
          >
            <Text variant="footnote" weight="500" tone="textSecondary">
              {s.label}
            </Text>
            <Money cents={s.value} variant="title" />
          </View>
        ))}
      </View>

      {onCards.length > 0 && (
        <View style={{ backgroundColor: colors.negativeSoft, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.xs }}>
          <Text variant="headline" tone="negative">
            {onCards.length === 1 ? `${onCards[0].name} is on a card` : `${onCards.length} of these are on cards`}
          </Text>
          <Text variant="callout" tone="negative">
            Each charge is a slip. Move it to a bank account when you can.
          </Text>
        </View>
      )}

      {bills.length > 0 && (
        <Section title="Bills" footer="Bill amounts can change. You confirm the real amount each time.">
          {rows(bills)}
        </Section>
      )}
      {subs.length > 0 && <Section title="Subscriptions">{rows(subs)}</Section>}
    </Screen>
  );
}
