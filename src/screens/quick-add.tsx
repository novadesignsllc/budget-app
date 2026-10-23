import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Switch, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, withTiming, type SharedValue } from 'react-native-reanimated';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { DateRow } from '@/components/date-picker';
import { Dropdown, type DropdownOption } from '@/components/dropdown';
import { Icon } from '@/components/icon';
import { Money } from '@/components/money';
import { SheetScreen } from '@/components/screen';
import { Text } from '@/components/text';
import { useToast } from '@/components/toast';
import { today } from '@/domain/dates';
import { formatDollars, formatMoney } from '@/domain/money';
import { findPayee, payeeMemory } from '@/domain/payees';
import { parseQuickAdd, type ParsedEntry } from '@/domain/quick-add';
import { isCashAccount, type ISODate } from '@/domain/types';
import { useAccounts, useLedger } from '@/hooks/use-ledger';
import { useVoiceEntry } from '@/hooks/use-voice-entry';
import { SheetHeader } from '@/components/sheet-header';
import { useStore } from '@/store';
import { groupColor, radius, spacing, type as typeScale, useColors } from '@/theme';
import { closeSheet } from '@/utils/close-sheet';
import { orderGroups } from '@/utils/group-order';
import { haptic } from '@/utils/haptics';
import { dismissKeyboard } from '@/utils/keyboard';

type Override = { envelopeId?: string; accountId?: string; date?: ISODate; income?: boolean };

const BARS = [0.45, 0.8, 1, 0.65, 0.9, 0.5, 0.75];
const ROW_HEIGHT = 40;

function Bar({ volume, weight, color }: { volume: SharedValue<number>; weight: number; color: string }) {
  const reduceMotion = useReducedMotion();
  const style = useAnimatedStyle(() => ({
    height: reduceMotion ? 18 : withTiming(8 + volume.value * 30 * weight, { duration: 90 }),
  }));
  return <Animated.View style={[{ width: 4, borderRadius: 2, backgroundColor: color }, style]} />;
}

/** A plain row in the details card: label on the left, a control on the right. */
function DetailRow({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  const colors = useColors();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: ROW_HEIGHT,
        paddingHorizontal: spacing.md,
        gap: spacing.sm,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: 'rgba(20,40,80,0.07)',
        backgroundColor: colors.surface,
      }}
    >
      <Text variant="body" tone="textSecondary" style={{ flex: 1 }}>
        {label}
      </Text>
      {children}
    </View>
  );
}

/** Wraps a dropdown row with the card's row divider. */
function Divided({ children, last }: { children: React.ReactNode; last?: boolean }) {
  return (
    <View style={{ borderBottomWidth: last ? 0 : 1, borderBottomColor: 'rgba(20,40,80,0.07)' }}>{children}</View>
  );
}

