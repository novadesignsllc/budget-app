import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { Field } from '@/components/field';
import { SheetScreen } from '@/components/screen';
import { Text } from '@/components/text';
import { parseMoney } from '@/domain/money';
import { DEBT_GROUP, useStore } from '@/store';
import { spacing } from '@/theme';
import { closeSheet } from '@/utils/close-sheet';
import { haptic } from '@/utils/haptics';

export function NewEnvelope() {
  const envelopes = useStore((s) => s.envelopes);
  const addEnvelope = useStore((s) => s.addEnvelope);
  const groups = [...new Set(['Bills', 'Everyday', 'Savings', ...envelopes.map((e) => e.group)])].filter(
    (g) => g !== DEBT_GROUP,
  );
  const [name, setName] = useState('');
  const [group, setGroup] = useState('Everyday');
  const [newGroup, setNewGroup] = useState('');
  const [target, setTarget] = useState('');

  const finalGroup = newGroup.trim() || group;
  const duplicate = envelopes.some((e) => e.name.toLowerCase() === name.trim().toLowerCase() && !e.hidden);

  return (
    <SheetScreen>
      <Text variant="title">New envelope</Text>
      <Field
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder="Groceries"
        autoFocus
        error={duplicate ? 'You already have an envelope with this name.' : undefined}
      />
      <View style={{ gap: spacing.sm }}>
        <Text variant="footnote" weight="500" tone="textSecondary" style={{ paddingHorizontal: spacing.xs }}>
          Group
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {groups.map((g) => (
            <Chip key={g} label={g} selected={!newGroup && g === group} onPress={() => { setGroup(g); setNewGroup(''); }} />
          ))}
        </View>
        <Field label="Or a new group" value={newGroup} onChangeText={setNewGroup} placeholder="Kids" />
      </View>
      <Field
        label="Monthly target"
        hint="Optional."
        value={target}
        onChangeText={setTarget}
        placeholder="0.00"
        keyboardType="decimal-pad"
        inputMode="decimal"
      />
      <Button
        title="Create envelope"
        size="lg"
        disabled={!name.trim() || duplicate}
        onPress={() => {
          addEnvelope({ name, group: finalGroup, monthlyTarget: parseMoney(target) ?? undefined });
          haptic('success');
          closeSheet();
        }}
      />
    </SheetScreen>
  );
}
