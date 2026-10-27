import { useRef, useState } from 'react';

import { Button } from '@/components/button';
import { AmountRow, FormCard, InputRow } from '@/components/form';
import type { KeypadFieldHandle } from '@/components/keypad';
import { SheetScreen } from '@/components/screen';
import { today } from '@/domain/dates';
import { parseMoney } from '@/domain/money';
import { monthOf, type MonthKey } from '@/domain/months';
import { useStore } from '@/store';
import { closeSheet } from '@/utils/close-sheet';
import { envelopeEmoji } from '@/utils/envelope-emoji';
import { haptic } from '@/utils/haptics';

import {
  BuilderMonthlyRow,
  defaultTargetDate,
  EmojiHeader,
  GroupPicker,
  TargetDateRow,
  TargetKindRow,
  targetLabel,
} from './envelope-settings';
import { SheetHeader } from '@/components/sheet-header';
import { targetKindOf } from '@/domain/targets';
import type { TargetKind } from '@/domain/types';

export function NewEnvelope({ month: monthParam }: { month?: MonthKey }) {
  const month = monthParam ?? monthOf(today());
  const envelopes = useStore((s) => s.envelopes);
  const addEnvelope = useStore((s) => s.addEnvelope);
  const [name, setName] = useState('');
  const [group, setGroup] = useState<string>('Daily');
  const [target, setTarget] = useState('');
  // Follows the group (Savings is a goal) until picked.
  const [pickedKind, setPickedKind] = useState<TargetKind>();
  const kind = pickedKind ?? targetKindOf({ group });
  const [date, setDate] = useState<MonthKey>(defaultTargetDate(month));
  // Only set once the user picks one; until then the name decides.
  const [emoji, setEmoji] = useState<string>();
  const shown = envelopeEmoji({ name, emoji });
  const targetRef = useRef<KeypadFieldHandle>(null);
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
        <TargetKindRow value={kind} onChange={setPickedKind} />
        <AmountRow
          ref={targetRef}
          label={targetLabel(kind)}
          value={target}
          onChange={setTarget}
          mode="whole"
          placeholder="$0"
        />
        {kind === 'builder' && <TargetDateRow month={month} value={date} onChange={setDate} />}
        {kind === 'builder' && <BuilderMonthlyRow amount={target} date={date} carriedIn={0} month={month} />}
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
            targetKind: kind,
            ...(kind === 'builder' ? { targetDate: date } : {}),
          });
          haptic('success');
          closeSheet();
        }}
      />
    </SheetScreen>
  );
}
