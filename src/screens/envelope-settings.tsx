import { useRef, useState } from 'react';
import { Pressable, Text as RNText, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Dropdown, type DropdownOption } from '@/components/dropdown';
import { EmojiPicker } from '@/components/emoji-picker';
import { ActionList, FormCard, FormRow, InputRow } from '@/components/form';
import { SheetScreen } from '@/components/screen';
import { Text } from '@/components/text';
import { today } from '@/domain/dates';
import { parseMoney } from '@/domain/money';
import { monthOf, type MonthKey } from '@/domain/months';
import { targetFor } from '@/domain/targets';
import { GROUPS, type BudgetGroup } from '@/domain/types';
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
  const [target, setTarget] = useState(current ? String(Math.ceil(current / 100)) : '');
  const [confirmHide, setConfirmHide] = useState(false);
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
        {!isDebt && (
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
        )}
      </FormCard>
      <Button
        title="Save"
        size="lg"
        disabled={!name.trim()}
        onPress={() => {
          updateEnvelope(id, {
            name: fixed ? envelope.name : name.trim(),
            group: fixed ? envelope.group : group,
            ...(emoji && emoji !== envelope.emoji ? { emoji } : {}),
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
