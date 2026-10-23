import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Card, CardHeader } from '@/components/card';
import { Icon } from '@/components/icon';
import { LineChart } from '@/components/line-chart';
import { Money } from '@/components/money';
import { Screen } from '@/components/screen';
import { ScreenTitle } from '@/components/screen-title';
import { Text } from '@/components/text';
import { TransactionRow } from '@/components/transaction-row';
import { formatMoney, parseMoney } from '@/domain/money';
import { useAccounts, useDebtPlan, useLedger } from '@/hooks/use-ledger';
import { axisMoney, debtColor, endAtPayoff, horizonTicks, payoffLabel } from '@/screens/debt';
import { useStore } from '@/store';
import { spacing, type as typeScale, useColors } from '@/theme';

/** One editable value in the Details card: label on the left, input on the right. */
function DetailRow({
  label,
  value,
  onChangeText,
  onCommit,
  placeholder,
  suffix,
  numeric,
  last,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  onCommit: () => void;
  placeholder: string;
  suffix?: string;
  numeric?: boolean;
  last?: boolean;
}) {
  const colors = useColors();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        height: 42,
        paddingHorizontal: spacing.md + 2,
        gap: spacing.sm,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.hairline,
      }}
    >
      <Text variant="body" tone="textSecondary" style={{ flex: 1 }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onBlur={onCommit}
        onSubmitEditing={onCommit}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        keyboardType={numeric ? 'number-pad' : 'decimal-pad'}
        inputMode={numeric ? 'numeric' : 'decimal'}
        selectTextOnFocus
        accessibilityLabel={label}
        style={[
          typeScale.body,
          { color: colors.text, fontWeight: '500', textAlign: 'right', minWidth: 90, height: 40, fontVariant: ['tabular-nums'] },
        ]}
      />
      {suffix ? (
        <Text variant="body" tone="textTertiary">
          {suffix}
        </Text>
      ) : null}
    </View>
  );
}

