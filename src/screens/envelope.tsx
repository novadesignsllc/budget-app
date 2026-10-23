import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { Field } from '@/components/field';
import { Section } from '@/components/list';
import { Money } from '@/components/money';
import { SheetScreen } from '@/components/screen';
import { Text } from '@/components/text';
import { TransactionRow } from '@/components/transaction-row';
import { formatMoney, parseMoney } from '@/domain/money';
import { spentInRange } from '@/domain/ledger';
import { useAccounts, useLedger } from '@/hooks/use-ledger';
import { useStore } from '@/store';
import { spacing } from '@/theme';
import { closeSheet } from '@/utils/close-sheet';
import { haptic } from '@/utils/haptics';

export function EnvelopeSheet({ id }: { id: string }) {
  const ledger = useLedger();
  const envelope = useStore((s) => s.envelopes.find((e) => e.id === id));
  const envelopes = useStore((s) => s.envelopes);
  const transactions = useStore((s) => s.transactions);
  const assign = useStore((s) => s.assign);
  const moveMoney = useStore((s) => s.moveMoney);
  const updateEnvelope = useStore((s) => s.updateEnvelope);
  const { all: accounts } = useAccounts();

  const [amountText, setAmountText] = useState('');
  const [name, setName] = useState(envelope?.name ?? '');
  const [targetText, setTargetText] = useState(
    envelope?.monthlyTarget ? (envelope.monthlyTarget / 100).toFixed(2) : '',
  );

  const recent = useMemo(
    () =>
      transactions
        .filter((t) => t.envelopeId === id)
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
        .slice(0, 5),
    [transactions, id],
  );

  if (!envelope) {
    return (
      <SheetScreen>
        <Text variant="title">This envelope is gone</Text>
        <Button title="Close" variant="secondary" onPress={() => closeSheet()} />
      </SheetScreen>
    );
  }

  const available = ledger.available.get(id) ?? 0;
  const rta = ledger.readyToAssign;
  const amount = parseMoney(amountText);
  const isDebt = !!envelope.debtAccountId;
  const owed = isDebt ? -(ledger.balance.get(envelope.debtAccountId!) ?? 0) : 0;

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const spentThisMonth = spentInRange(id, transactions, monthStart, '9999-12-31');
  const toTarget = envelope.monthlyTarget ? envelope.monthlyTarget - (available + spentThisMonth) : 0;

  const donors = envelopes
    .filter((e) => e.id !== id && !e.hidden && (ledger.available.get(e.id) ?? 0) > 0)
    .sort((a, b) => (ledger.available.get(b.id) ?? 0) - (ledger.available.get(a.id) ?? 0))
    .slice(0, 6);

  function apply(cents: number) {
    assign(id, cents);
    haptic('success');
    setAmountText('');
  }

  const accountById = new Map(accounts.map((a) => [a.id, a]));

  return (
    <SheetScreen>
      <View style={{ gap: spacing.xs }}>
        <Text variant="callout" weight="500" tone="textSecondary">
          {envelope.name}
        </Text>
        <Money cents={available} variant="largeTitle" tone={available < 0 ? 'negative' : 'text'} />
        <Text variant="callout" tone="textSecondary">
          {isDebt
            ? available >= owed
              ? 'Enough to pay this off in full.'
              : `${formatMoney(owed - available)} short of the full balance.`
            : available < 0
              ? 'Overspent. Move money in from another envelope.'
              : `Ready to assign: ${formatMoney(rta)}`}
        </Text>
      </View>

      <View style={{ gap: spacing.md }}>
        <Field
          label="Amount"
          value={amountText}
          onChangeText={setAmountText}
          placeholder="0.00"
          keyboardType="decimal-pad"
          inputMode="decimal"
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {toTarget > 0 && rta > 0 && (
            <Chip label={`Fill target +${formatMoney(Math.min(toTarget, rta))}`} onPress={() => apply(Math.min(toTarget, rta))} />
          )}
          {isDebt && owed > available && rta > 0 && (
            <Chip
              label={`Full balance +${formatMoney(Math.min(owed - available, rta))}`}
              onPress={() => apply(Math.min(owed - available, rta))}
            />
          )}
          {rta > 0 && <Chip label={`All of it +${formatMoney(rta)}`} onPress={() => apply(rta)} />}
          {available < 0 && rta > 0 && (
            <Chip label={`Cover ${formatMoney(-available)}`} onPress={() => apply(Math.min(-available, rta))} />
          )}
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button
            title="Assign"
            style={{ flex: 1 }}
            disabled={!amount || amount <= 0}
            onPress={() => amount && apply(amount)}
          />
          <Button
            title="Take back"
            variant="secondary"
            style={{ flex: 1 }}
            disabled={!amount || amount <= 0}
            onPress={() => amount && apply(-amount)}
          />
        </View>
        <Text variant="footnote" tone="textSecondary">
          Take back returns money to Ready to assign.
        </Text>
      </View>

      {available < 0 && donors.length > 0 && (
        <View style={{ gap: spacing.sm }}>
          <Text variant="callout" weight="600" tone="textSecondary">
            Cover it from
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {donors.map((d) => {
              const has = ledger.available.get(d.id) ?? 0;
              const take = Math.min(has, -available);
              return (
                <Chip
                  key={d.id}
                  label={`${d.name} ${formatMoney(take)}`}
                  onPress={() => {
                    moveMoney(d.id, id, take);
                    haptic('success');
                  }}
                />
              );
            })}
          </View>
        </View>
      )}

      {recent.length > 0 && (
        <Section title="Recent">
          {recent.map((t) => (
            <TransactionRow key={t.id} t={t} account={accountById.get(t.accountId)} envelope={undefined} />
          ))}
        </Section>
      )}

      {!isDebt && (
        <View style={{ gap: spacing.md }}>
          <Field
            label="Name"
            value={name}
            onChangeText={setName}
            onEndEditing={() => name.trim() && updateEnvelope(id, { name: name.trim() })}
            onBlur={() => name.trim() && updateEnvelope(id, { name: name.trim() })}
          />
          <Field
            label="Monthly target"
            hint="Optional. What you aim to put in each month."
            value={targetText}
            onChangeText={setTargetText}
            placeholder="0.00"
            keyboardType="decimal-pad"
            inputMode="decimal"
            onBlur={() => updateEnvelope(id, { monthlyTarget: parseMoney(targetText) ?? undefined })}
          />
          <Button
            title="Hide envelope"
            variant="destructive"
            disabled={available !== 0}
            onPress={() => {
              updateEnvelope(id, { hidden: true });
              closeSheet();
            }}
          />
          {available !== 0 && (
            <Text variant="footnote" tone="textSecondary">
              Move its money out before hiding it.
            </Text>
          )}
        </View>
      )}
    </SheetScreen>
  );
}
