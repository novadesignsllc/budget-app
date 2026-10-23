import { useMemo, useState } from 'react';
import { FlatList, TextInput, View } from 'react-native';

import { Card, TableHeader, type Column } from '@/components/card';
import { useDock } from '@/components/dock';
import { Dropdown } from '@/components/dropdown';
import { Icon } from '@/components/icon';
import { ActionButton, ScreenActions } from '@/components/screen-actions';
import { ScreenTitle } from '@/components/screen-title';
import { Text } from '@/components/text';
import { TransactionRow, TXN_COLUMNS } from '@/components/transaction-row';
import { today } from '@/domain/dates';
import { formatMonth, monthOf, type MonthKey } from '@/domain/months';
import type { Transaction } from '@/domain/types';
import { useAccounts } from '@/hooks/use-ledger';
import { useStore } from '@/store';
import { gutter, maxContentWidth, radius, spacing, type as typeScale, useColors } from '@/theme';
import { useMonthOptions } from '@/utils/month-options';

type Filter = 'all' | 'flagged' | 'open' | 'slips';

/** Transfers are stored as two rows; lists show only the side money left from. */
export function isListed(t: Transaction): boolean {
  return !(t.kind === 'transfer' && t.amount > 0);
}

export function newestFirst(a: Transaction, b: Transaction) {
  return b.date.localeCompare(a.date) || b.createdAt - a.createdAt;
}

/**
 * A table card that a FlatList can render row by row: the top edge carries the column
 * labels, each row draws the card's sides, and the last row closes the bottom.
 */
const monthFormat = new Intl.DateTimeFormat('en-US', { month: 'long' });
function longMonth(key: MonthKey) {
  const [y, m] = key.split('-').map(Number);
  return monthFormat.format(new Date(y, m - 1, 1));
}

export function TableCardTop({ columns, leading }: { columns: Column[]; leading?: number }) {
  const colors = useColors();
  return (
    <View
      style={{
        borderWidth: 1,
        borderBottomWidth: 0,
        borderColor: colors.border,
        borderTopLeftRadius: radius.card,
        borderTopRightRadius: radius.card,
        borderCurve: 'continuous',
        overflow: 'hidden',
        backgroundColor: colors.surface,
      }}
    >
      <TableHeader columns={columns} leading={leading} />
    </View>
  );
}

export function TableCardRow({ last, children }: { last: boolean; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View
      style={{
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderBottomWidth: last ? 1 : 0,
        borderColor: colors.border,
        borderBottomLeftRadius: last ? radius.card : 0,
        borderBottomRightRadius: last ? radius.card : 0,
        borderCurve: 'continuous',
        overflow: 'hidden',
        backgroundColor: colors.surface,
      }}
    >
      {children}
    </View>
  );
}

const SPLIT_COLUMNS: Column[] = [
  { label: 'Date', width: TXN_COLUMNS.date },
  { label: '', width: TXN_COLUMNS.emoji },
  { label: 'Payee' },
  { label: 'Outflow', width: TXN_COLUMNS.money, align: 'right' },
  { label: 'Inflow', width: TXN_COLUMNS.money, align: 'right' },
];

