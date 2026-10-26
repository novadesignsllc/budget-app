import { useState } from 'react';
import { View } from 'react-native';

import { Card } from '@/components/card';
import { Dropdown } from '@/components/dropdown';
import { AmountRow, FormCard } from '@/components/form';
import { LineChart } from '@/components/line-chart';
import { Money } from '@/components/money';
import { Text } from '@/components/text';
import { debtTarget, estimateMinPayment } from '@/domain/debt';
import { ceilDollars, formatDollars, formatMoney, parseMoney } from '@/domain/money';
import { useAccounts, useDebtPlan, useLedger } from '@/hooks/use-ledger';
import { AccountDetail } from '@/screens/account';
import { axisMoney, debtColor, endAtPayoff, horizonTicks, payoffLabel } from '@/screens/debt';
import { useStore } from '@/store';

/**
 * A debt's page: the account register (activity, slips in red, Reconcile at the bottom)
 * with the payoff picture and the debt's details on top.
 */
export function DebtDetail({ id }: { id: string }) {
  return <AccountDetail id={id} header={<DebtHeader id={id} />} />;
}

function DebtHeader({ id }: { id: string }) {
  const ledger = useLedger();
  const account = useStore((s) => s.accounts.find((a) => a.id === id));
  const updateAccount = useStore((s) => s.updateAccount);
  const { comparison } = useDebtPlan();
  const { debts } = useAccounts();

  const [apr, setApr] = useState(account?.apr ? (account.apr / 100).toFixed(2) : '');
  const [min, setMin] = useState(account?.minPayment ? (account.minPayment / 100).toFixed(2) : '');
  const [due, setDue] = useState(account?.dueDay ? String(account.dueDay) : '');
  const [custom, setCustom] = useState(
    account?.paymentTarget ? String(Math.round(account.paymentTarget / 100)) : '',
  );

  if (!account) return null;
  const owed = -(ledger.balance.get(id) ?? 0);
  const result = comparison?.plan.perDebt.find((d) => d.id === id);
  const balances = comparison?.plan.perDebtBalances[id];
  const values = balances ? endAtPayoff(balances).filter((v) => v !== null) : [];
  const horizon = values.length - 1;
  const color = debtColor(debts, id);
  const minimum = account.minPayment || estimateMinPayment(owed, account.apr ?? 0);
  const targetMode = account.paymentTarget ? 'custom' : 'minimum';

  const commitDue = (text: string) => {
    const n = text ? Number(text) : undefined;
    if (n !== undefined && (!Number.isInteger(n) || n < 1 || n > 31)) {
      setDue(account.dueDay ? String(account.dueDay) : '');
      return;
    }
    updateAccount(id, { dueDay: n });
  };
  const commitCustom = (text: string) => {
    const dollars = Number(text || 0);
    updateAccount(id, { paymentTarget: dollars > 0 ? dollars * 100 : null });
  };

  return (
    <View style={{ gap: 12 }}>
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
      </Card>

      <FormCard>
        <Dropdown<'minimum' | 'custom'>
          variant="row"
          label="Monthly target"
          value={targetMode}
          onChange={(mode) => {
            if (mode === 'minimum') {
              updateAccount(id, { paymentTarget: null });
              return;
            }
            // Start from the minimum, rounded up to whole dollars like the rest of the budget.
            const start = ceilDollars(minimum);
            setCustom(String(start / 100));
            updateAccount(id, { paymentTarget: start });
          }}
          options={[
            { value: 'minimum', label: 'Minimum payment', detail: formatDollars(minimum, 'up') },
            { value: 'custom', label: 'Custom' },
          ]}
        />
        {targetMode === 'custom' && (
          <AmountRow
            label="Target"
            value={custom}
            onChange={setCustom}
            onCommit={commitCustom}
            mode="whole"
            placeholder={formatDollars(debtTarget(account, owed), 'up')}
          />
        )}
        <AmountRow
          label="Minimum payment"
          value={min}
          onChange={setMin}
          onCommit={(t) => updateAccount(id, { minPayment: parseMoney(t) ?? undefined })}
          placeholder="Estimated"
        />
        <AmountRow
          label="Interest rate"
          value={apr}
          onChange={setApr}
          onCommit={(t) => updateAccount(id, { apr: t ? Math.round(parseFloat(t) * 100) : undefined })}
          unit="percent"
          placeholder="24.99%"
        />
        <AmountRow
          label="Due day"
          value={due}
          onChange={setDue}
          onCommit={commitDue}
          mode="whole"
          unit="number"
          placeholder="Not set"
        />
      </FormCard>

      <Text variant="section" style={{ marginTop: 4 }}>
        Activity
      </Text>
    </View>
  );
}
