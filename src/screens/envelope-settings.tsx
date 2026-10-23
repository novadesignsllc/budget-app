import { useRef, useState } from 'react';
import { TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Dropdown, type DropdownOption } from '@/components/dropdown';
import { Field } from '@/components/field';
import { SheetScreen } from '@/components/screen';
import { Text } from '@/components/text';
import { today } from '@/domain/dates';
import { parseMoney } from '@/domain/money';
import { formatMonth, monthOf, type MonthKey } from '@/domain/months';
import { targetFor } from '@/domain/targets';
import { GROUPS, type BudgetGroup } from '@/domain/types';
import { useLedger } from '@/hooks/use-ledger';
import { fixGroup, useStore } from '@/store';
import { groupColor, spacing } from '@/theme';
import { closeSheet } from '@/utils/close-sheet';
import { haptic } from '@/utils/haptics';

import { SheetHeader } from '@/components/sheet-header';

const GROUP_HINT: Record<BudgetGroup, string> = {
  Daily: 'Day-to-day spending: groceries, eating out, dates',
  Savings: 'A goal you add to every month and leave alone',
  Bills: 'Fixed costs that come due each month',
};

/** The three groups you can pick. Debt payments are made automatically, one per debt. */
export function GroupPicker({ group, onGroup }: { group: string; onGroup: (group: BudgetGroup) => void }) {
  const options: DropdownOption<BudgetGroup>[] = GROUPS.map((g) => ({
    value: g,
    label: g,
    dot: groupColor(g),
    description: GROUP_HINT[g],
  }));
  return <Dropdown label="Group" value={fixGroup(group) as BudgetGroup} options={options} onChange={onGroup} />;
}

/** Savings targets are what goes in each month; Bills and Daily targets are the month's budget. */
export function targetLabel(group: string) {
  return group === 'Savings' ? 'Put in each month' : 'Monthly budget';
}

export function EnvelopeSettings({ id, month: monthParam }: { id: string; month?: MonthKey }) {
  const month = monthParam ?? monthOf(today());
  const envelope = useStore((s) => s.envelopes.find((e) => e.id === id));
  const updateEnvelope = useStore((s) => s.updateEnvelope);
  const setTargetFor = useStore((s) => s.setTarget);
  const ledger = useLedger();
  const [name, setName] = useState(envelope?.name ?? '');
  const [group, setGroup] = useState<string>(fixGroup(envelope?.group ?? 'Daily'));
  const targetRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const current = envelope ? targetFor(envelope, month) : null;
  const [target, setTarget] = useState(current ? (current / 100).toFixed(2) : '');
  const [confirmHide, setConfirmHide] = useState(false);

  if (!envelope) {
    return (
      <SheetScreen>
        <SheetHeader title="Edit envelope" />
        <Text variant="body" tone="textSecondary" align="center">
          This envelope is gone.
        </Text>
      </SheetScreen>
    );
  }

  const available = ledger.available.get(id) ?? 0;
  const isDebt = !!envelope.debtAccountId;

  return (
    <SheetScreen>
      <SheetHeader title="Edit envelope" />
      <Field
        label="Name"
        value={name}
        onChangeText={setName}
        editable={!isDebt}
        returnKeyType={isDebt ? 'done' : 'next'}
        onSubmitEditing={() => targetRef.current?.focus()}
        submitBehavior={isDebt ? 'blurAndSubmit' : 'submit'}
      />
      {!isDebt && <GroupPicker group={group} onGroup={setGroup} />}
      {!isDebt && (
        <Field
          ref={targetRef}
          label={targetLabel(group)}
          optional
          note={`applies from ${formatMonth(month)} on`}
          hint="Earlier months keep the target they had."
          value={target}
          onChangeText={setTarget}
          placeholder="0.00"
          keyboardType="decimal-pad"
          inputMode="decimal"
        />
      )}
      <Button
        title="Save"
        size="lg"
        disabled={!name.trim()}
        onPress={() => {
          updateEnvelope(id, {
            name: isDebt ? envelope.name : name.trim(),
            group: isDebt ? envelope.group : group,
          });
          const next = parseMoney(target);
          if (!isDebt && (next ?? null) !== current) setTargetFor(id, month, next);
          haptic('success');
          closeSheet();
        }}
      />
      {!isDebt && (
        <View style={{ gap: spacing.xs + 2 }}>
          <Button
            title={confirmHide ? 'Tap again to hide' : 'Hide envelope'}
            variant="destructive"
            disabled={available !== 0}
            onPress={() => {
              if (!confirmHide) return setConfirmHide(true);
              updateEnvelope(id, { hidden: true });
              closeSheet();
            }}
          />
          <Text variant="footnote" tone="textSecondary" align="center">
            {available !== 0
              ? 'Move its money out before hiding it.'
              : 'It leaves the Budget. Its past transactions stay.'}
          </Text>
        </View>
      )}
    </SheetScreen>
  );
}
