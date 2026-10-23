import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { CardFace } from '@/components/card-face';
import { ICON_INSET, Row, Section } from '@/components/list';
import { Money } from '@/components/money';
import { Screen } from '@/components/screen';
import { TransactionRow } from '@/components/transaction-row';
import { formatMoney, parseMoney } from '@/domain/money';
import { useAccounts, useDebtPlan, useLedger } from '@/hooks/use-ledger';
import { payoffLabel } from '@/screens/debt';
import { useStore } from '@/store';
import { spacing } from '@/theme';

export function DebtDetail({ id }: { id: string }) {
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
  const ready = envelope ? (ledger.available.get(envelope.id) ?? 0) : 0;
  const slips = activity.filter((t) => t.kind === 'slip');
  const envelopeById = new Map(envelopes.map((e) => [e.id, e]));

  return (
    <Screen>
      <Stack.Screen options={{ title: account.name, headerLargeTitleEnabled: false }} />
      <View style={{ alignItems: 'center' }}>
        <CardFace
          face={Math.max(0, debts.findIndex((d) => d.id === id))}
          width={340}
          title={account.name}
          caption={account.apr ? `${(account.apr / 100).toFixed(2)}% APR` : undefined}
          amount={formatMoney(owed)}
          footnote={
            owed <= 0
              ? 'Paid off'
              : result
                ? `Paid off ${payoffLabel(result.payoffMonth)} · about ${formatMoney(result.interest, { whole: true })} more interest`
                : undefined
          }
          footnoteTone={owed <= 0 ? 'good' : 'muted'}
        />
      </View>

      <View style={{ gap: spacing.sm }}>
        <Button
          title={ready > 0 ? `Make a payment (${formatMoney(ready)} ready)` : 'Make a payment'}
          size="lg"
          onPress={() => router.push({ pathname: '/transfer', params: { to: id } })}
        />
        <Button
          title="Enter statement balance"
          variant="secondary"
          size="lg"
          onPress={() => router.push({ pathname: '/statement', params: { id } })}
        />
      </View>

      {envelope && (
        <Section footer="Money assigned here pays this debt. Card slips move money here automatically.">
          <Row
            href={`/envelope/${envelope.id}`}
            title="Payment envelope"
            trailing={<Money cents={ready} weight="500" tone={ready < 0 ? 'negative' : 'text'} />}
            chevron
          />
        </Section>
      )}

      <Section title="Details">
        <View style={{ padding: spacing.lg, gap: spacing.lg }}>
          <Field
            label="Interest rate (APR %)"
            value={apr}
            onChangeText={setApr}
            keyboardType="decimal-pad"
            inputMode="decimal"
            onBlur={() => updateAccount(id, { apr: apr ? Math.round(parseFloat(apr) * 100) : undefined })}
          />
          <Field
            label="Minimum payment"
            value={min}
            onChangeText={setMin}
            keyboardType="decimal-pad"
            inputMode="decimal"
            onBlur={() => updateAccount(id, { minPayment: parseMoney(min) ?? undefined })}
          />
        </View>
      </Section>

      {slips.length > 0 && (
        <Section title={`Slips (${slips.length})`} inset={ICON_INSET}>
          {slips.map((t) => (
            <TransactionRow key={t.id} t={t} envelope={t.envelopeId ? envelopeById.get(t.envelopeId) : undefined} showAccount={false} />
          ))}
        </Section>
      )}

      {activity.length > 0 && (
        <Section title="Activity" inset={ICON_INSET}>
          {activity
            .filter((t) => t.kind !== 'slip')
            .slice(0, 20)
            .map((t) => (
              <TransactionRow key={t.id} t={t} showAccount={false} />
            ))}
        </Section>
      )}
    </Screen>
  );
}
