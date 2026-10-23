import { router } from 'expo-router';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { FloatingAction } from '@/components/floating-action';
import { ICON_INSET, Row, RowIcon, Section } from '@/components/list';
import { Money } from '@/components/money';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { formatDay } from '@/domain/dates';
import { FREQUENCY_LABEL, monthlyCost } from '@/domain/recurring';
import { isCashAccount, type Recurring as RecurringItem, type RecurringKind } from '@/domain/types';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAccounts } from '@/hooks/use-ledger';
import { useStore } from '@/store';
import { groupHue, radius, spacing, useColors } from '@/theme';
import { envelopeIcon } from '@/utils/envelope-icon';

export function Recurring() {
  const colors = useColors();
  const scheme = useColorScheme();
  const items = useStore((s) => s.recurring);
  const envelopes = useStore((s) => s.envelopes);
  const { all: accounts } = useAccounts();
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const envelopeById = new Map(envelopes.map((e) => [e.id, e]));

  const byKind = (k: RecurringKind) => items.filter((r) => r.kind === k).sort((a, b) => a.nextDue.localeCompare(b.nextDue));
  const total = (list: RecurringItem[]) => list.filter((r) => r.active).reduce((a, r) => a + monthlyCost(r), 0);
  const bills = byKind('bill');
  const subs = byKind('subscription');
  const onCards = items.filter((r) => {
    const a = accountById.get(r.accountId);
    return a && !isCashAccount(a);
  });

  if (items.length === 0) {
    return (
      <>
        <Screen>
          <EmptyState
            title="Add your bills and subscriptions"
            body="Rent, utilities, Netflix. When one comes due it shows up on Home for a one-tap approve, so nothing comes out without you seeing it."
            action={<Button title="Add one" onPress={() => router.push('/edit-recurring')} />}
          />
        </Screen>
        <FloatingAction label="Add" onPress={() => router.push('/edit-recurring')} />
      </>
    );
  }

  function rows(list: RecurringItem[]) {
    return list.map((r) => {
      const account = accountById.get(r.accountId);
      const envelope = r.envelopeId ? envelopeById.get(r.envelopeId) : undefined;
      const onCard = !!account && !isCashAccount(account);
      const hue = envelope ? groupHue(envelope.group, scheme) : { fg: colors.textSecondary, soft: colors.fill };
      const icon = envelopeIcon(envelope?.name ?? r.name);
      return (
        <Row
          key={r.id}
          href={{ pathname: '/edit-recurring', params: { id: r.id } }}
          leading={
            <RowIcon
              sf={onCard ? 'creditcard.fill' : icon.sf}
              md={onCard ? 'credit_card' : icon.md}
              fg={onCard ? colors.negative : hue.fg}
              bg={onCard ? colors.negativeSoft : hue.soft}
            />
          }
          title={r.name}
          titleTone={onCard ? 'negative' : 'text'}
          subtitle={[r.active ? formatDay(r.nextDue) : 'Paused', FREQUENCY_LABEL[r.frequency], account?.name]
            .filter(Boolean)
            .join(' · ')}
          subtitleTone={onCard ? 'negative' : 'textSecondary'}
          trailing={<Money cents={r.amount} weight="600" tone={onCard ? 'negative' : r.active ? 'text' : 'textTertiary'} />}
        />
      );
    });
  }

  const tile = (label: string, value: number, fg: string, bg: string) => (
    <View style={{ flex: 1, backgroundColor: bg, borderRadius: radius.lg, borderCurve: 'continuous', padding: spacing.lg - 2, gap: 2 }}>
      <Text variant="footnote" weight="500" color={fg}>
        {label}
      </Text>
      <Money cents={value} variant="title" weight="700" />
    </View>
  );

  return (
    <>
      <Screen>
        <View style={{ flexDirection: 'row', gap: spacing.sm + 2 }}>
          {tile('Bills a month', total(bills), colors.blue, colors.blueSoft)}
          {tile('Subscriptions a month', total(subs), colors.accent, colors.accentSoft)}
        </View>

        {onCards.length > 0 && (
          <View style={{ backgroundColor: colors.negativeSoft, borderRadius: radius.lg, padding: spacing.lg - 2, gap: 2 }}>
            <Text variant="headline" tone="negative">
              {onCards.length === 1 ? `${onCards[0].name} is on a card` : `${onCards.length} of these are on cards`}
            </Text>
            <Text variant="callout" tone="negative">
              Each charge is a slip. Move it to a bank account when you can.
            </Text>
          </View>
        )}

        {bills.length > 0 && (
          <Section
            title="Bills"
            footer="Bill amounts can change. You confirm the real amount each time."
            inset={ICON_INSET}
          >
            {rows(bills)}
          </Section>
        )}
        {subs.length > 0 && (
          <Section title="Subscriptions" inset={ICON_INSET}>
            {rows(subs)}
          </Section>
        )}
      </Screen>
      <FloatingAction label="Add" onPress={() => router.push('/edit-recurring')} />
    </>
  );
}