export function DebtDetail({ id }: { id: string }) {
  const colors = useColors();
  const ledger = useLedger();
  const account = useStore((s) => s.accounts.find((a) => a.id === id));
  const envelope = useStore((s) => s.envelopes.find((e) => e.debtAccountId === id));
  const envelopes = useStore((s) => s.envelopes);
  const transactions = useStore((s) => s.transactions);
  const updateAccount = useStore((s) => s.updateAccount);
  const { comparison } = useDebtPlan();
  const { debts } = useAccounts();

  const [apr, setApr] = useState(account?.apr ? (account.apr / 100).toFixed(2) : '');
  const [min, setMin] = useState(account?.minPayment ? (account.minPayment / 100).toFixed(2) : '');
  const [due, setDue] = useState(account?.dueDay ? String(account.dueDay) : '');

  const activity = useMemo(
    () =>
      transactions
        .filter((t) => t.accountId === id)
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt),
    [transactions, id],
  );

  if (!account) return null;
  const owed = -(ledger.balance.get(id) ?? 0);
  const result = comparison?.plan.perDebt.find((d) => d.id === id);
  const balances = comparison?.plan.perDebtBalances[id];
  const values = balances ? endAtPayoff(balances).filter((v) => v !== null) : [];
  const horizon = values.length - 1;
  const color = debtColor(debts, id);
  const ready = envelope ? (ledger.available.get(envelope.id) ?? 0) : 0;
  const slips = activity.filter((t) => t.kind === 'slip');
  const rest = activity.filter((t) => t.kind !== 'slip').slice(0, 20);
  const envelopeById = new Map(envelopes.map((e) => [e.id, e]));

  const commitDue = () => {
    const n = due ? Number(due) : undefined;
    if (n !== undefined && (!Number.isInteger(n) || n < 1 || n > 31)) {
      setDue(account.dueDay ? String(account.dueDay) : '');
      return;
    }
    updateAccount(id, { dueDay: n });
  };

  return (
    <Screen>
      <ScreenTitle title={account.name} context={account.apr ? `${(account.apr / 100).toFixed(2)}% APR` : 'No rate set'} />

      <Card padded>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ gap: 2 }}>
            <Text variant="footnote" tone="textSecondary">
              Owed
            </Text>
            <Money cents={owed} variant="number" />
          </View>
          <View style={{ gap: 2, alignItems: 'flex-end' }}>
            <Text variant="footnote" tone="textSecondary">
              {owed <= 0 ? 'Done' : 'Paid off in the plan'}
            </Text>
            <Text variant="body" weight="600" tone={owed <= 0 ? 'positive' : 'text'} style={{ fontSize: 16, lineHeight: 20 }}>
              {owed <= 0 ? 'Paid off' : result ? payoffLabel(result.payoffMonth) : 'Not in the plan'}
            </Text>
            {result && result.interest > 0 && (
              <Text variant="footnote" tone="textSecondary">
                About {formatMoney(result.interest, { whole: true })} more interest
              </Text>
            )}
          </View>
        </View>
        {horizon > 0 && (
          <LineChart
            height={90}
            directLabels={false}
            series={[{ id, label: account.name, color, values }]}
            xTicks={horizonTicks(horizon)}
            pointLabel={(i) => (i === 0 ? 'Now' : payoffLabel(i))}
            formatValue={(v) => formatMoney(v, { whole: true })}
            formatAxis={axisMoney}
            accessibilityLabel={`${account.name} goes from ${formatMoney(owed, { whole: true })} to zero by ${payoffLabel(result?.payoffMonth ?? null)}.`}
          />
        )}
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button
            title="Make a payment"
            style={{ flex: 1 }}
            onPress={() => router.push({ pathname: '/transfer', params: { to: id } })}
          />
          <Button
            title="Enter statement"
            variant="secondary"
            style={{ flex: 1 }}
            accessibilityLabel="Enter statement balance"
            onPress={() => router.push({ pathname: '/statement', params: { id } })}
          />
        </View>
      </Card>

      {envelope && (
        <Card>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Payment envelope, ${formatMoney(ready)} ready`}
            onPress={() => router.push(`/envelope/${envelope.id}`)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              paddingHorizontal: spacing.md + 2,
              paddingVertical: 10,
              backgroundColor: pressed ? colors.control : colors.surface,
            })}
          >
            <View style={{ flex: 1, gap: 1 }}>
              <Text variant="body" weight="500">
                Payment envelope
              </Text>
              <Text variant="footnote" tone="textSecondary">
                Money here pays this debt. Slips move money here on their own.
              </Text>
            </View>
            <Money cents={ready} weight="600" tone="auto" />
            <Icon sf="chevron.right" md="chevron_right" size={11} color={colors.textTertiary} weight="semibold" />
          </Pressable>
        </Card>
      )}

      <Card>
        <CardHeader title="Details" />
        <DetailRow
          label="Interest rate"
          value={apr}
          onChangeText={setApr}
          placeholder="24.99"
          suffix="%"
          onCommit={() => updateAccount(id, { apr: apr ? Math.round(parseFloat(apr) * 100) : undefined })}
        />
        <DetailRow
          label="Minimum payment"
          value={min}
          onChangeText={setMin}
          placeholder="Estimated"
          onCommit={() => updateAccount(id, { minPayment: parseMoney(min) ?? undefined })}
        />
        <DetailRow
          label="Due day of the month"
          value={due}
          onChangeText={setDue}
          placeholder="Not set"
          numeric
          last
          onCommit={commitDue}
        />
      </Card>

      {slips.length > 0 && (
        <Card tone="slip">
          <CardHeader title="Slips" detail={`${slips.length} on this card`} />
          {slips.map((t, i) => (
            <TransactionRow
              key={t.id}
              t={t}
              account={account}
              envelope={t.envelopeId ? envelopeById.get(t.envelopeId) : undefined}
              columns="single"
              last={i === slips.length - 1}
            />
          ))}
        </Card>
      )}

      {rest.length > 0 && (
        <Card>
          <CardHeader title="Activity" />
          {rest.map((t, i) => (
            <TransactionRow
              key={t.id}
              t={t}
              account={account}
              envelope={t.envelopeId ? envelopeById.get(t.envelopeId) : undefined}
              columns="single"
              last={i === rest.length - 1}
            />
          ))}
        </Card>
      )}
    </Screen>
  );
}
