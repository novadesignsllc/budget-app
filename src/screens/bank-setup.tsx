import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import { firstSync } from '@/bank/sync';
import { Button } from '@/components/button';
import { Card, CardHeader } from '@/components/card';
import { Dropdown, type DropdownOption } from '@/components/dropdown';
import { FormCard, FormRow } from '@/components/form';
import { Money } from '@/components/money';
import { SheetScreen } from '@/components/screen';
import { SheetHeader } from '@/components/sheet-header';
import { Text } from '@/components/text';
import { useToast } from '@/components/toast';
import { DateBlock } from '@/components/transaction-row';
import {
  existingAccountSince,
  kindFits,
  kindFor,
  linkGap,
  linkPreview,
  nameKey,
  newAccountSince,
  openingFromBank,
  slipBalance,
  trackable,
  waiting,
  type BankAccountLink,
  type SyncResult,
} from '@/domain/bank';
import { formatShortDate, today } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import { isCashAccount } from '@/domain/types';
import { useLedger } from '@/hooks/use-ledger';
import { useStore } from '@/store';
import { spacing, useColors } from '@/theme';
import { closeSheet } from '@/utils/close-sheet';
import { haptic } from '@/utils/haptics';

const NEW = 'new';
const SKIP = 'skip';

/**
 * After signing in to a bank: pick which Slip account each bank account feeds (or a new
 * one), then, for accounts already in Slip, see what matched, what's new and what the
 * bank doesn't have before linking.
 */