export function QuickAdd({ voice = false }: { voice?: boolean }) {
  const colors = useColors();
  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const [mode, setMode] = useState<'voice' | 'type'>(voice ? 'voice' : 'type');
  const [override, setOverride] = useState<Override>({});
  const [note, setNote] = useState('');
  const [flagged, setFlagged] = useState(false);

  const ledger = useLedger();
  const envelopes = useStore((s) => s.envelopes);
  const payees = useStore((s) => s.payees);
  const legacyMemory = useStore((s) => s.merchantMemory);
  // Payees are the memory now; the old map only matters until it's migrated.
  const merchantMemory = useMemo(
    () => (payees.length ? payeeMemory(payees) : legacyMemory),
    [payees, legacyMemory],
  );
  const addTransaction = useStore((s) => s.addTransaction);
  const deleteTransaction = useStore((s) => s.deleteTransaction);
  const setFlag = useStore((s) => s.setFlag);
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
      if (!x.ready || !x.account || !p.amount) return false;
      const id = addTransaction({
        date: x.date,
        accountId: x.account.id,
        amount: p.amount,
        kind: x.kind,
        payee: p.payee,
        envelopeId: x.envelope?.id,
        memo: note.trim() || undefined,
      });
      if (flagged) setFlag(id, true);
      haptic(x.isSlip ? 'warning' : 'success');
      showToast({
        message: `Added ${p.payee} · ${formatMoney(p.amount)}`,
        actionLabel: 'Undo',
        onAction: () => deleteTransaction(id),
      });
      closeSheet();
      return true;
    },
    [resolve, addTransaction, deleteTransaction, setFlag, showToast, note, flagged],
  );

  const hints = useMemo(
    () => [...accounts.map((a) => a.name), ...envelopes.map((e) => e.name), ...payees.map((p) => p.name)],
    [accounts, envelopes, payees],
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

  // Envelopes listed in the Budget's group order.

  const groupOrder = useStore((s) => s.settings.groupOrder);

  const listedGroups = useMemo(

    () => orderGroups(

      envelopes.map((e) => e.group),

      groupOrder,

    ),

    [envelopes, groupOrder],

  );

  const envelopeOptions = useMemo<DropdownOption<string>[]>(
    () =>
      envelopes
        .filter((e) => !e.hidden && !e.debtAccountId)
        .sort((a, b) => listedGroups.indexOf(a.group) - listedGroups.indexOf(b.group) || a.order - b.order)
        .map((e) => {
          const left = ledger.available.get(e.id) ?? 0;
          return {
            value: e.id,
            label: e.name,
            dot: groupColor(e.group),
            section: e.group,
            detail: left < 0 ? formatDollars(left) : `${formatDollars(left)} left`,
            tone: left < 0 ? 'negative' : undefined,
          };
        }),
    [envelopes, ledger, listedGroups],
  );

  const accountOptions = useMemo<DropdownOption<string>[]>(
    () => [
      ...accounts.filter(isCashAccount).map((a) => ({
        value: a.id,
        label: a.name,
        face: a.order,
        section: 'Accounts',
        detail: formatMoney(ledger.balance.get(a.id) ?? 0),
      })),
      ...accounts
        .filter((a) => !isCashAccount(a))
        .map((a) => ({
          value: a.id,
          label: a.name,
          face: a.order,
          section: 'Cards · logged as a slip',
          tone: 'negative' as const,
        })),
    ],
    [accounts, ledger],
  );

  if (cash.length === 0) {
    return (
      <SheetScreen>
        <SheetHeader title="Add an account first" />
        <Text variant="body" tone="textSecondary" align="center">
          Transactions come out of a checking, savings, or cash account. Add the one your debit card uses.
        </Text>
        <Button title="Add account" size="lg" onPress={() => router.replace('/new-account')} />
      </SheetScreen>
    );
  }

  const day = today();

  const knownPayee = parsed.payee ? findPayee(payees, parsed.payee) : undefined;
  const hint = r.isIncome
    ? 'Income goes to Ready to assign.'
    : override.envelopeId
      ? null
      : knownPayee?.envelopeId && r.envelope
        ? `${knownPayee.name} is set to ${r.envelope.name} in your payee list.`
        : parsed.envelopeSource === 'guessed' && r.envelope
          ? 'Guessed from the name. Change it and next time it’ll remember.'
          : null;

  const saveLabel = !parsed.amount
    ? 'Type an amount'
    : !r.envelope && !r.isIncome
      ? 'Choose an envelope'
      : r.isIncome
        ? `Add ${formatMoney(parsed.amount)} income`
        : `Add ${formatMoney(parsed.amount)} from ${r.envelope!.name}`;

  const summary = (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.md, paddingHorizontal: 2 }}>
      <Text variant="section" numberOfLines={1} style={{ flex: 1 }} tone={parsed.payee ? (r.isSlip ? 'negative' : 'text') : 'placeholder'}>
        {parsed.payee || 'Payee'}
      </Text>
      {parsed.amount ? (
        <Money
          cents={r.isIncome ? parsed.amount : -parsed.amount}
          variant="number"
          signed
          tone={r.isIncome ? 'positive' : r.isSlip ? 'negative' : 'text'}
        />
      ) : (
        <Text variant="number" tone="placeholder">
          $0.00
        </Text>
      )}
    </View>
  );

  const details = (
    <Card style={{ borderRadius: radius.menu }}>
      {!r.isIncome && (
        <Divided>
          <Dropdown
            variant="row"
            label="Envelope"
            placeholder="Choose"
            searchable
            value={r.envelope?.id}
            options={envelopeOptions}
            onChange={(v) => setOverride((o) => ({ ...o, envelopeId: v }))}
          />
        </Divided>
      )}
      <Divided>
        <Dropdown
          variant="row"
          label="Account"
          value={r.account?.id}
          options={accountOptions}
          onChange={(v) => setOverride((o) => ({ ...o, accountId: v }))}
        />
      </Divided>
      <DateRow label="Date" value={r.date} max={day} onChange={(d) => setOverride((o) => ({ ...o, date: d }))} />
      <Divided>
        <Dropdown<'out' | 'in'>
          variant="row"
          label="Outflow or inflow"
          value={r.isIncome ? 'in' : 'out'}
          options={[
            { value: 'out', label: 'Outflow', description: 'Spending, out of an envelope' },
            { value: 'in', label: 'Inflow', description: 'Income, into Ready to assign' },
          ]}
          onChange={(v) => setOverride((o) => ({ ...o, income: v === 'in' }))}
        />
      </Divided>
      <DetailRow label="Note">
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Optional"
          placeholderTextColor={colors.placeholder}
          accessibilityLabel="Note"
          returnKeyType="done"
          style={[typeScale.body, { flex: 1.4, height: ROW_HEIGHT, textAlign: 'right', color: colors.text }]}
        />
      </DetailRow>
      <DetailRow label="Flag for later" last>
        <Switch
          value={flagged}
          onValueChange={(v) => {
            haptic('selection');
            dismissKeyboard();
            setFlagged(v);
          }}
          trackColor={{ false: colors.fillPressed, true: colors.orange }}
          thumbColor="#FFFFFF"
          accessibilityLabel="Flag for later"
          style={{ transform: [{ scale: 0.8 }] }}
        />
      </DetailRow>
    </Card>
  );

  const slipWarning = r.isSlip && (
    <Card tone="slip" style={{ paddingHorizontal: spacing.md + 2, paddingVertical: spacing.md - 1, gap: 2 }}>
      <Text variant="headline" tone="negative">
        This goes on {r.account!.name}
      </Text>
      <Text variant="callout" tone="negative">
        Card spending is a slip. It still comes out of the envelope, and the cash gets set aside to pay the card back.
        It’ll be marked red.
      </Text>
    </Card>
  );

  if (mode === 'voice') {
    return (
      <SheetScreen contentContainerStyle={{ gap: spacing.md + 2 }}>
        <SheetHeader title="New transaction" onClose={() => (voiceEntry.abort(), closeSheet())} />
        <View style={{ alignItems: 'center', gap: spacing.md, paddingTop: spacing.xs }}>
          {voiceEntry.error ? (
            <Icon sf="mic.slash" md="mic_off" size={28} color={colors.textSecondary} />
          ) : (
            <View
              accessibilityRole="image"
              accessibilityLabel={voiceEntry.listening ? 'Listening' : 'Starting'}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 40 }}
            >
              {BARS.map((w, i) => (
                <Bar key={i} volume={voiceEntry.volume} weight={w} color={colors.accent} />
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
        {text ? (
          <>
            {summary}
            {details}
            {slipWarning}
          </>
        ) : null}
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
      </SheetScreen>
    );
  }

  return (
    <SheetScreen contentContainerStyle={{ gap: spacing.md }}>
      <SheetHeader title="New transaction" />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <TextInput
          ref={inputRef}
          autoFocus={!voice}
          value={text}
          onChangeText={setText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="McDonald’s 10.99"
          placeholderTextColor={colors.placeholder}
          returnKeyType="done"
          submitBehavior="submit"
          onSubmitEditing={() => save(parsed, override)}
          autoCorrect={false}
          accessibilityLabel="Describe the transaction"
          style={[
            typeScale.body,
            {
              flex: 1,
              fontSize: 16,
              fontWeight: '600',
              color: colors.text,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: focused ? colors.accent : colors.borderStrong,
              borderRadius: radius.control,
              borderCurve: 'continuous',
              paddingHorizontal: spacing.md,
              height: 46,
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
            width: 46,
            height: 46,
            borderRadius: radius.control,
            borderCurve: 'continuous',
            borderWidth: 1,
            borderColor: colors.borderStrong,
            backgroundColor: pressed ? colors.control : colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
          })}
        >
          <Icon sf="mic" md="mic" size={17} color={colors.text} />
        </Pressable>
      </View>

      {summary}
      {details}
      {slipWarning}

      {hint && (
        <Text variant="footnote" tone="textSecondary" align="center">
          {hint}
        </Text>
      )}

      <Button
        title={saveLabel}
        size="lg"
        variant={r.isSlip ? 'destructive' : 'primary'}
        disabled={!r.ready}
        onPress={() => save(parsed, override)}
      />
    </SheetScreen>
  );
}
