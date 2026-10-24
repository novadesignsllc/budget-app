import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TextInput, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { DateRow, formatPickedDate } from "@/components/date-picker";
import { Dropdown, type DropdownOption } from "@/components/dropdown";
import {
  amountInputProps,
  FlagRow,
  FormCard,
  FormRow,
  InputRow,
  SegmentRow,
} from "@/components/form";
import { Icon } from "@/components/icon";
import { SheetScreen } from "@/components/screen";
import { Text } from "@/components/text";
import { useToast } from "@/components/toast";
import { today } from "@/domain/dates";
import { formatDollars, formatMoney, parseMoney } from "@/domain/money";
import { payeeMemory } from "@/domain/payees";
import {
  draftFromFields,
  parseQuickAdd,
  type ParsedEntry,
} from "@/domain/quick-add";
import { isCashAccount, type FlagColor, type ISODate } from "@/domain/types";
import { useAccounts, useLedger } from "@/hooks/use-ledger";
import { useVoiceEntry } from "@/hooks/use-voice-entry";
import { SheetHeader } from "@/components/sheet-header";
import { useStore } from "@/store";
import {
  flagHues,
  groupColor,
  spacing,
  type as typeScale,
  useColors,
} from "@/theme";
import { closeSheet } from "@/utils/close-sheet";
import { orderGroups } from "@/utils/group-order";
import { haptic } from "@/utils/haptics";

type Override = {
  envelopeId?: string;
  accountId?: string;
  date?: ISODate;
  income?: boolean;
};

const BARS = [0.45, 0.8, 1, 0.65, 0.9, 0.5, 0.75];

function Bar({
  volume,
  weight,
  color,
}: {
  volume: SharedValue<number>;
  weight: number;
  color: string;
}) {
  const reduceMotion = useReducedMotion();
  const style = useAnimatedStyle(() => ({
    height: reduceMotion
      ? 18
      : withTiming(8 + volume.value * 30 * weight, { duration: 90 }),
  }));
  return (
    <Animated.View
      style={[{ width: 4, borderRadius: 2, backgroundColor: color }, style]}
    />
  );
}

