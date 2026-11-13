import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { reconnectBank, syncAllBanks } from '@/bank/sync';
import { choiceFromKey } from '@/domain/bank';
import { addDays, today } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import { isCashAccount } from '@/domain/types';
import { syncedLabel, useBankActions, useBankQueue, useBankSyncState, useChoiceOptions, type QueueItem } from '@/hooks/use-bank';
import { useStore } from '@/store';
import { spacing, useColors } from '@/theme';
import { envelopeEmoji } from '@/utils/envelope-emoji';

import { ActionMenu } from './action-menu';
import { MatchDialog } from './bank';
import { Button } from './button';
import { Card } from './card';
import { Dropdown } from './dropdown';
import { Text } from './text';
import { useToast } from './toast';
import { DateBlock } from './transaction-row';

/** The emoji for what a bank transaction will become. */
export function useChoiceEmoji() {
  const envelopes = useStore((s) => s.envelopes);
  const recurring = useStore((s) => s.recurring);
  return (key: string | undefined, item: QueueItem): string => {
    const c = key ? choiceFromKey(key) : undefined;
    if (!c) return item.bank.amount > 0 ? '💵' : '✉️';
    if (c.type === 'envelope') {
      const e = envelopes.find((x) => x.id === c.envelopeId);
      return e ? envelopeEmoji(e) : '✉️';
    }
    if (c.type === 'bill') {
      const r = recurring.find((x) => x.id === c.recurringId);
      const e = r?.envelopeId ? envelopes.find((x) => x.id === r.envelopeId) : undefined;
      return envelopeEmoji(e ?? { name: r?.name ?? '' });
    }
    if (c.type === 'income') return '💵';
    if (c.type === 'transfer') return '🔁';
    if (c.type === 'interest') return '📈';
    return '⚖️';
  };
}

/** The sync time in a card header; tapping it checks the banks now. */
export function SyncNow({ at }: { at?: number }) {
  const [busy, setBusy] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Check the bank now"
      hitSlop={8}
      disabled={busy}
      onPress={() => {
        setBusy(true);
        void syncAllBanks({ force: true }).finally(() => setBusy(false));
      }}
    >
      <Text variant="footnote" tone="textSecondary">
        {busy ? 'Checking…' : syncedLabel(at)}
      </Text>
    </Pressable>
  );
}

/** Banks that want a fresh sign-in, with Reconnect. */
export function ReconnectRows({ padding = spacing.md }: { padding?: number }) {
  const colors = useColors();
  const { needsLogin } = useBankSyncState();
  const showToast = useToast((s) => s.show);
  return needsLogin.map((l) => (
    <View
      key={l.id}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: padding,
        paddingVertical: spacing.sm + 2,
        borderBottomWidth: 1,
        borderBottomColor: colors.hairline,
        backgroundColor: colors.orangeSoft,
      }}
    >
      <Text variant="callout" color={colors.orange} style={{ flex: 1 }}>
        {l.institution} wants you to sign in again
      </Text>
      <Button
        title="Reconnect"
        size="sm"
        variant="secondary"
        onPress={() => reconnectBank(l.id).catch((e: Error) => showToast({ message: e.message }))}
      />
    </View>
  ));
}

