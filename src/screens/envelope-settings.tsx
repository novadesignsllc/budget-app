import { useRef, useState } from 'react';
import { Pressable, Text as RNText, View } from 'react-native';

import { Button } from '@/components/button';
import { Dropdown, type DropdownOption } from '@/components/dropdown';
import { EmojiPicker } from '@/components/emoji-picker';
import { SnoozeRow } from '@/components/snooze-row';
import { ActionList, AmountRow, FormCard, FormRow, InputRow, SegmentRow } from '@/components/form';
import type { KeypadFieldHandle } from '@/components/keypad';
import { SheetScreen } from '@/components/screen';
import { Text } from '@/components/text';
import { today } from '@/domain/dates';
import { parseMoney } from '@/domain/money';
import { monthOf, type MonthKey } from '@/domain/months';
import { targetSetFor, targetKindOf } from '@/domain/targets';
import { GROUPS, type BudgetGroup, type TargetKind } from '@/domain/types';
import { useLedger } from '@/hooks/use-ledger';
import { fixGroup, useStore } from '@/store';
import { router } from 'expo-router';
import { groupColor, spacing, useColors } from '@/theme';
import { closeSheet } from '@/utils/close-sheet';
import { envelopeEmoji } from '@/utils/envelope-emoji';
import { haptic } from '@/utils/haptics';

import { SheetHeader } from '@/components/sheet-header';

/** The groups you can pick. Bills, Subscriptions and Debt payments fill themselves. */
export function GroupPicker({ group, onGroup }: { group: string; onGroup: (group: BudgetGroup) => void }) {
  const options: DropdownOption<BudgetGroup>[] = GROUPS.map((g) => ({
    value: g,
    label: g,
    dot: groupColor(g),
  }));
  return (
    <Dropdown variant="row" label="Group" value={fixGroup(group) as BudgetGroup} options={options} onChange={onGroup} />
  );
}

/** The envelope's emoji, large and centered. Tapping it opens the picker below. */
export function EmojiHeader({ emoji, onChange }: { emoji: string; onChange: (emoji: string) => void }) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: spacing.md }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Emoji ${emoji}. Change emoji`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        style={{ alignItems: 'center', gap: spacing.sm }}
      >
        {({ pressed }) => (
          <>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 18,
                borderCurve: 'continuous',
                borderWidth: 1,
                borderColor: open ? colors.accent : colors.borderStrong,
                backgroundColor: pressed ? colors.control : colors.surface,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <RNText style={{ fontSize: 34, lineHeight: 42 }}>{emoji}</RNText>
            </View>
            <Text variant="footnote" weight="600" tone="accent">
              {open ? 'Done' : 'Change emoji'}
            </Text>
          </>
        )}
      </Pressable>
      {open && <EmojiPicker value={emoji} onChange={onChange} />}
    </View>
  );
}

/** Savings targets are what goes in each month; Bills and Daily targets are the month's budget. */
export function targetLabel(kind: TargetKind) {
  return kind === 'goal' ? 'Each month' : 'Monthly limit';
}

/**
 * Spending: the target is the most to spend each month, and it refills up to that.
 * Goal: the target goes in every month and keeps building.
 */
export function TargetKindRow({ value, onChange }: { value: TargetKind; onChange: (kind: TargetKind) => void }) {
  return (
    <SegmentRow<TargetKind>
      label="Target"
      value={value}
      options={[
        { value: 'spending', label: 'Spending' },
        { value: 'goal', label: 'Goal' },
      ]}
      onChange={onChange}
    />
  );
}

export function EnvelopeSettings({ id, month: monthParam }: { id: string; month?: MonthKey }) {
  const month = monthParam ?? monthOf(today());
  const envelope = useStore((s) => s.envelopes.find((e) => e.id === id));
  const updateEnvelope = useStore((s) => s.updateEnvelope);
  const setTargetFor = useStore((s) => s.setTarget);
  const ledger = useLedger();
  const [name, setName] = useState(envelope?.name ?? '');
  const [group, setGroup] = useState<string>(fixGroup(envelope?.group ?? 'Daily'));
  const targetRef = useRef<KeypadFieldHandle>(null);
  // The target as set, even in a month it's snoozed.
  const current = envelope ? targetSetFor(envelope, month) : null;
  const [target, setTarget] = useState(current ? String(Math.ceil(current / 100)) : '');
  const [confirmHide, setConfirmHide] = useState(false);
  const [kind, setKind] = useState<TargetKind>(envelope ? targetKindOf(envelope) : 'spending');
  // Only set once the user picks one; until then the name decides.
  const [emoji, setEmoji] = useState<string | undefined>(envelope?.emoji);

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
  // Bills and subscriptions belong to their recurring item: same name, same group, deleted together.
  const recurringId = envelope.recurringId;
  const fixed = isDebt || !!recurringId;
  const shown = envelopeEmoji({ name: isDebt ? envelope.name : name, emoji, debtAccountId: envelope.debtAccountId });

  return (
    <SheetScreen>
      <SheetHeader title="Edit envelope" />
      <EmojiHeader emoji={shown} onChange={setEmoji} />
      <FormCard>
        {fixed ? (
          <FormRow label="Name">
            <Text variant="body" weight="500" numberOfLines={1}>
              {envelope.name}
            </Text>
          </FormRow>
        ) : (
          <InputRow
            label="Name"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => targetRef.current?.focus()}
          />
        )}
        {!fixed && <GroupPicker group={group} onGroup={setGroup} />}
        {!fixed && <TargetKindRow value={kind} onChange={setKind} />}
        {!isDebt && (
          <AmountRow
            ref={targetRef}
            label={targetLabel(fixed ? 'spending' : kind)}
            value={target}
            onChange={setTarget}
            mode="whole"
            placeholder="$0"
          />
        )}
      </FormCard>
      {/* The snooze switch saves right away, not with Save. */}
      {!isDebt && targetSetFor(envelope, month) ? (
        <FormCard>
          <SnoozeRow envelope={envelope} month={month} />
        </FormCard>
      ) : null}
      <Button
        title="Save"
        size="lg"
        disabled={!name.trim()}
        onPress={() => {
          updateEnvelope(id, {
            name: fixed ? envelope.name : name.trim(),
            group: fixed ? envelope.group : group,
            ...(emoji && emoji !== envelope.emoji ? { emoji } : {}),
            ...(!fixed && kind !== targetKindOf(envelope) ? { targetKind: kind } : {}),
          });
          const next = parseMoney(target);
          if (!isDebt && (next ?? null) !== current) setTargetFor(id, month, next);
          haptic('success');
          closeSheet();
        }}
      />
      {recurringId && (
        <ActionList
          actions={[
            {
              title: envelope.group === 'Subscriptions' ? 'Edit subscription' : 'Edit bill',
              onPress: () => {
                closeSheet();
                router.push({ pathname: '/edit-recurring', params: { id: recurringId } });
              },
            },
          ]}
        />
      )}
      {!fixed && (
        <ActionList
          actions={[
            {
              title: available !== 0 ? 'Empty it to hide it' : confirmHide ? 'Tap again to hide' : 'Hide envelope',
              tone: 'negative',
              disabled: available !== 0,
              onPress: () => {
                if (!confirmHide) return setConfirmHide(true);
                updateEnvelope(id, { hidden: true });
                closeSheet();
              },
            },
          ]}
        />
      )}
    </SheetScreen>
  );
}
