import { useRef, useState } from 'react';
import { TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { SheetScreen } from '@/components/screen';
import { today } from '@/domain/dates';
import { parseMoney } from '@/domain/money';
import { formatMonth, monthOf, type MonthKey } from '@/domain/months';
import { useStore } from '@/store';
import { spacing } from '@/theme';
import { closeSheet } from '@/utils/close-sheet';
import { envelopeEmoji } from '@/utils/envelope-emoji';
import { haptic } from '@/utils/haptics';

import { EmojiField, EmojiPreview, GroupPicker, targetLabel } from './envelope-settings';
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
      <View style={{ flexDirection: 'row', alignItems: duplicate ? 'center' : 'flex-end', gap: spacing.md }}>
        <EmojiPreview emoji={shown} />
        <View style={{ flex: 1 }}>
          <Field
            label="Name"
            value={name}
            onChangeText={setName}
            placeholder="Groceries"
            autoFocus
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => targetRef.current?.focus()}
            error={duplicate ? 'You already have an envelope with this name.' : undefined}
          />
        </View>
      </View>
      <EmojiField value={shown} onChange={setEmoji} />
      <GroupPicker group={group} onGroup={setGroup} />
      <Field
        ref={targetRef}
        label={targetLabel(group)}
        optional
        note={`applies from ${formatMonth(month)} on`}
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