export function QuickAdd({ voice = false }: { voice?: boolean }) {
  const colors = useColors();
  const nameRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const amountRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  // What dictation heard, in voice mode. Typing uses the two fields instead.
  const [text, setText] = useState("");
  const [payee, setPayee] = useState("");
  const [amountText, setAmountText] = useState("");
  const [mode, setMode] = useState<"voice" | "type">(voice ? "voice" : "type");
  const [override, setOverride] = useState<Override>({});
  const [note, setNote] = useState("");
  const [flag, setFlagColor] = useState<FlagColor | null>(null);

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

  const ctx = useMemo(
    () => ({ accounts, envelopes, merchantMemory, today: today() }),
    [accounts, envelopes, merchantMemory],
  );
  const parse = useCallback(
    (input: string) => parseQuickAdd(input, { ...ctx, spoken: true }),
    [ctx],
  );
  const parsed = useMemo(
    () =>
      mode === "voice"
        ? parse(text)
        : draftFromFields(payee, parseMoney(amountText), ctx),
    [mode, parse, text, payee, amountText, ctx],
  );

  const resolve = useCallback(
    (p: ParsedEntry, o: Override) => {
      const accountId = o.accountId ?? p.accountId;
      const account = accounts.find((a) => a.id === accountId);
      const isSlip = !!account && !isCashAccount(account);
      const isIncome = o.income ?? p.kind === "income";
      const envelopeId = isIncome ? null : (o.envelopeId ?? p.envelopeId);
      const envelope = envelopes.find((e) => e.id === envelopeId);
      return {
        account,
        isSlip,
        isIncome,
        envelope,
        date: o.date ?? p.date,
        kind: (isIncome ? "income" : isSlip ? "slip" : "spend") as
          "income" | "slip" | "spend",
        ready: !!p.amount && !!p.payee && !!account && (isIncome || !!envelope),
      };
    },
    [accounts, envelopes],
  );
  const r = resolve(parsed, override);

  const save = useCallback(
    (
      p: ParsedEntry,
      o: Override,
      extras: { memo?: string; flag?: FlagColor | null } = { memo: note, flag },
    ) => {
      const x = resolve(p, o);
      if (!x.ready || !x.account || !p.amount) return false;
      const id = addTransaction({
        date: x.date,
        accountId: x.account.id,
        amount: p.amount,
        kind: x.kind,
        payee: p.payee,
        envelopeId: x.envelope?.id,
        memo: extras.memo?.trim() || undefined,
      });
      if (extras.flag) setFlag(id, extras.flag);
      haptic(x.isSlip ? "warning" : "success");
      showToast({
        message: `Added ${p.payee} · ${formatMoney(p.amount)}`,
        actionLabel: "Undo",
        onAction: () => deleteTransaction(id),
      });
      closeSheet();
      return true;
    },
    [
      resolve,
      addTransaction,
      deleteTransaction,
      setFlag,
      showToast,
      note,
      flag,
    ],
  );

  const hints = useMemo(
    () => [
      ...accounts.map((a) => a.name),
      ...envelopes.map((e) => e.name),
      ...payees.map((p) => p.name),
    ],
    [accounts, envelopes, payees],
  );
  const voiceEntry = useVoiceEntry({
    hints,
    onPartial: setText,
    onFinal: (finalText) => {
      setText(finalText);
      // Said everything we need? Save it. Otherwise fill the form with what was heard.
      const heard = parse(finalText);
      if (!save(heard, override, { memo: heard.memo, flag: heard.flagColor }))
        fillFrom(heard);
    },
  });

  useEffect(() => {
    if (voice) void voiceEntry.start();
    return () => voiceEntry.abort();
    // Start once when the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Moves what dictation heard into the typed fields, keeping any picks already made. */
  function fillFrom(heard: ParsedEntry) {
    setPayee(heard.payee);
    setAmountText(heard.amount ? (heard.amount / 100).toFixed(2) : "");
    if (heard.memo) setNote(heard.memo);
    if (heard.flagColor) setFlagColor(heard.flagColor);
    setOverride((o) => ({
      envelopeId: heard.envelopeId ?? undefined,
      accountId: heard.accountMentioned
        ? (heard.accountId ?? undefined)
        : undefined,
      date: heard.date,
      income: heard.kind === "income" ? true : undefined,
      ...o,
    }));
    setMode("type");
    setTimeout(() => (heard.payee ? amountRef : nameRef).current?.focus(), 50);
  }

  const typeInstead = () => {
    voiceEntry.abort();
    if (text) fillFrom(parse(text));
    else {
      setMode("type");
      setTimeout(() => nameRef.current?.focus(), 50);
    }
  };

  // Envelopes listed in the Budget's group order.
  const groupOrder = useStore((s) => s.settings.groupOrder);

  const listedGroups = useMemo(
    () =>
      orderGroups(
        envelopes.map((e) => e.group),
        groupOrder,
      ),
    [envelopes, groupOrder],
  );

  const envelopeOptions = useMemo<DropdownOption<string>[]>(
    () =>
      envelopes
        .filter((e) => !e.hidden && !e.debtAccountId)
        .sort(
          (a, b) =>
            listedGroups.indexOf(a.group) - listedGroups.indexOf(b.group) ||
            a.order - b.order,
        )
        .map((e) => {
          const left = ledger.available.get(e.id) ?? 0;
          return {
            value: e.id,
            label: e.name,
            dot: groupColor(e.group),
            section: e.group,
            detail:
              left < 0 ? formatDollars(left) : `${formatDollars(left)} left`,
            tone: left < 0 ? "negative" : undefined,
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
        section: "Accounts",
        detail: formatMoney(ledger.balance.get(a.id) ?? 0),
      })),
      ...accounts
        .filter((a) => !isCashAccount(a))
        .map((a) => ({
          value: a.id,
          label: a.name,
          face: a.order,
          section: "Cards",
          tone: "negative" as const,
        })),
    ],
    [accounts, ledger],
  );

  if (cash.length === 0) {
    return (
      <SheetScreen>
        <SheetHeader title="Add an account first" />
        <Text variant="body" tone="textSecondary" align="center">
          Transactions come out of a checking, savings, or cash account. Add the
          one your debit card uses.
        </Text>
        <Button
          title="Add account"
          size="lg"
          onPress={() => router.replace("/new-account")}
        />
      </SheetScreen>
    );
  }

  const day = today();

  const saveLabel = !parsed.payee
    ? "Add a name"
    : !parsed.amount
      ? "Type an amount"
      : !r.envelope && !r.isIncome
        ? "Choose an envelope"
        : r.isIncome
          ? `Add ${formatMoney(parsed.amount)} income`
          : `Add ${formatMoney(parsed.amount)} from ${r.envelope!.name}`;

  const details = (
    <FormCard>
      <SegmentRow<"out" | "in">
        label="Type"
        value={r.isIncome ? "in" : "out"}
        options={[
          { value: "out", label: "Outflow" },
          { value: "in", label: "Inflow", tone: "positive" },
        ]}
        onChange={(v) => setOverride((o) => ({ ...o, income: v === "in" }))}
      />
      {!r.isIncome && (
        <Dropdown
          variant="row"
          label="Envelope"
          placeholder="Choose"
          searchable
          value={r.envelope?.id}
          options={envelopeOptions}
          onChange={(v) => setOverride((o) => ({ ...o, envelopeId: v }))}
        />
      )}
      <Dropdown
        variant="row"
        label="Account"
        value={r.account?.id}
        options={accountOptions}
        onChange={(v) => setOverride((o) => ({ ...o, accountId: v }))}
      />
      <DateRow
        label="Date"
        value={r.date}
        max={day}
        onChange={(d) => setOverride((o) => ({ ...o, date: d }))}
        last
      />
      <InputRow
        label="Note"
        value={note}
        onChangeText={setNote}
        placeholder="Add a note"
        returnKeyType="done"
      />
      <FlagRow value={flag} onChange={setFlagColor} />
    </FormCard>
  );

  const slipWarning = r.isSlip && (
    <Card
      tone="slip"
      style={{
        paddingHorizontal: spacing.md + 2,
        paddingVertical: spacing.md - 1,
        gap: 2,
      }}
    >
      <Text variant="headline" tone="negative">
        This goes on {r.account!.name}
      </Text>
    </Card>
  );

  if (mode === "voice") {
    // Dictation only: what it understood fills in as you talk, nothing to tap. If it
    // can't save what it heard, the typed form opens with everything filled in.
    const heardSomething = !!text;
    const amountTone = r.isIncome ? "positive" : r.isSlip ? "negative" : "text";
    return (
      <SheetScreen contentContainerStyle={{ gap: spacing.md + 2 }}>
        <SheetHeader
          title="New transaction"
          onClose={() => (voiceEntry.abort(), closeSheet())}
        />
        <View
          style={{
            alignItems: "center",
            gap: spacing.sm,
            paddingTop: spacing.xs,
          }}
        >
          {voiceEntry.error ? (
            <Icon
              sf="mic.slash"
              md="mic_off"
              size={28}
              color={colors.textSecondary}
            />
          ) : (
            <View
              accessibilityRole="image"
              accessibilityLabel={
                voiceEntry.listening ? "Listening" : "Starting"
              }
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                height: 40,
              }}
            >
              {BARS.map((w, i) => (
                <Bar
                  key={i}
                  volume={voiceEntry.volume}
                  weight={w}
                  color={colors.accent}
                />
              ))}
            </View>
          )}
          {voiceEntry.error ? (
            <Text variant="callout" tone="textSecondary" align="center">
              {voiceEntry.error}
            </Text>
          ) : null}
          {voiceEntry.error && !heardSomething ? null : (
            <>
              <Text
                variant="title"
                align="center"
                tone={parsed.payee ? "text" : "placeholder"}
                numberOfLines={2}
              >
                {parsed.payee || "Best Buy"}
              </Text>
              <Text
                align="center"
                tone={parsed.amount ? amountTone : "placeholder"}
                style={[
                  typeScale.display,
                  {
                    fontSize: 36,
                    lineHeight: 44,
                    letterSpacing: -0.8,
                    fontVariant: ["tabular-nums"],
                  },
                ]}
              >
                {parsed.amount ? formatMoney(parsed.amount) : "$47.27"}
              </Text>
            </>
          )}
        </View>
        {heardSomething && (
          <FormCard>
            <FormRow label="Type">
              <Text
                variant="body"
                weight="500"
                tone={r.isIncome ? "positive" : "text"}
              >
                {r.isIncome ? "Inflow" : "Outflow"}
              </Text>
            </FormRow>
            {!r.isIncome && (
              <FormRow label="Envelope">
                <Text
                  variant="body"
                  weight="500"
                  tone={r.envelope ? "text" : "placeholder"}
                  numberOfLines={1}
                >
                  {r.envelope?.name ?? "Not sure yet"}
                </Text>
              </FormRow>
            )}
            <FormRow label="Account">
              <Text
                variant="body"
                weight="500"
                tone={r.isSlip ? "negative" : "text"}
                numberOfLines={1}
              >
                {r.account?.name ?? "None"}
              </Text>
            </FormRow>
            <FormRow label="Date">
              <Text variant="body" weight="500">
                {formatPickedDate(r.date)}
              </Text>
            </FormRow>
            {parsed.memo ? (
              <FormRow label="Note">
                <Text
                  variant="body"
                  weight="500"
                  numberOfLines={1}
                  style={{ flex: 1.6, textAlign: "right" }}
                >
                  {parsed.memo}
                </Text>
              </FormRow>
            ) : null}
            {parsed.flagColor ? (
              <FormRow label="Flag">
                <View
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    backgroundColor: flagHues[parsed.flagColor],
                  }}
                />
              </FormRow>
            ) : null}
          </FormCard>
        )}
        {heardSomething && slipWarning}
        {voiceEntry.error ? (
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Button
              title="Type instead"
              variant="secondary"
              size="lg"
              style={{ flex: 1 }}
              onPress={typeInstead}
            />
            <Button
              title="Try again"
              size="lg"
              style={{ flex: 1 }}
              onPress={() => (setText(""), void voiceEntry.start())}
            />
          </View>
        ) : null}
      </SheetScreen>
    );
  }

  return (
    <SheetScreen contentContainerStyle={{ gap: spacing.md }}>
      <SheetHeader title="New transaction" />

      <FormCard>
        <View
          style={{ flexDirection: "row", alignItems: "center", height: 52 }}
        >
          <TextInput
            ref={nameRef}
            autoFocus={!voice}
            value={payee}
            onChangeText={setPayee}
            placeholder="Name"
            placeholderTextColor={colors.placeholder}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => amountRef.current?.focus()}
            accessibilityLabel="Name"
            style={[
              typeScale.body,
              {
                flex: 1,
                height: 52,
                paddingHorizontal: spacing.md,
                fontSize: 17,
                fontWeight: "600",
                color: colors.text,
                outlineWidth: 0,
              },
            ]}
          />
          <View
            style={{ width: 1, height: 26, backgroundColor: colors.hairline }}
          />
          <TextInput
            ref={amountRef}
            {...amountInputProps(amountText, setAmountText)}
            placeholder="$0.00"
            placeholderTextColor={colors.placeholder}
            returnKeyType="done"
            onSubmitEditing={() => save(parsed, override)}
            accessibilityLabel="Amount"
            style={[
              typeScale.body,
              {
                width: 130,
                height: 52,
                paddingHorizontal: spacing.md,
                textAlign: "right",
                fontSize: 17,
                fontWeight: "600",
                fontVariant: ["tabular-nums"],
                color: r.isIncome
                  ? colors.positive
                  : r.isSlip
                    ? colors.negative
                    : colors.text,
                outlineWidth: 0,
              },
            ]}
          />
        </View>
      </FormCard>

      {details}
      {slipWarning}

      <Button
        title={saveLabel}
        size="lg"
        variant={r.isSlip ? "destructive" : "primary"}
        disabled={!r.ready}
        onPress={() => save(parsed, override)}
      />
    </SheetScreen>
  );
}
