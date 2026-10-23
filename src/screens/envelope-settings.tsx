import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { Field, FieldLabel } from '@/components/field';
import { SheetScreen } from '@/components/screen';
import { Text } from '@/components/text';
import { today } from '@/domain/dates';
import { parseMoney } from '@/domain/money';
import { formatMonth, monthOf, type MonthKey } from '@/domain/months';
import { targetFor } from '@/domain/targets';
import { useLedger } from '@/hooks/use-ledger';
import { DEBT_GROUP, useStore } from '@/store';
import { spacing } from '@/theme';
import { closeSheet } from '@/utils/close-sheet';
import { haptic } from '@/utils/haptics';

export function EnvelopeSettings({ id, month: monthParam }: { id: string; month?: MonthKey }) {
  const month = monthParam ?? monthOf(today());
  const envelope = useStore((s) => s.envelopes.find((e) => e.id === id));
  const envelopes = useStore((s) => s.envelopes);
  const updateEnvelope = useStore((s) => s.updateEnvelope);
  const setTargetFor = useStore((s) => s.setTarget);
  const ledger = useLedger();
  const [name, setName] = useState(envelope?.name ?? '');
  const [group, setGroup] = useState(envelope?.group ?? 'Everyday');
  const current = envelope ? targetFor(envelope, month) : null;
  const [target, setTarget] = useState(current ? (current / 100).toFixed(2) : '');

  if (!envelope) {
    return (
      <SheetScreen>
        <Text variant="title">This envelope is gone</Text>
      </SheetScreen>
    );
  }

  const groups = [...new Set(['Bills', 'Everyday', 'Savings', ...envelopes.map((e) => e.group)])].filter(
    (g) => g !== DEBT_GROUP,
  );
  const available = ledger.available.get(id) ?? 0;
  const isDebt = !!envelope.debtAccountId;

  return (
    <SheetScreen>
      <Text variant="title">Edit envelope</Text>
      <Field label="Name" value={name} onChangeText={setName} editable={!isDebt} />
      {!isDebt && (
        <View style={{ gap: spacing.xs + 2 }}>
          <FieldLabel label="Group" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2 }}>
            {groups.map((g) => (
              <Chip key={g} label={g} selected={g === group} onPress={() => setGroup(g)} />
            ))}
          </View>
        </View>
      )}
      {!isDebt && (
        <Field
          label={`${group === 'Savings' ? 'Put in each month' : 'Monthly target'} from ${formatMonth(month)}`}
          hint="Earlier months keep the target they had."
          optional
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
            title="Hide envelope"
            variant="destructive"
            disabled={available !== 0}
            onPress={() => {
              updateEnvelope(id, { hidden: true });
              closeSheet();
            }}
          />
          {available !== 0 && (
            <Text variant="footnote" tone="textSecondary" align="center">
              Move its money out before hiding it.
            </Text>
          )}
        </View>
      )}
    </SheetScreen>
  );
}