export function BankSetup({ id }: { id: string }) {
  const colors = useColors();
  const ledger = useLedger();
  const link = useStore((s) => s.bankLinks.find((l) => l.id === id));
  const accounts = useStore((s) => s.accounts);
  const bankLinks = useStore((s) => s.bankLinks);
  const transactions = useStore((s) => s.transactions);
  const payees = useStore((s) => s.payees);
  const showToast = useToast((s) => s.show);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'accounts' | 'review'>('accounts');
  const [map, setMap] = useState<Record<string, string>>({});
  const [remove, setRemove] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const started = useRef(false);
  const day = today();

  const fetchFirst = () => {
    if (!link) return;
    setError('');
    firstSync(link).then(setResult, (e: Error) => setError(e.message));
  };
  useEffect(() => {
    if (!link || started.current) return;
    started.current = true;
    fetchFirst();
    // Best guesses: an account already in Slip with the same kind and a similar name.
    const taken = new Set(bankLinks.filter((l) => l.id !== link.id).flatMap((l) => l.accounts.map((a) => a.accountId)));
    const guess: Record<string, string> = {};
    for (const a of link.accounts.filter(trackable)) {
      const key = nameKey(a.name);
      const same = accounts.find(
        (x) =>
          !x.closed &&
          !taken.has(x.id) &&
          kindFits(a, x.kind) &&
          (nameKey(x.name).includes(key) || key.includes(nameKey(x.name)) || (!!a.mask && x.name.includes(a.mask))),
      );
      if (same) taken.add(same.id);
      // Everyday accounts and debts come in as new accounts; CDs, HSAs and the like stay out unless you pick them.
      const everyday = a.type !== 'depository' || a.subtype === 'checking' || a.subtype === 'savings';
      guess[a.plaidAccountId] = same?.id ?? (everyday ? NEW : SKIP);
    }
    setMap(guess);
    // Only once per open sheet; later store changes shouldn't reset choices.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link?.id]);

  const balanceOf = (a: BankAccountLink) =>
    slipBalance(a.type, result?.accounts.find((x) => x.plaidAccountId === a.plaidAccountId)?.current) ?? a.balance;

  const tracked = useMemo(() => (link ? link.accounts.filter(trackable) : []), [link]);
  const existing = tracked.filter((a) => map[a.plaidAccountId] && map[a.plaidAccountId] !== NEW && map[a.plaidAccountId] !== SKIP);
  const since = existingAccountSince(day);

  if (!link) {
    return (
      <SheetScreen>
        <SheetHeader title="Link a bank" />
        <Card padded>
          <Text variant="callout" tone="textSecondary">
            This bank isn’t linked anymore.
          </Text>
        </Card>
      </SheetScreen>
    );
  }

  const optionsFor = (a: BankAccountLink): DropdownOption<string>[] => {
    const usedElsewhere = new Set(
      [
        ...bankLinks.filter((l) => l.id !== link.id).flatMap((l) => l.accounts.map((x) => x.accountId)),
        ...Object.entries(map)
          .filter(([pid]) => pid !== a.plaidAccountId)
          .map(([, v]) => v),
      ].filter(Boolean),
    );
    return [
      { value: NEW, label: 'Add as a new account' },
      ...accounts
        .filter((x) => !x.closed && kindFits(a, x.kind) && !usedElsewhere.has(x.id))
        .map((x) => ({ value: x.id, label: x.name, face: x.order, section: 'Your accounts' })),
      { value: SKIP, label: 'Don’t track', section: 'Other' },
    ];
  };

  function finish() {
    if (!link || !result) return;
    setSaving(true);
    const s = useStore.getState();
    // Gaps first, from the state before anything changes, so they match what the review showed.
    const gaps = new Map<string, number>();
    for (const a of existing) {
      const accountId = map[a.plaidAccountId];
      const account = s.accounts.find((x) => x.id === accountId);
      const bal = balanceOf(a);
      if (!account || bal === undefined) continue;
      gaps.set(
        accountId,
        linkGap({ account, since, plaidAccountId: a.plaidAccountId, synced: result.added, transactions: s.transactions, payees: s.payees, bankBalance: bal, remove }),
      );
    }

    const mapped = link.accounts.map((a): BankAccountLink => {
      const choice = trackable(a) ? map[a.plaidAccountId] : SKIP;
      if (!choice || choice === SKIP) {
        const { accountId: _none, since: _s, ...rest } = a;
        return rest;
      }
      if (choice === NEW) {
        const start = newAccountSince(day);
        const kind = kindFor(a);
        const bal = balanceOf(a) ?? 0;
        const opening = openingFromBank(bal, result.added, a.plaidAccountId, start);
        const limit = result.accounts.find((x) => x.plaidAccountId === a.plaidAccountId)?.limit;
        const newId = s.addAccount({
          name: a.name,
          kind,
          balance: Math.abs(opening),
          ...(kind === 'credit_card' && limit ? { creditLimit: limit } : {}),
        });
        // Exactly the bank's number (addAccount takes debts as "amount owed"), dated a week back.
        useStore.getState().updateAccount(newId, { openingBalance: opening, openedOn: start });
        return { ...a, accountId: newId, since: start };
      }
      return { ...a, accountId: choice, since };
    });

    // Accounts already in Slip: history before the 1st is posted, and what you chose to delete goes.
    const existingIds = new Set(existing.map((a) => map[a.plaidAccountId]));
    useStore.setState((st) => ({
      transactions: st.transactions
        .filter((t) => !remove.has(t.id))
        .map((t) => (existingIds.has(t.accountId) && t.date < since && !t.cleared && !t.reconciled ? { ...t, cleared: true } : t)),
    }));
    useStore.getState().saveBankLink({ ...link, accounts: mapped });
    useStore.getState().applyBankSync(link.id, result);
    if (result.ready) for (const [accountId, gap] of gaps) if (gap !== 0) useStore.getState().addAdjustment(accountId, gap, { fix: true });

    const waitingNow = waiting(useStore.getState().bankTransactions).filter((b) => b.linkId === link.id).length;
    haptic('success');
    showToast({
      message: `${link.institution} is linked.${waitingNow ? ` ${waitingNow} waiting on Home.` : ''}`,
    });
    closeSheet();
  }

  if (step === 'review') {
    return (
      <SheetScreen>
        <SheetHeader title={`Link ${link.institution}`} />
        {existing.map((a) => {
          const accountId = map[a.plaidAccountId];
          const account = accounts.find((x) => x.id === accountId)!;
          const bal = balanceOf(a);
          const preview = linkPreview({ accountId, since, synced: result?.added ?? [], plaidAccountId: a.plaidAccountId, transactions, payees });
          const gap =
            result && bal !== undefined
              ? linkGap({ account, since, plaidAccountId: a.plaidAccountId, synced: result.added, transactions, payees, bankBalance: bal, remove })
              : 0;
          const debt = !isCashAccount(account);
          return (
            <View key={a.plaidAccountId} style={{ gap: spacing.md }}>
              <Text variant="section" style={{ paddingHorizontal: 4, marginBottom: -4 }}>
                {account.name}
                <Text variant="callout" tone="textSecondary">
                  {`  ${a.name}${a.mask ? ` ··${a.mask}` : ''}`}
                </Text>
              </Text>
              <FormCard>
                <FormRow label={debt ? 'Owed at the bank' : 'At the bank'}>
                  {bal === undefined ? <Text variant="body" tone="textTertiary">—</Text> : <Money cents={debt ? -bal : bal} weight="600" />}
                </FormRow>
                <FormRow label={debt ? 'Owed in Slip' : 'In Slip'}>
                  <Money cents={(debt ? -1 : 1) * (ledger.balance.get(accountId) ?? 0)} weight="500" />
                </FormRow>
                <FormRow label={`Matched since ${formatShortDate(since)}`}>
                  <Text variant="body" weight="500">
                    {preview.matched}
                  </Text>
                </FormRow>
                <FormRow label="New, to approve on Home">
                  <Text variant="body" weight="500">
                    {preview.fresh.length}
                  </Text>
                </FormRow>
                <FormRow label={result?.ready === false ? 'Difference (still loading)' : 'Difference'}>
                  <Money cents={gap} weight="600" signed={gap !== 0} tone={gap === 0 ? 'positive' : 'auto'} />
                </FormRow>
              </FormCard>
              {preview.missing.length > 0 && (
                <Card>
                  <CardHeader title="Not at the bank" detail={account.name} />
                  {preview.missing.map((t, i) => {
                    const gone = remove.has(t.id);
                    return (
                      <View
                        key={t.id}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: spacing.sm,
                          minHeight: 50,
                          paddingHorizontal: spacing.md,
                          borderBottomWidth: i === preview.missing.length - 1 ? 0 : 1,
                          borderBottomColor: colors.hairline,
                          backgroundColor: gone ? colors.rowDone : colors.surface,
                        }}
                      >
                        <DateBlock date={t.date} tone={gone ? 'muted' : undefined} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text
                            variant="row"
                            weight="600"
                            tone={gone ? 'textTertiary' : 'text'}
                            numberOfLines={1}
                            style={gone ? { textDecorationLine: 'line-through' } : undefined}
                          >
                            {t.payee}
                          </Text>
                          <Text variant="caption" tone="textSecondary">
                            {formatMoney(t.amount, { signed: t.amount > 0 })}
                          </Text>
                        </View>
                        <Button
                          title={gone ? 'Keep it' : 'Delete'}
                          size="sm"
                          variant={gone ? 'secondary' : 'destructive'}
                          onPress={() =>
                            setRemove((r) => {
                              const next = new Set(r);
                              if (gone) next.delete(t.id);
                              else next.add(t.id);
                              return next;
                            })
                          }
                        />
                      </View>
                    );
                  })}
                </Card>
              )}
            </View>
          );
        })}
        {(() => {
          const total = existing.reduce((sum, a) => {
            const accountId = map[a.plaidAccountId];
            const account = accounts.find((x) => x.id === accountId);
            const bal = balanceOf(a);
            if (!account || bal === undefined || !result?.ready) return sum;
            return sum + Math.abs(linkGap({ account, since, plaidAccountId: a.plaidAccountId, synced: result.added, transactions, payees, bankBalance: bal, remove }));
          }, 0);
          return (
            <Button
              title={total ? 'Link and adjust the difference' : 'Link'}
              size="lg"
              loading={saving}
              onPress={finish}
            />
          );
        })()}
        <Button title="Back" variant="ghost" onPress={() => setStep('accounts')} />
      </SheetScreen>
    );
  }

  return (
    <SheetScreen>
      <SheetHeader title={`Link ${link.institution}`} />
      <FormCard>
        {tracked.map((a) => {
          const bal = balanceOf(a);
          const label = `${a.name}${a.mask ? ` ··${a.mask}` : ''}`;
          return (
            <View key={a.plaidAccountId}>
              <Dropdown
                variant="row"
                label={label}
                value={map[a.plaidAccountId]}
                options={optionsFor(a)}
                onChange={(v) => setMap((m) => ({ ...m, [a.plaidAccountId]: v }))}
              />
              {bal !== undefined && (
                <Text variant="caption" tone="textSecondary" style={{ paddingHorizontal: spacing.md, marginTop: -8, paddingBottom: 8 }}>
                  {a.type === 'depository' ? `Bank balance ${formatMoney(bal)}` : `${formatMoney(-bal)} owed`}
                </Text>
              )}
            </View>
          );
        })}
      </FormCard>
      {error ? (
        <Card padded>
          <Text variant="callout" tone="negative">
            {error}
          </Text>
          <Button title="Try again" variant="secondary" onPress={fetchFirst} style={{ alignSelf: 'flex-start' }} />
        </Card>
      ) : null}
      <Button
        title={result ? (existing.length ? 'Continue' : 'Link') : 'Getting transactions…'}
        size="lg"
        disabled={!result || saving || tracked.every((a) => map[a.plaidAccountId] === SKIP)}
        loading={!result && !error}
        onPress={() => (existing.length ? setStep('review') : finish())}
      />
    </SheetScreen>
  );
}
