import { router, Stack } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { Chip } from '@/components/chip';
import { EmptyState } from '@/components/empty-state';
import { HeaderButton } from '@/components/header-button';
import { HeroCard } from '@/components/hero-card';
import { Row, Section } from '@/components/list';
import { Money } from '@/components/money';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { formatMoney } from '@/domain/money';
import { spentInRange } from '@/domain/ledger';
import type { Envelope } from '@/domain/types';
import { useLedger } from '@/hooks/use-ledger';
import { DEBT_GROUP, useStore } from '@/store';
import { spacing } from '@/theme';

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

function monthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export function Budget() {
  const ledger = useLedger();
  const envelopes = useStore((s) => s.envelopes);
  const transactions = useStore((s) => s.transactions);
  const accounts = useStore((s) => s.accounts);
  const addEnvelope = useStore((s) => s.addEnvelope);

  const groups = useMemo(() => {
    const visible = envelopes.filter((e) => !e.hidden);
    const names = [...new Set(visible.map((e) => e.group))].sort((a, b) =>
      a === DEBT_GROUP ? 1 : b === DEBT_GROUP ? -1 : 0,
    );
    return names.map((name) => ({
      name,
      items: visible.filter((e) => e.group === name).sort((a, b) => a.order - b.order),
    }));
  }, [envelopes]);

  const from = monthStart();
  const to = '9999-12-31';
  const rta = ledger.readyToAssign;
  const spendable = envelopes.filter((e) => !e.debtAccountId);
  const existing = new Set(envelopes.map((e) => e.name.toLowerCase()));

  function subtitle(e: Envelope): string {
    if (e.debtAccountId) {
      const owed = -(ledger.balance.get(e.debtAccountId) ?? 0);
      const min = accounts.find((a) => a.id === e.debtAccountId)?.minPayment;
      return [`Owe ${formatMoney(owed, { whole: true })}`, min ? `min ${formatMoney(min, { whole: true })}` : null]
        .filter(Boolean)
        .join(' · ');
    }
    const spent = spentInRange(e.id, transactions, from, to);
    if (e.monthlyTarget) {
      const available = ledger.available.get(e.id) ?? 0;
      const funded = available + spent;
      const left = e.monthlyTarget - funded;
      return left > 0
        ? `${formatMoney(left)} to reach ${formatMoney(e.monthlyTarget, { whole: true })} this month`
        : `Funded · ${formatMoney(spent)} spent this month`;
    }
    return spent ? `${formatMoney(spent)} spent this month` : 'Nothing spent this month';
  }

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerRight: () => (
            <HeaderButton sf="plus" md="add" label="New envelope" onPress={() => router.push('/new-envelope')} />
          ),
        }}
      />

      <HeroCard>
        <Text variant="callout" weight="500" tone="textSecondary">
          Ready to assign
        </Text>
        <Money cents={rta} variant="display" tone={rta < 0 ? 'negative' : 'text'} />
        <Text variant="callout" tone={rta < 0 ? 'negative' : 'textSecondary'}>
          {rta > 0
            ? 'Tap an envelope to give it money.'
            : rta === 0
              ? 'Every dollar has a job.'
              : 'More is assigned than you have. Take some back from an envelope.'}
        </Text>
      </HeroCard>

      {spendable.length === 0 && (
        <EmptyState
          title="Make your envelopes"
          body="Each envelope is a job for your money. Tap the ones you need. You can rename them or add your own later."
          action={
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {STARTERS.filter((s) => !existing.has(s.name.toLowerCase())).map((s) => (
                <Chip key={s.name} label={s.name} onPress={() => addEnvelope(s)} />
              ))}
              <Chip label="Something else" tone="muted" onPress={() => router.push('/new-envelope')} />
            </View>
          }
        />
      )}

      {groups.map((g) => (
        <Section
          key={g.name}
          title={g.name}
          footer={g.name === DEBT_GROUP ? 'Card slips land here automatically, so the cash is ready to pay the card.' : undefined}
        >
          {g.items.map((e) => {
            const available = ledger.available.get(e.id) ?? 0;
            return (
              <Row
                key={e.id}
                href={`/envelope/${e.id}`}
                title={e.name}
                titleTone={available < 0 ? 'negative' : 'text'}
                subtitle={subtitle(e)}
                trailing={
                  <Money
                    cents={available}
                    weight="600"
                    tone={available < 0 ? 'negative' : available === 0 ? 'textTertiary' : 'text'}
                  />
                }
              />
            );
          })}
        </Section>
      ))}
    </Screen>
  );
}
