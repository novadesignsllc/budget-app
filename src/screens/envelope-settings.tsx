import { useRef, useState } from 'react';
import { Pressable, Text as RNText, View } from 'react-native';

import { Button } from '@/components/button';
import { Dropdown, type DropdownOption } from '@/components/dropdown';
import { EmojiPicker } from '@/components/emoji-picker';
import { SnoozeRow } from '@/components/snooze-row';
import { ActionList, AmountRow, FormCard, FormRow, InputRow } from '@/components/form';
import type { KeypadFieldHandle } from '@/components/keypad';
import { SheetScreen } from '@/components/screen';
import { Text } from '@/components/text';
import { today } from '@/domain/dates';
import { ceilDollars, formatDollars, parseMoney } from '@/domain/money';
import { addMonthKey, monthOf, type MonthKey } from '@/domain/months';
import { builderMonthly, monthsThrough, TARGET_KINDS, targetKindOf, targetSetFor } from '@/domain/targets';
import { useBudgetMonth } from '@/hooks/use-budget-month';
import { monthName } from '@/utils/envelope-status';
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

/** What the target amount is called for each type. */
export function targetLabel(kind: TargetKind) {
  return kind === 'goal' ? 'Each month' : kind === 'bank' ? 'Keep in it' : kind === 'builder' ? 'Amount' : 'Monthly max';
}

/** Maximum, Bank, Builder or Save each month. */
export function TargetKindRow({ value, onChange }: { value: TargetKind; onChange: (kind: TargetKind) => void }) {
  return (
    <Dropdown<TargetKind>
      variant="row"
      label="Target"
      value={value}
      options={TARGET_KINDS.map((k) => ({ value: k.kind, label: k.name, description: k.description }))}
      onChange={onChange}
    />
  );
}

/** A builder starts out aiming six months ahead. */
export function defaultTargetDate(month: MonthKey): MonthKey {
  return addMonthKey(month, 6);
}

/** Builder: the month to reach the amount by, from this month to five years out. */
export function TargetDateRow({ month, value, onChange }: { month: MonthKey; value: MonthKey; onChange: (m: MonthKey) => void }) {
  const first = value < month ? value : month;
  const options = Array.from({ length: Math.max(60, monthsThrough(first, value)) }, (_, i) => {
    const m = addMonthKey(first, i);
    return { value: m, label: monthName(m) };
  });
  return <Dropdown<MonthKey> variant="row" label="By" value={value} options={options} onChange={onChange} />;
}

/** Builder: what that works out to this month, as the amount and date change. */
export function BuilderMonthlyRow({
  amount,
  date,
  carriedIn,
  month,
}: {
  amount: string;
  date: MonthKey;
  carriedIn: number;
  month: MonthKey;
}) {
  const target = parseMoney(amount) ?? 0;
  const monthly = builderMonthly({ targetDate: date }, ceilDollars(target), carriedIn, month);
  return (
    <FormRow label="This month">
      <Text variant="body" weight="600" tone={target ? 'text' : 'textTertiary'} style={{ fontVariant: ['tabular-nums'] }}>
        {target ? formatDollars(monthly) : '—'}
      </Text>
    </FormRow>
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
  const [date, setDate] = useState<MonthKey>(envelope?.targetDate ?? defaultTargetDate(month));
  const carriedIn = useBudgetMonth(month).envelopes.get(id)?.carriedIn ?? 0;
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
        {!fixed && kind === 'builder' && <TargetDateRow month={month} value={date} onChange={setDate} />}
        {!fixed && kind === 'builder' && (
          <BuilderMonthlyRow amount={target} date={date} carriedIn={carriedIn} month={month} />
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
            ...(!fixed && kind === 'builder' && date !== envelope.targetDate ? { targetDate: date } : {}),
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