/** The Transactions tab: one month at a time in a dense table, or a search across every month. */
export function TransactionList() {
  const colors = useColors();
  const { contentBottom } = useDock();
  const transactions = useStore((s) => s.transactions);
  const envelopes = useStore((s) => s.envelopes);
  const { all: accounts } = useAccounts();
  // Full month names; years are the menu's sections.
  const monthOptions = useMonthOptions().map((o) => ({ ...o, label: longMonth(o.value) }));
  const [month, setMonth] = useState<MonthKey>(monthOf(today()));
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const envelopeById = useMemo(() => new Map(envelopes.map((e) => [e.id, e])), [envelopes]);

  // Everything in scope before the pill filter: the month, or every month while searching.
  const scoped = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions
      .filter(isListed)
      .filter((t) => {
        if (!searching) return monthOf(t.date) === month;
        if (!q) return true;
        const env = t.envelopeId ? envelopeById.get(t.envelopeId)?.name : '';
        return `${t.payee} ${env ?? ''} ${t.memo ?? ''}`.toLowerCase().includes(q);
      })
      .sort(newestFirst);
  }, [transactions, searching, query, month, envelopeById]);

  const rows = useMemo(
    () =>
      scoped.filter((t) =>
        filter === 'flagged'
          ? t.flagged
          : filter === 'open'
            ? !t.reconciled
            : filter === 'slips'
              ? t.kind === 'slip'
              : true,
      ),
    [scoped, filter],
  );

  const flaggedCount = scoped.filter((t) => t.flagged).length;

  const emptyText =
    transactions.length === 0
      ? 'No transactions yet.'
      : searching
        ? 'Nothing matches that search.'
        : filter !== 'all'
          ? 'Nothing here matches this filter.'
          : `Nothing in ${formatMonth(month)} yet.`;

  return (
    <>
      <ScreenTitle title="Transactions" />
      <FlatList
        data={rows}
        keyExtractor={(t) => t.id}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={20}
        contentContainerStyle={{
          paddingHorizontal: gutter,
          paddingTop: spacing.xs,
          paddingBottom: contentBottom,
          width: '100%',
          maxWidth: maxContentWidth,
          alignSelf: 'center',
        }}
        ListHeaderComponent={
          <View
            style={{
              gap: spacing.md - 2,
              marginBottom: rows.length ? 0 : spacing.md - 2,
            }}
          >
            {searching && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  height: 40,
                  paddingHorizontal: spacing.md,
                  borderRadius: radius.control,
                  borderCurve: 'continuous',
                  borderWidth: 1,
                  borderColor: colors.accent,
                  backgroundColor: colors.surface,
                }}
              >
                <Icon sf="magnifyingglass" md="search" size={13} color={colors.textTertiary} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  autoFocus
                  placeholder="Search payees, envelopes, notes"
                  placeholderTextColor={colors.placeholder}
                  accessibilityLabel="Search transactions"
                  clearButtonMode="while-editing"
                  returnKeyType="search"
                  style={[typeScale.body, { flex: 1, height: 40, color: colors.text, outlineWidth: 0 }]}
                />
              </View>
            )}
            {rows.length > 0 && <TableCardTop columns={SPLIT_COLUMNS} />}
          </View>
        }
        ListEmptyComponent={
          <Card padded>
            <Text variant="callout" tone="textSecondary">
              {emptyText}
            </Text>
          </Card>
        }
        renderItem={({ item, index }) => {
          const last = index === rows.length - 1;
          return (
            <TableCardRow last={last}>
              <TransactionRow
                t={item}
                account={accountById.get(item.accountId)}
                envelope={item.envelopeId ? envelopeById.get(item.envelopeId) : undefined}
                last={last}
              />
            </TableCardRow>
          );
        }}
      />
      <ScreenActions>
        {/* Filter and month sit down here with search, for one-handed use. */}
        <Dropdown
          variant="compact"
          value={filter}
          onChange={setFilter}
          label="Show"
          options={[
            { value: 'all', label: 'All' },
            { value: 'flagged', label: flaggedCount ? `Flagged ${flaggedCount}` : 'Flagged' },
            { value: 'open', label: 'Not reconciled' },
            { value: 'slips', label: 'Slips' },
          ]}
        />
        {!searching && (
          <Dropdown variant="compact" value={month} options={monthOptions} onChange={setMonth} label="Month" />
        )}
        <ActionButton
          icon={searching ? { sf: 'xmark', md: 'close' } : { sf: 'magnifyingglass', md: 'search' }}
          variant={searching ? 'ink' : 'outline'}
          accessibilityLabel={searching ? 'Close search' : 'Search all transactions'}
          onPress={() => {
            setSearching((s) => !s);
            setQuery('');
          }}
        />
      </ScreenActions>
    </>
  );
}
