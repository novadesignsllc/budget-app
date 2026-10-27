import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';

import { Dropdown, type DropdownOption } from '@/components/dropdown';
import { formatPickedDate } from '@/components/date-picker';
import { Text } from '@/components/text';
import { useToast } from '@/components/toast';
import { cleanAmount, showAmount } from '@/domain/amount-text';
import { addDays, today } from '@/domain/dates';
import { formatMoney, parseMoney } from '@/domain/money';
import { monthOf, type MonthKey } from '@/domain/months';
import { payeeMemory } from '@/domain/payees';
import { draftFromFields } from '@/domain/quick-add';
import { isCashAccount, type ISODate } from '@/domain/types';
import { useEntryOptions } from '@/hooks/use-entry-options';
import { useAccounts } from '@/hooks/use-ledger';
import { isListed, newestFirst } from '@/screens/transactions';
import { useStore } from '@/store';
import { spacing, type as typeScale, useColors } from '@/theme';
import { useMonthOptions } from '@/utils/month-options';

import { FLEX, GAP, Pill, RegisterHeader, RegisterRow, W } from './register';
import { DButton, DCard, DPage, PageTitle, SearchField, Spacer } from './ui';

/** A search across every month shows this many at most. */
const SEARCH_LIMIT = 300;

type Filter = 'flagged' | 'noEnvelope' | 'open';

const monthFormat = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });

/**
 * Every transaction in a spreadsheet: type a new one in the top row and press Enter,
 * click a row to edit it. Account pills filter the list; search covers every month.
 */
export function DesktopTransactions() {
  const colors = useColors();
  const transactions = useStore((s) => s.transactions);
  const envelopes = useStore((s) => s.envelopes);
  const { all: accounts } = useAccounts();
  const monthOptions = useMonthOptions().map((o) => ({ ...o, label: monthFormat.format(asDate(o.value)) }));
  const [month, setMonth] = useState<MonthKey>(monthOf(today()));
  const [query, setQuery] = useState('');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter | null>(null);

  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const envelopeById = useMemo(() => new Map(envelopes.map((e) => [e.id, e])), [envelopes]);
  const searching = query.trim().length > 0;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions
      .filter(isListed)
      .filter((t) => {
        if (accountId && t.accountId !== accountId) return false;
        if (filter === 'flagged' && !t.flagged) return false;
        if (filter === 'open' && t.reconciled) return false;
        if (filter === 'noEnvelope' && !((t.kind === 'spend' || t.kind === 'slip') && !t.envelopeId)) return false;
        if (!q) return monthOf(t.date) === month;
        const env = t.envelopeId ? envelopeById.get(t.envelopeId)?.name : '';
        const amount = (Math.abs(t.amount) / 100).toFixed(2);
        return `${t.payee} ${env ?? ''} ${t.memo ?? ''} ${amount}`.toLowerCase().includes(q);
      })
      .sort(newestFirst);
  }, [transactions, query, accountId, filter, month, envelopeById]);

  const shown = searching ? rows.slice(0, SEARCH_LIMIT) : rows;
  const out = rows.reduce((a, t) => a + (t.amount < 0 ? -t.amount : 0), 0);
  const inflow = rows.reduce((a, t) => a + (t.amount > 0 ? t.amount : 0), 0);
  const selectedAccount = accountId ? accountById.get(accountId) : undefined;

  return (
    <DPage
      title="Transactions"
      header={
        <>
          <PageTitle>Transactions</PageTitle>
          {!searching && (
            <Dropdown variant="compact" value={month} options={monthOptions} onChange={setMonth} label="Month" />
          )}
          <Spacer />
          <SearchField value={query} onChange={setQuery} placeholder="Search payee, note, amount" width={280} />
          <DButton
            label={selectedAccount ? `Reconcile ${selectedAccount.name}` : 'Reconcile'}
            accessibilityLabel={selectedAccount ? `Reconcile ${selectedAccount.name}` : 'Pick an account to reconcile'}
            disabled={!selectedAccount}
            onPress={() =>
              selectedAccount &&
              router.navigate(isCashAccount(selectedAccount) ? `/account/${selectedAccount.id}` : `/debt/${selectedAccount.id}`)
            }
          />
        </>
      }
    >
      <View accessibilityRole="toolbar" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm }}>
        <Pill label="All accounts" on={!accountId} onPress={() => setAccountId(null)} />
        {accounts.map((a) => (
          <Pill key={a.id} label={a.name} on={accountId === a.id} onPress={() => setAccountId(accountId === a.id ? null : a.id)} />
        ))}
        <View style={{ width: 1, height: 20, backgroundColor: colors.borderStrong, marginHorizontal: 4 }} />
        <Pill label="Flagged" on={filter === 'flagged'} onPress={() => setFilter(filter === 'flagged' ? null : 'flagged')} />
        <Pill label="No envelope" on={filter === 'noEnvelope'} onPress={() => setFilter(filter === 'noEnvelope' ? null : 'noEnvelope')} />
        <Pill label="Not reconciled" on={filter === 'open'} onPress={() => setFilter(filter === 'open' ? null : 'open')} />
      </View>

      <DCard style={{ minWidth: 900 }}>
        <RegisterHeader columns={{}} />

        <EntryRow defaultAccountId={accountId} />

        {shown.length === 0 ? (
          <Text variant="callout" tone="textSecondary" style={{ padding: 16 }}>
            {transactions.length === 0
              ? 'No transactions yet. Type one in the row above.'
              : searching
                ? 'Nothing matches that search.'
                : 'Nothing here for this month and filter.'}
          </Text>
        ) : (
          shown.map((t) => (
            <RegisterRow
              key={t.id}
              columns={{}}
              t={t}
              account={accountById.get(t.accountId)}
              other={t.transferAccountId ? accountById.get(t.transferAccountId) : undefined}
              envelope={t.envelopeId ? envelopeById.get(t.envelopeId) : undefined}
            />
          ))
        )}

        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            gap: spacing.md,
            paddingHorizontal: 16,
            paddingVertical: 12,
            backgroundColor: colors.tableHeader,
            borderTopWidth: 1,
            borderTopColor: colors.separator,
          }}
        >
          <Text variant="callout" tone="textSecondary">
            {searching ? 'Every month' : monthFormat.format(asDate(month))} · {rows.length}{' '}
            {rows.length === 1 ? 'transaction' : 'transactions'}
            {searching && rows.length > SEARCH_LIMIT ? ` (showing the newest ${SEARCH_LIMIT})` : ''}
          </Text>
          <Text variant="callout" tone="textSecondary" style={{ fontVariant: ['tabular-nums'] }}>
            Out{' '}
            <Text variant="callout" weight="700">
              {formatMoney(out)}
            </Text>
            {'  ·  '}In{' '}
            <Text variant="callout" weight="700" tone="positive">
              {formatMoney(inflow)}
            </Text>
          </Text>
        </View>
      </DCard>
    </DPage>
  );
}

