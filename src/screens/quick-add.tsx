import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, withTiming, type SharedValue } from 'react-native-reanimated';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { DateField } from '@/components/date-field';
import { Icon } from '@/components/icon';
import { Money } from '@/components/money';
import { SheetScreen } from '@/components/screen';
import { Text } from '@/components/text';
import { useToast } from '@/components/toast';
import { addDays, formatDay, today } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import { parseQuickAdd, type ParsedEntry } from '@/domain/quick-add';
import { isCashAccount, type ISODate } from '@/domain/types';
import { useAccounts } from '@/hooks/use-ledger';
import { useVoiceEntry } from '@/hooks/use-voice-entry';
import { useStore } from '@/store';
import { radius, spacing, type as typeScale, useColors } from '@/theme';
import { closeSheet } from '@/utils/close-sheet';
import { haptic } from '@/utils/haptics';

type Picker = 'envelope' | 'account' | 'date' | null;
type Override = { envelopeId?: string; accountId?: string; date?: ISODate; income?: boolean };

const BARS = [0.45, 0.8, 1, 0.65, 0.9, 0.5, 0.75];

function Bar({ volume, weight, color }: { volume: SharedValue<number>; weight: number; color: string }) {
  const reduceMotion = useReducedMotion();
  const style = useAnimatedStyle(() => ({
    height: reduceMotion ? 18 : withTiming(8 + volume.value * 30 * weight, { duration: 90 }),
  }));
  return <Animated.View style={[{ width: 4, borderRadius: 2, backgroundColor: color }, style]} />;
}

