import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ActionMenu } from '@/components/action-menu';
import { MatchDialog, StatusIcon } from '@/components/bank';
import { ReconnectRows, SyncNow, useChoiceEmoji } from '@/components/bank-queue';
import { Dropdown } from '@/components/dropdown';
import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import { choiceFromKey } from '@/domain/bank';
import { formatMoney } from '@/domain/money';
import { isCashAccount } from '@/domain/types';
import { useBankActions, useBankQueue, useBankSyncState, useChoiceOptions, type QueueItem } from '@/hooks/use-bank';
import { spacing, useColors } from '@/theme';

import { shortDate } from './budget';
import { DButton, DCard } from './ui';

const COL = { date: 56, account: 120, envelope: 168, status: 24, amount: 96, actions: 116 } as const;

function Row({
  item,
  choice,
  onChoose,
  onApprove,
  onSkip,
}: {
  item: QueueItem;
  choice: string | undefined;
  onChoose: (key: string) => void;
  onApprove: () => void;
  onSkip: () => void;
}) {
  const colors = useColors();
  const options = useChoiceOptions(item);
  const emojiFor = useChoiceEmoji();
  const { bank, account } = item;
  const slip = !isCashAccount(account) && bank.amount < 0 && choiceFromKey(choice ?? '')?.type === 'envelope';
  const ink = slip ? colors.negative : colors.text;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: 52,
        paddingHorizontal: 18,
        borderTopWidth: 1,
        borderTopColor: colors.hairline,
        backgroundColor: slip ? colors.negativeTint : 'transparent',
      }}
    >
      <Text variant="callout" color={slip ? colors.negative : colors.textSecondary} style={{ width: COL.date }}>
        {shortDate(bank.date)}
      </Text>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="body" weight="600" color={ink} numberOfLines={1}>
          {bank.name}
        </Text>
        {bank.raw !== bank.name && (
          <Text variant="caption" tone="textTertiary" numberOfLines={1}>
            {bank.raw}
          </Text>
        )}
      </View>
      <Text variant="callout" color={slip ? colors.negative : colors.textSecondary} numberOfLines={1} style={{ width: COL.account }}>
        {slip ? `Slip on ${account.name}` : account.name}
      </Text>
      <View style={{ width: COL.envelope, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text accessible={false} style={{ fontSize: 14 }}>
          {emojiFor(choice, item)}
        </Text>
        <View style={{ flex: 1 }}>
          <Dropdown variant="inline" value={choice} options={options} onChange={onChoose} placeholder="Pick envelope" searchable label="Envelope" />
        </View>
      </View>
      <View style={{ width: COL.status, alignItems: 'center' }} accessible accessibilityLabel={bank.pending ? 'Pending' : 'Posted'}>
        <StatusIcon status={bank.pending ? 'pending' : 'posted'} size={18} />
      </View>
      <Text
        variant="body"
        weight="600"
        color={bank.amount > 0 ? colors.positive : colors.negative}
        align="right"
        style={{ width: COL.amount, fontVariant: ['tabular-nums'] }}
      >
        {formatMoney(bank.amount, { signed: bank.amount > 0 })}
      </Text>
      <View style={{ width: COL.actions, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 6 }}>
        <DButton label="Approve" onPress={onApprove} style={{ height: 30 }} />
        <ActionMenu
          accessibilityLabel={`More for ${bank.name}`}
          items={[
            { label: 'Link to one I entered', onPress: () => router.push({ pathname: '/bank-match', params: { id: bank.id } }) },
            { label: 'Skip it', onPress: onSkip },
          ]}
          style={({ pressed, open }) => ({
            width: 30,
            height: 30,
            borderRadius: 8,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: pressed || open ? colors.control : 'transparent',
          })}
        >
          <Icon sf="ellipsis" md="more_horiz" size={14} color={colors.textSecondary} />
        </ActionMenu>
      </View>
    </View>
  );
}

/** Desktop Home's "From your bank": the same list as the phone, as a table. */
export function DesktopBankQueue() {
  const colors = useColors();
  const items = useBankQueue();
  const { linked, syncedAt } = useBankSyncState();
  const { approve, skip, dialog } = useBankActions();
  const [picked, setPicked] = useState<Record<string, string>>({});
  if (!linked) return null;
  const label = (text: string, width?: number, right?: boolean) => (
    <Text variant="label" caps tone="textTertiary" align={right ? 'right' : 'left'} style={width ? { width } : { flex: 1 }}>
      {text}
    </Text>
  );
  return (
    <DCard>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 12 }}>
        <Text variant="body" weight="700">
          From your bank
        </Text>
        {items.length > 0 && (
          <View style={{ minWidth: 22, height: 22, paddingHorizontal: 7, borderRadius: 11, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Text variant="caption" weight="700" tone="accent">
              {items.length}
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }} />
        <SyncNow at={syncedAt} />
      </View>
      <ReconnectRows padding={18} />
      {items.length === 0 ? (
        <Text variant="callout" tone="textSecondary" style={{ paddingHorizontal: 18, paddingBottom: 16 }}>
          All caught up.
        </Text>
      ) : (
        <>
          <View
            style={{
              flexDirection: 'row',
              gap: 12,
              paddingHorizontal: 18,
              paddingVertical: 8,
              backgroundColor: colors.tableHeader,
              borderTopWidth: 1,
              borderTopColor: colors.separator,
            }}
          >
            {label('Date', COL.date)}
            {label('Payee')}
            {label('Account', COL.account)}
            {label('Envelope', COL.envelope)}
            <View style={{ width: COL.status }} />
            {label('Amount', COL.amount, true)}
            <View style={{ width: COL.actions }} />
          </View>
          {items.map((item) => {
            const choice = picked[item.bank.id] ?? item.guess;
            return (
              <Row
                key={item.bank.id}
                item={item}
                choice={choice}
                onChoose={(key) => setPicked((p) => ({ ...p, [item.bank.id]: key }))}
                onApprove={() => approve(item, choice)}
                onSkip={() => skip(item)}
              />
            );
          })}
        </>
      )}
      <MatchDialog {...dialog} />
    </DCard>
  );
}
