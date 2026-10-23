import { useRef, useState } from 'react';
import { TextInput } from 'react-native';

import { Button } from '@/components/button';
import { FormCard, InputRow } from '@/components/form';
import { SheetScreen } from '@/components/screen';
import { today } from '@/domain/dates';
import { parseMoney } from '@/domain/money';
import { monthOf, type MonthKey } from '@/domain/months';
import { useStore } from '@/store';
import { closeSheet } from '@/utils/close-sheet';
import { envelopeEmoji } from '@/utils/envelope-emoji';
import { haptic } from '@/utils/haptics';

import { EmojiHeader, GroupPicker, targetLabel } from './envelope-settings';
import { SheetHeader } from '@/components/sheet-header';

export function NewEnvelope({ month: monthParam }: { month?: MonthKey }) {
  const month = monthParam ?? monthOf(today());
  const envelopes = useStore((s) => s.envelopes);
  const addEnvelope = useStore((s) => s.addEnvelope);
  const [name, setName] = useState('');
  const [group, setGroup] = useState<string>('Daily');
  const [target, setTarget] = useState('');
  // Only set once the user picks one; until then the name decides.
  const [emoji, setEmoji] = useState<string>();
  const shown = envelopeEmoji({ name, emoji });
  const targetRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const duplicate = envelopes.some((e) => e.name.toLowerCase() === name.trim().toLowerCase() && !e.hidden);

  return (
    <SheetScreen>
      <SheetHeader title="New envelope" />
      <EmojiHeader emoji={shown} onChange={setEmoji} />
      <FormCard>
        <InputRow
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="Groceries"
          autoFocus
          autoCapitalize="words"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => targetRef.current?.focus()}
        />
        <GroupPicker group={group} onGroup={setGroup} />
        <InputRow
          ref={targetRef}
          label={targetLabel(group)}
          value={target}
          onChangeText={setTarget}
          placeholder="0.00"
          keyboardType="decimal-pad"
          inputMode="decimal"
          returnKeyType="done"
        />
      </FormCard>
      <Button
        title={duplicate ? 'You already have this envelope' : 'Create envelope'}
        size="lg"
        disabled={!name.trim() || duplicate}
        onPress={() => {
          addEnvelope({
            name,
            group,
            monthlyTarget: parseMoney(target) ?? undefined,
            month,
            emoji,
          });
          haptic('success');
          closeSheet();
        }}
      />
    </SheetScreen>
  );
}