function QueueRow({
  item,
  choice,
  onChoose,
  onApprove,
  onSkip,
  last,
}: {
  item: QueueItem;
  choice: string | undefined;
  onChoose: (key: string) => void;
  onApprove: () => void;
  onSkip: () => void;
  last: boolean;
}) {
  const colors = useColors();
  const options = useChoiceOptions(item);
  const emojiFor = useChoiceEmoji();
  const { bank, account } = item;
  const slip = !isCashAccount(account) && bank.amount < 0 && choiceFromKey(choice ?? '')?.type === 'envelope';
  const note = bank.pending ? 'Pending' : slip ? `Slip on ${account.name}` : account.name;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        minHeight: 52,
        paddingLeft: spacing.sm,
        paddingRight: spacing.md - 2,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.hairline,
        backgroundColor: slip ? colors.negativeTint : colors.surface,
      }}
    >
      <ActionMenu
        accessibilityLabel={`${bank.name}, ${formatMoney(bank.amount)}. More`}
        items={[
          { label: 'Link to one I entered', onPress: () => router.push({ pathname: '/bank-match', params: { id: bank.id } }) },
          { label: 'Skip it', onPress: onSkip },
        ]}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, opacity: pressed ? 0.6 : 1 })}
      >
        <DateBlock date={bank.date} tone={slip ? 'negative' : undefined} />
        <Text style={{ width: 20, textAlign: 'center', fontSize: 15, lineHeight: 20 }} accessible={false}>
          {emojiFor(choice, item)}
        </Text>
      </ActionMenu>
      <View style={{ flex: 1, minWidth: 0, gap: 2, paddingVertical: 7 }}>
        <Text variant="row" weight="600" tone={slip ? 'negative' : 'text'} numberOfLines={1} style={{ fontSize: 12, lineHeight: 15 }}>
          {bank.name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 0 }}>
          {/* The envelope stays readable; the account name gives way first. */}
          <View style={{ flexShrink: 0, maxWidth: '70%' }}>
            <Dropdown variant="link" value={choice} options={options} onChange={onChoose} placeholder="Pick envelope" searchable label="Envelope" />
          </View>
          <Text variant="caption" tone={slip ? 'negative' : 'textSecondary'} numberOfLines={1} style={{ flexShrink: 1, fontSize: 10.5 }}>
            · {note}
          </Text>
        </View>
      </View>
      <Text
        variant="row"
        weight="600"
        tone={bank.amount > 0 ? 'positive' : 'negative'}
        style={{ fontSize: 12, fontVariant: ['tabular-nums'] }}
      >
        {formatMoney(bank.amount, { signed: bank.amount > 0 })}
      </Text>
      <Button title="Approve" size="sm" variant="tinted" onPress={onApprove} />
    </View>
  );
}

/**
 * Home's list of what the bank sent that isn't in Slip yet. Approve adds it (asking first
 * when it's close to one you entered); tap the date for Link or Skip.
 */
export function BankQueueCard() {
  const colors = useColors();
  const items = useBankQueue();
  const { linked, syncedAt } = useBankSyncState();
  const { approve, skip, dialog } = useBankActions();
  const bankTransactions = useStore((s) => s.bankTransactions);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const matched = useMemo(() => {
    const weekAgo = addDays(today(), -6);
    return bankTransactions.filter((b) => b.status === 'linked' && b.date >= weekAgo && !b.transactionId?.startsWith('bank-')).length;
  }, [bankTransactions]);
  if (!linked) return null;

  return (
    <Card>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingHorizontal: spacing.md + 2,
          paddingVertical: spacing.md - 1,
          borderBottomWidth: 1,
          borderBottomColor: colors.separator,
        }}
      >
        <Text variant="section" accessibilityRole="header">
          From your bank
        </Text>
        {items.length > 0 && (
          <View style={{ minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Text variant="caption" weight="700" tone="accent">
              {items.length}
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }} />
        <SyncNow at={syncedAt} />
      </View>
      <ReconnectRows />
      {items.length === 0 ? (
        <Text variant="callout" tone="textSecondary" style={{ padding: spacing.md + 2 }}>
          All caught up.
        </Text>
      ) : (
        items.map((item, i) => {
          const choice = picked[item.bank.id] ?? item.guess;
          return (
            <QueueRow
              key={item.bank.id}
              item={item}
              choice={choice}
              onChoose={(key) => setPicked((p) => ({ ...p, [item.bank.id]: key }))}
              onApprove={() => approve(item, choice)}
              onSkip={() => skip(item)}
              last={i === items.length - 1}
            />
          );
        })
      )}
      {matched > 0 && (
        <Text
          variant="footnote"
          tone="textSecondary"
          style={{ paddingHorizontal: spacing.md + 2, paddingVertical: spacing.sm + 2, borderTopWidth: 1, borderTopColor: colors.separator }}
        >
          {matched} matched to ones you entered this week
        </Text>
      )}
      <MatchDialog {...dialog} />
    </Card>
  );
}