export function QuickAdd({ voice = false }: { voice?: boolean }) {
  const colors = useColors();
  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const [text, setText] = useState('');
  const [mode, setMode] = useState<'voice' | 'type'>(voice ? 'voice' : 'type');
  const [picker, setPicker] = useState<Picker>(null);
  const [override, setOverride] = useState<Override>({});

  const envelopes = useStore((s) => s.envelopes);
  const merchantMemory = useStore((s) => s.merchantMemory);
  const addTransaction = useStore((s) => s.addTransaction);
  const deleteTransaction = useStore((s) => s.deleteTransaction);
  const showToast = useToast((s) => s.show);
  const { all: accounts, cash } = useAccounts();

  const parse = useCallback(
    (input: string) => parseQuickAdd(input, { accounts, envelopes, merchantMemory, today: today() }),
    [accounts, envelopes, merchantMemory],
  );
  const parsed = useMemo(() => parse(text), [parse, text]);

  const resolve = useCallback(
    (p: ParsedEntry, o: Override) => {
      const accountId = o.accountId ?? p.accountId;
      const account = accounts.find((a) => a.id === accountId);
      const isSlip = !!account && !isCashAccount(account);
      const isIncome = o.income ?? p.kind === 'income';
      const envelopeId = isIncome ? null : (o.envelopeId ?? p.envelopeId);
      const envelope = envelopes.find((e) => e.id === envelopeId);
      return {
        account,
        isSlip,
        isIncome,
        envelope,
        date: o.date ?? p.date,
        kind: (isIncome ? 'income' : isSlip ? 'slip' : 'spend') as 'income' | 'slip' | 'spend',
        ready: !!p.amount && !!p.payee && !!account && (isIncome || !!envelope),
      };
    },
    [accounts, envelopes],
  );
  const r = resolve(parsed, override);

  const save = useCallback(
    (p: ParsedEntry, o: Override) => {
      const x = resolve(p, o);
      if (!x.ready || !x.account || !p.amount) {
        if (p.amount && !x.envelope && !x.isIncome) setPicker('envelope');
        return false;
      }
      const id = addTransaction({
        date: x.date,
        accountId: x.account.id,
        amount: p.amount,
        kind: x.kind,
        payee: p.payee,
        envelopeId: x.envelope?.id,
      });
      haptic(x.isSlip ? 'warning' : 'success');
      showToast({
        message: `Added ${p.payee} · ${formatMoney(p.amount)}`,
        actionLabel: 'Undo',
        onAction: () => deleteTransaction(id),
      });
      closeSheet();
      return true;
    },
    [resolve, addTransaction, deleteTransaction, showToast],
  );

  const hints = useMemo(
    () => [...accounts.map((a) => a.name), ...envelopes.map((e) => e.name), ...Object.keys(merchantMemory)],
    [accounts, envelopes, merchantMemory],
  );
  const voiceEntry = useVoiceEntry({
    hints,
    onPartial: setText,
    onFinal: (finalText) => {
      setText(finalText);
      // Said everything we need? Save it. Otherwise drop to the form to finish up.
      if (!save(parse(finalText), override)) setMode('type');
    },
  });

  useEffect(() => {
    if (voice) void voiceEntry.start();
    return () => voiceEntry.abort();
    // Start once when the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const typeInstead = () => {
    voiceEntry.abort();
    setMode('type');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  if (cash.length === 0) {
    return (
      <SheetScreen>
        <Text variant="title">Add an account first</Text>
        <Text variant="body" tone="textSecondary">
          Transactions come out of a checking, savings, or cash account. Add the one your debit card uses.
        </Text>
        <Button title="Add account" onPress={() => router.replace('/new-account')} />
      </SheetScreen>
    );
  }

  const spendable = envelopes
    .filter((e) => !e.hidden && !e.debtAccountId)
    .sort((a, b) => a.group.localeCompare(b.group) || a.order - b.order);

  const saveLabel = !parsed.amount
    ? 'Type an amount'
    : !r.envelope && !r.isIncome
      ? 'Choose an envelope'
      : r.isIncome
        ? `Add ${formatMoney(parsed.amount)} income`
        : `Add ${formatMoney(parsed.amount)} from ${r.envelope!.name}`;

  const preview = (
    <View style={{ backgroundColor: colors.fill, borderRadius: radius.lg, padding: spacing.lg - 2, gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.md }}>
        <Text variant="headline" numberOfLines={1} style={{ flex: 1 }} tone={parsed.payee ? 'text' : 'placeholder'}>
          {parsed.payee || 'Merchant'}
        </Text>
        {parsed.amount ? (
          <Money
            cents={r.isIncome ? parsed.amount : -parsed.amount}
            variant="title"
            weight="700"
            signed
            tone={r.isIncome ? 'positive' : r.isSlip ? 'negative' : 'text'}
          />
        ) : (
          <Text variant="title" tone="placeholder">
            $0.00
          </Text>
        )}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2 }}>
        {!r.isIncome && (
          <Chip
            label={r.envelope?.name ?? 'Envelope'}
            tone={r.envelope ? 'default' : 'muted'}
            selected={picker === 'envelope'}
            onPress={() => setPicker(picker === 'envelope' ? null : 'envelope')}
            accessibilityLabel={`Envelope: ${r.envelope?.name ?? 'none'}`}
          />
        )}
        <Chip
          label={r.account?.name ?? 'Account'}
          tone={r.isSlip ? 'negative' : 'default'}
          selected={picker === 'account'}
          onPress={() => setPicker(picker === 'account' ? null : 'account')}
          accessibilityLabel={`Account: ${r.account?.name ?? 'none'}`}
        />
        <Chip
          label={formatDay(r.date)}
          selected={picker === 'date'}
          onPress={() => setPicker(picker === 'date' ? null : 'date')}
          accessibilityLabel={`Date: ${formatDay(r.date)}`}
        />
        <Chip
          label={r.isIncome ? 'Income' : 'Expense'}
          onPress={() => setOverride((o) => ({ ...o, income: !r.isIncome }))}
          accessibilityLabel={r.isIncome ? 'Income. Tap to make it an expense' : 'Expense. Tap to make it income'}
        />
      </View>
    </View>
  );

  if (mode === 'voice') {
    return (
      <SheetScreen contentContainerStyle={{ gap: spacing.lg }}>
        <View style={{ alignItems: 'center', gap: spacing.md, paddingTop: spacing.sm }}>
          {voiceEntry.error ? (
            <Icon sf="mic.slash" md="mic_off" size={28} color={colors.textSecondary} />
          ) : (
            <View
              accessibilityRole="image"
              accessibilityLabel={voiceEntry.listening ? 'Listening' : 'Starting'}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 40 }}
            >
              {BARS.map((w, i) => (
                <Bar key={i} volume={voiceEntry.volume} weight={w} color={colors.positive} />
              ))}
            </View>
          )}
          <Text variant="callout" tone="textSecondary" align="center">
            {voiceEntry.error || 'Listening. Say the place and the amount.'}
          </Text>
          <Text variant="title" align="center" tone={text ? 'text' : 'placeholder'}>
            {text || 'Best Buy 47.27'}
          </Text>
        </View>
        {text ? preview : null}
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button title="Type instead" variant="secondary" size="lg" style={{ flex: 1 }} onPress={typeInstead} />
          {voiceEntry.error ? (
            <Button title="Try again" size="lg" style={{ flex: 1 }} onPress={() => void voiceEntry.start()} />
          ) : (
            <Button
              title={r.ready && parsed.amount ? `Add ${formatMoney(parsed.amount)}` : 'Done'}
              size="lg"
              style={{ flex: 1 }}
              onPress={() => (r.ready ? (voiceEntry.abort(), save(parsed, override)) : voiceEntry.stop())}
            />
          )}
        </View>
        <Text variant="footnote" tone="textTertiary" align="center">
          It stops when you pause. If everything is filled in, it saves on its own.
        </Text>
      </SheetScreen>
    );
  }

  return (
    <SheetScreen contentContainerStyle={{ gap: spacing.md + 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <TextInput
          ref={inputRef}
          autoFocus={!voice}
          value={text}
          onChangeText={setText}
          placeholder="McDonald’s 10.99"
          placeholderTextColor={colors.placeholder}
          returnKeyType="done"
          submitBehavior="submit"
          onSubmitEditing={() => save(parsed, override)}
          autoCorrect={false}
          accessibilityLabel="Describe the transaction"
          style={[
            typeScale.title,
            {
              flex: 1,
              color: colors.text,
              backgroundColor: colors.fill,
              borderRadius: radius.md,
              borderCurve: 'continuous',
              paddingHorizontal: spacing.lg - 2,
              height: 50,
            },
          ]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Say it instead"
          onPress={() => {
            setMode('voice');
            void voiceEntry.start();
          }}
          style={({ pressed }) => ({
            width: 50,
            height: 50,
            borderRadius: radius.md,
            backgroundColor: colors.fill,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Icon sf="mic.fill" md="mic" size={18} />
        </Pressable>
      </View>

      {preview}

      {parsed.envelopeSource === 'guessed' && !override.envelopeId && r.envelope && !r.isIncome && (
        <Text variant="footnote" tone="textSecondary">
          Guessed from the name. Tap the envelope to change it, and next time it’ll remember.
        </Text>
      )}

      {r.isSlip && (
        <View style={{ backgroundColor: colors.negativeSoft, borderRadius: radius.md, padding: spacing.md + 2, gap: 2 }}>
          <Text variant="headline" tone="negative">
            This goes on {r.account!.name}
          </Text>
          <Text variant="callout" tone="negative">
            Card spending is a slip. It still comes out of the envelope, and the cash gets set aside to pay the card
            back. It’ll be marked red.
          </Text>
        </View>
      )}

      <Button
        title={saveLabel}
        size="lg"
        variant={r.isSlip ? 'destructive' : 'primary'}
        disabled={!parsed.amount}
        onPress={() => save(parsed, override)}
      />

      {picker === 'envelope' && (
        <PickerGrid>
          {spendable.length === 0 && (
            <Text variant="callout" tone="textSecondary">
              No envelopes yet. Make some on the Budget tab.
            </Text>
          )}
          {spendable.map((e) => (
            <Chip
              key={e.id}
              label={e.name}
              selected={e.id === r.envelope?.id}
              onPress={() => {
                setOverride((o) => ({ ...o, envelopeId: e.id }));
                setPicker(null);
              }}
            />
          ))}
        </PickerGrid>
      )}

      {picker === 'account' && (
        <PickerGrid>
          {accounts.map((a) => (
            <Chip
              key={a.id}
              label={a.name}
              selected={a.id === r.account?.id}
              tone={isCashAccount(a) ? 'default' : 'negative'}
              onPress={() => {
                setOverride((o) => ({ ...o, accountId: a.id }));
                setPicker(null);
              }}
            />
          ))}
        </PickerGrid>
      )}

      {picker === 'date' && (
        <View style={{ gap: spacing.md }}>
          <PickerGrid>
            {[0, -1, -2].map((offset) => {
              const d = addDays(today(), offset);
              return (
                <Chip
                  key={d}
                  label={formatDay(d)}
                  selected={d === r.date}
                  onPress={() => {
                    setOverride((o) => ({ ...o, date: d }));
                    setPicker(null);
                  }}
                />
              );
            })}
          </PickerGrid>
          <DateField label="Other date" value={r.date} onChange={(d) => setOverride((o) => ({ ...o, date: d }))} />
        </View>
      )}
    </SheetScreen>
  );
}

function PickerGrid({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2 }}>{children}</View>;
}
