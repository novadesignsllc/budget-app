import { useRef, useState } from 'react';

import { Button } from '@/components/button';
import { FormCard, InputRow } from '@/components/form';
import type { KeypadFieldHandle } from '@/components/keypad';
import { SheetScreen } from '@/components/screen';
import { today } from '@/domain/dates';
import { parseMoney } from '@/domain/money';
import { monthOf, type MonthKey } from '@/domain/months';
import { useBudgetMonth } from '@/hooks/use-budget-month';
import { useStore } from '@/store';
import { closeSheet } from '@/utils/close-sheet';
import { envelopeEmoji } from '@/utils/envelope-emoji';
import { haptic } from '@/utils/haptics';

import { defaultTargetDate, EmojiHeader, GroupPicker, TargetAmountRow, TargetExtraRows, TargetKindRow } from './envelope-settings';
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
  const [every, setEvery] = useState(12);
  const income = useBudgetMonth(month).income ?? 0;
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
        <TargetAmountRow ref={targetRef} kind={kind} value={target} onChange={setTarget} />
        <TargetExtraRows
          kind={kind}
          amount={target}
          date={date}
          onDate={setDate}
          every={every}
          onEvery={setEvery}
          carriedIn={0}
          income={income}
          month={month}
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
            targetKind: kind,
            ...(kind === 'builder' || kind === 'repeat' ? { targetDate: date } : {}),
            ...(kind === 'repeat' ? { targetEvery: every } : {}),
          });
          haptic('success');
          closeSheet();
        }}
      />
    </SheetScreen>
  );
}