const asDate = (m: MonthKey) => {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1);
};

/**
 * The row for typing a new transaction, always at the top of the table. The envelope
 * fills in from the payee the way New transaction does; Enter saves and clears it for
 * the next one, keeping the date and account.
 */
function EntryRow({ defaultAccountId }: { defaultAccountId: string | null }) {
  const colors = useColors();
  const envelopes = useStore((s) => s.envelopes);
  const payees = useStore((s) => s.payees);
  const legacyMemory = useStore((s) => s.merchantMemory);
  const addTransaction = useStore((s) => s.addTransaction);
  const deleteTransaction = useStore((s) => s.deleteTransaction);
  const showToast = useToast((s) => s.show);
  const { all: accounts } = useAccounts();
  const { envelopeOptions, accountOptions } = useEntryOptions();
  const payeeRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  const day = today();
  const [date, setDate] = useState<ISODate>(day);
  const [payee, setPayee] = useState('');
  const [envelopeId, setEnvelopeId] = useState<string | undefined>();
  const [pickedAccount, setPickedAccount] = useState<string | undefined>();
  const [note, setNote] = useState('');
  const [outText, setOutText] = useState('');
  const [inText, setInText] = useState('');
  const [problem, setProblem] = useState('');

  const memory = useMemo(() => (payees.length ? payeeMemory(payees) : legacyMemory), [payees, legacyMemory]);
  const draft = draftFromFields(payee, null, { accounts, envelopes, merchantMemory: memory, today: day });
  const accountId = pickedAccount ?? defaultAccountId ?? draft.accountId ?? undefined;
  const account = accounts.find((a) => a.id === accountId);
  const income = !!inText;
  const chosenEnvelope = income ? undefined : (envelopeId ?? draft.envelopeId ?? undefined);

  const dateOptions = useMemo<DropdownOption<ISODate>[]>(() => {
    const list: DropdownOption<ISODate>[] = [];
    for (let i = -7; i <= 60; i++) {
      const d = addDays(day, -i);
      list.push({ value: d, label: formatPickedDate(d, day), section: i < 0 ? 'Coming up' : undefined });
    }
    return list;
  }, [day]);

  function save() {
    const amount = parseMoney(inText || outText);
    const missing = !payee.trim()
      ? 'Add a payee.'
      : !amount
        ? 'Add an amount.'
        : !account
          ? 'Pick an account.'
          : !income && !chosenEnvelope
            ? 'Pick an envelope.'
            : '';
    setProblem(missing);
    if (missing || !amount || !account) return;
    const id = addTransaction({
      date,
      accountId: account.id,
      amount,
      kind: income ? 'income' : isCashAccount(account) ? 'spend' : 'slip',
      payee: payee.trim(),
      envelopeId: chosenEnvelope,
      memo: note.trim() || undefined,
    });
    showToast({
      message: `Added ${payee.trim()} · ${formatMoney(amount)}`,
      actionLabel: 'Undo',
      onAction: () => deleteTransaction(id),
    });
    setPayee('');
    setEnvelopeId(undefined);
    setNote('');
    setOutText('');
    setInText('');
    payeeRef.current?.focus();
  }

  const input = (props: React.ComponentProps<typeof TextInput>, flex?: number, width?: number) => (
    <TextInput
      placeholderTextColor={colors.placeholder}
      onSubmitEditing={save}
      submitBehavior="submit"
      onKeyPress={(e) => {
        if (e.nativeEvent.key === 'Escape') {
          setPayee('');
          setOutText('');
          setInText('');
          setNote('');
          setProblem('');
        }
      }}
      {...props}
      style={[
        typeScale.callout,
        {
          height: 30,
          paddingHorizontal: 8,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          borderRadius: 7,
          backgroundColor: colors.surface,
          color: colors.text,
          outlineColor: colors.accent,
          minWidth: 0,
        },
        flex ? { flex } : { width },
        props.style,
      ]}
    />
  );

  return (
    <View style={{ backgroundColor: colors.accentFaint, borderBottomWidth: 1, borderBottomColor: colors.separator }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: GAP, paddingHorizontal: 16, paddingVertical: 8 }}>
        <View style={{ width: W.date }}>
          <Dropdown variant="inline" value={date} options={dateOptions} onChange={setDate} label="Date" />
        </View>
        {input(
          {
            ref: payeeRef,
            value: payee,
            onChangeText: (t) => {
              setPayee(t);
              setProblem('');
            },
            placeholder: 'New transaction: payee',
            accessibilityLabel: 'Payee',
          },
          FLEX.payee,
        )}
        <View style={{ flex: FLEX.envelope, minWidth: 0 }}>
          {income ? (
            <View style={{ height: 30, justifyContent: 'center', paddingHorizontal: 9 }}>
              <Text variant="callout" tone="positive" numberOfLines={1}>
                Ready to assign
              </Text>
            </View>
          ) : (
            <Dropdown
              variant="inline"
              value={chosenEnvelope}
              options={envelopeOptions}
              onChange={setEnvelopeId}
              label="Envelope"
              placeholder="Envelope"
            />
          )}
        </View>
        <View style={{ flex: FLEX.account, minWidth: 0 }}>
          <Dropdown variant="inline" value={accountId} options={accountOptions} onChange={setPickedAccount} label="Account" placeholder="Account" />
        </View>
        {input({ value: note, onChangeText: setNote, placeholder: 'Note', accessibilityLabel: 'Note' }, FLEX.note)}
        {input(
          {
            // Digits fill in from the right, like New transaction: 4357 is $43.57.
            value: outText ? showAmount(outText) : '',
            onChangeText: (t) => {
              setOutText(cleanAmount(t));
              if (t) setInText('');
              setProblem('');
            },
            placeholder: '$0.00',
            accessibilityLabel: 'Outflow',
            inputMode: 'decimal',
            style: { textAlign: 'right', fontVariant: ['tabular-nums'] },
          },
          undefined,
          W.out,
        )}
        {input(
          {
            // Digits fill in from the right, like New transaction: 4357 is $43.57.
            value: inText ? showAmount(inText) : '',
            onChangeText: (t) => {
              setInText(cleanAmount(t));
              if (t) setOutText('');
              setProblem('');
            },
            placeholder: '$0.00',
            accessibilityLabel: 'Inflow',
            inputMode: 'decimal',
            style: { textAlign: 'right', fontVariant: ['tabular-nums'] },
          },
          undefined,
          W.in,
        )}
      </View>
      {problem ? (
        <Text variant="footnote" tone="negative" style={{ paddingHorizontal: 16, paddingBottom: 8, marginTop: -2 }}>
          {problem}
        </Text>
      ) : account && !income && !isCashAccount(account) && (outText || payee) ? (
        <Text variant="footnote" tone="negative" style={{ paddingHorizontal: 16, paddingBottom: 8, marginTop: -2 }}>
          This goes on {account.name}: it’s a slip.
        </Text>
      ) : null}
    </View>
  );
}
