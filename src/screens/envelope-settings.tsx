import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { Dropdown, type DropdownOption } from '@/components/dropdown';
import { Field } from '@/components/field';
import { SheetScreen } from '@/components/screen';
import { Text } from '@/components/text';
import { today } from '@/domain/dates';
import { parseMoney } from '@/domain/money';
import { formatMonth, monthOf, type MonthKey } from '@/domain/months';
import { targetFor } from '@/domain/targets';
import type { Envelope } from '@/domain/types';
import { useLedger } from '@/hooks/use-ledger';
import { DEBT_GROUP, useStore } from '@/store';
import { groupColor, spacing } from '@/theme';
import { closeSheet } from '@/utils/close-sheet';
import { haptic } from '@/utils/haptics';

import { SheetHeader } from '@/components/sheet-header';

const NEW_GROUP = '__new__';
const GROUP_HINT: Record<string, string> = {
  Bills: 'The same amount goes out every month',
  Everyday: 'Money you spend through the month',
  Savings: 'Added each month and left alone',
};

/** Group choice for envelope sheets: the existing groups, then "New group…" which reveals a name field. */
export function GroupPicker({
  envelopes,
  group,
  newGroup,
  onGroup,
  onNewGroup,
}: {
  envelopes: Envelope[];
  /** The chosen group, or NEW_GROUP while typing a new one. */
  group: string;
  newGroup: string;
  onGroup: (group: string) => void;
  onNewGroup: (name: string) => void;
}) {
  const groups = [...new Set(['Bills', 'Everyday', 'Savings', ...envelopes.map((e) => e.group)])].filter(
    (g) => g !== DEBT_GROUP,
  );
  const options: DropdownOption<string>[] = [
    ...groups.map((g) => ({
      value: g,
      label: g,
      dot: groupColor(g),
      description: GROUP_HINT[g],
    })),
    { value: NEW_GROUP, label: 'New group…' },
  ];
  return (
    <>
      <Dropdown label="Group" value={group} options={options} onChange={onGroup} />
      {group === NEW_GROUP && (
        <Field label="Group name" value={newGroup} onChangeText={onNewGroup} placeholder="Kids" autoFocus />
      )}
    </>
  );
}

export function resolveGroup(group: string, newGroup: string): string | null {
  if (group !== NEW_GROUP) return group;
  return newGroup.trim() || null;
}

export function EnvelopeSettings({ id, month: monthParam }: { id: string; month?: MonthKey }) {
  const month = monthParam ?? monthOf(today());
  const envelope = useStore((s) => s.envelopes.find((e) => e.id === id));
  const envelopes = useStore((s) => s.envelopes);
  const updateEnvelope = useStore((s) => s.updateEnvelope);
  const setTargetFor = useStore((s) => s.setTarget);
  const ledger = useLedger();
  const [name, setName] = useState(envelope?.name ?? '');
  const [group, setGroup] = useState(envelope?.group ?? 'Everyday');
  const [newGroup, setNewGroup] = useState('');
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
  const finalGroup = resolveGroup(group, newGroup);

  return (
    <SheetScreen>
      <SheetHeader title="Edit envelope" />
      <Field label="Name" value={name} onChangeText={setName} editable={!isDebt} />
      {!isDebt && (
        <GroupPicker
          envelopes={envelopes}
          group={group}
          newGroup={newGroup}
          onGroup={setGroup}
          onNewGroup={setNewGroup}
        />
      )}
      {!isDebt && (
        <Field
          label={finalGroup === 'Savings' ? 'Put in each month' : 'Monthly target'}
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
        disabled={!name.trim() || !finalGroup}
        onPress={() => {
          updateEnvelope(id, {
            name: isDebt ? envelope.name : name.trim(),
            group: isDebt || !finalGroup ? envelope.group : finalGroup,
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
