import { useMemo, useState } from 'react';
import { FlatList, TextInput, View, useWindowDimensions } from 'react-native';

import { Chip } from '@/components/chip';
import { EmptyState } from '@/components/empty-state';
import { Section } from '@/components/list';
import { Text } from '@/components/text';
import { TransactionRow } from '@/components/transaction-row';
import { formatDay } from '@/domain/dates';
import type { Transaction } from '@/domain/types';
import { useAccounts } from '@/hooks/use-ledger';
import { useStore } from '@/store';
import { gutter, maxContentWidth, radius, spacing, type as typeScale, useColors } from '@/theme';

type Filter = 'all' | 'uncleared' | 'slips';

/** Transfers are stored as two rows; lists show only the side money left from. */
export function isListed(t: Transaction): boolean {
  return !(t.kind === 'transfer' && t.amount > 0);
}

export function TransactionList({ accountId, header }: { accountId?: string; header?: React.ReactNode }) {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const transactions = useStore((s) => s.transactions);
  const envelopes = useStore((s) => s.envelopes);
  const { all: accounts } = useAccounts();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const envelopeById = useMemo(() => new Map(envelopes.map((e) => [e.id, e])), [envelopes]);

  const days = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = transactions
      .filter((t) => (accountId ? t.accountId === accountId : isListed(t)))
      .filter((t) => (filter === 'uncleared' ? !t.cleared : filter === 'slips' ? t.kind === 'slip' : true))
      .filter((t) => {
        if (!q) return true;
        const env = t.envelopeId ? envelopeById.get(t.envelopeId)?.name : '';
        return `${t.payee} ${env} ${t.memo ?? ''}`.toLowerCase().includes(q);
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
    const grouped: { date: string; items: Transaction[] }[] = [];
    for (const t of rows) {
      const last = grouped[grouped.length - 1];
      if (last?.date === t.date) last.items.push(t);
      else grouped.push({ date: t.date, items: [t] });
    }
    return grouped;
  }, [transactions, accountId, filter, query, envelopeById]);

  const webRoom = process.env.EXPO_OS === 'web' && width < 900 ? 96 : 0;

  return (
    <FlatList
      data={days}
      keyExtractor={(d) => d.date}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={{
        padding: gutter,
        paddingBottom: spacing.xxxl + webRoom,
        gap: spacing.xl,
        width: '100%',
        maxWidth: maxContentWidth,
        alignSelf: 'center',
      }}
      ListHeaderComponent={
        <View style={{ gap: spacing.md }}>
          {header}
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search payees, envelopes, notes"
            placeholderTextColor={colors.textTertiary}
            accessibilityLabel="Search transactions"
            clearButtonMode="while-editing"
            style={[
              typeScale.body,
              {
                color: colors.text,
                backgroundColor: colors.fill,
                borderRadius: radius.md,
                borderCurve: 'continuous',
                paddingHorizontal: spacing.lg,
                height: 44,
              },
            ]}
          />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Chip label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
            <Chip label="Not cleared" selected={filter === 'uncleared'} onPress={() => setFilter('uncleared')} />
            <Chip label="Card slips" selected={filter === 'slips'} onPress={() => setFilter('slips')} />
          </View>
        </View>
      }
      ListEmptyComponent={
        query || filter !== 'all' ? (
          <Text variant="callout" tone="textSecondary">
            Nothing matches.
          </Text>
        ) : (
          <EmptyState
            title="No transactions yet"
            body="Tap the bar at the bottom and type something like “Kroger 54.20”."
          />
        )
      }
      renderItem={({ item }) => (
        <Section title={formatDay(item.date)}>
          {item.items.map((t) => (
            <TransactionRow
              key={t.id}
              t={t}
              account={accountById.get(t.accountId)}
              envelope={t.envelopeId ? envelopeById.get(t.envelopeId) : undefined}
              showAccount={!accountId}
            />
          ))}
        </Section>
      )}
    />
  );
}
