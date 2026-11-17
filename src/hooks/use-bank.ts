import { useMemo, useState } from 'react';

import type { DropdownOption } from '@/components/dropdown';
import { useToast } from '@/components/toast';
import { choiceFromKey, choiceKey, choiceOf, exactMatch, nearMatch, type BankTransaction } from '@/domain/bank';
import { addDays, daysBetween, today } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import { isCashAccount, type Account, type Transaction } from '@/domain/types';
import { useEntryOptions } from '@/hooks/use-entry-options';
import { useStore } from '@/store';
import { haptic } from '@/utils/haptics';

export type QueueItem = {
  bank: BankTransaction;
  account: Account;
  /** What sync added for it: already in the account. */
  txn: Transaction;
  /** Where it goes now (what Approve keeps unless you pick something else). */
  guess?: string;
  /** One you entered that looks like the same transaction: Approve asks first. */
  near?: Transaction;
};

/** How far back a bank transaction that's in still gets checked against ones you enter later. */
const RECHECK_DAYS = 30;

/**
 * What's on Home: bank transactions sync added that you haven't checked yet, and any it
 * added that now look like one you entered (you logged it after the bank sent it).
 */
export function useBankQueue(): QueueItem[] {
  const bankTransactions = useStore((s) => s.bankTransactions);
  const transactions = useStore((s) => s.transactions);
  const accounts = useStore((s) => s.accounts);
  const payees = useStore((s) => s.payees);
  return useMemo(() => {
    const accountById = new Map(accounts.map((a) => [a.id, a]));
    const bankById = new Map(bankTransactions.map((b) => [b.id, b]));
    const since = addDays(today(), -RECHECK_DAYS);
    const items: QueueItem[] = [];
    for (const txn of transactions) {
      if (!txn.bankId || !(txn.review || (txn.fromBank && !txn.reconciled && txn.date >= since))) continue;
      const bank = bankById.get(txn.bankId);
      const account = accountById.get(txn.accountId);
      if (!bank || bank.transactionId !== txn.id || !account || account.closed) continue;
      const near = txn.reconciled ? undefined : (exactMatch(bank, transactions, payees) ?? nearMatch(bank, transactions, payees));
      if (!txn.review && !near) continue;
      items.push({ bank, account, txn, guess: choiceKey(choiceOf(txn)), near });
    }
    return items.sort((a, b) => (a.bank.date < b.bank.date ? 1 : a.bank.date > b.bank.date ? -1 : b.bank.createdAt - a.bank.createdAt));
  }, [bankTransactions, transactions, accounts, payees]);
}

/** When the banks last sent something, and whether any wants you to sign in again. */
export function useBankSyncState() {
  const links = useStore((s) => s.bankLinks);
  return useMemo(() => {
    const live = links.filter((l) => l.accounts.some((a) => a.accountId));
    const synced = live.map((l) => l.syncedAt ?? 0).filter(Boolean);
    return {
      linked: live.length > 0,
      syncedAt: synced.length ? Math.min(...synced) : undefined,
      needsLogin: live.filter((l) => l.needsLogin),
    };
  }, [links]);
}

/** What a bank transaction can become: envelopes, plus income, transfers, bills and interest where they fit. */
export function useChoiceOptions(item: QueueItem): DropdownOption<string>[] {
  const { envelopeOptions } = useEntryOptions();
  const accounts = useStore((s) => s.accounts);
  const recurring = useStore((s) => s.recurring);
  return useMemo(() => {
    const { bank, account } = item;
    const cash = isCashAccount(account);
    const inflow = bank.amount > 0;
    const out: DropdownOption<string>[] = [];
    if (inflow && cash) out.push({ value: 'income', label: 'Ready to assign', section: 'Income' });
    const bills = recurring.filter(
      (r) => r.active && r.accountId === account.id && !inflow && Math.abs(daysBetween(r.nextDue, bank.date)) <= 14,
    );
    for (const r of bills) out.push({ value: `bill:${r.id}`, label: r.name, detail: formatMoney(r.amount), section: 'Bills due' });
    // Every direction can go to an envelope: a refund on a card goes back to the envelope it came from.
    for (const o of envelopeOptions) out.push({ ...o, value: `env:${o.value}` });
    for (const a of accounts) {
      if (a.closed || a.id === account.id) continue;
      out.push({ value: `xfer:${a.id}`, label: inflow ? `From ${a.name}` : `To ${a.name}`, section: 'Transfer' });
    }
    if (!cash && !inflow) out.push({ value: 'interest', label: 'Interest and fees', section: 'Other' });
    out.push({ value: 'adjustment', label: 'Balance correction', section: 'Other' });
    return out;
  }, [item, envelopeOptions, accounts, recurring]);
}

/**
 * Approve and Link, each with Undo. One that looks like a transaction you entered opens
 * the "Same as one you entered?" question first; `dialog` is what MatchDialog needs.
 */
export function useBankActions() {
  const settleBank = useStore((s) => s.settleBank);
  const linkBank = useStore((s) => s.linkBank);
  const restoreBank = useStore((s) => s.restoreBank);
  const showToast = useToast((s) => s.show);
  const [asking, setAsking] = useState<{ item: QueueItem; choice?: string } | null>(null);

  const undoable = (message: string, bankId: string) =>
    showToast({ message, actionLabel: 'Undo', onAction: () => restoreBank(bankId) });

  function keep(item: QueueItem, key: string | undefined) {
    const choice = key ? choiceFromKey(key) : undefined;
    if (!choice) {
      showToast({ message: `Pick where ${item.bank.name} goes first.` });
      return;
    }
    settleBank(item.bank.id, choice);
    haptic('success');
    undoable(`Approved ${item.bank.name} · ${formatMoney(item.bank.amount)}`, item.bank.id);
  }

  function approve(item: QueueItem, key: string | undefined) {
    if (item.near) {
      setAsking({ item, choice: key });
      return;
    }
    keep(item, key);
  }

  function link(item: QueueItem, txn: Transaction) {
    linkBank(item.bank.id, txn.id);
    haptic('success');
    undoable(`Linked to your ${txn.payee}`, item.bank.id);
  }

  const dialog = {
    mine: asking?.item.near ?? null,
    bank: asking?.item.bank ?? null,
    onLink: () => {
      if (asking?.item.near) link(asking.item, asking.item.near);
      setAsking(null);
    },
    onKeepBoth: () => {
      if (asking) keep(asking.item, asking.choice);
      setAsking(null);
    },
    onCancel: () => setAsking(null),
  };

  return { approve, link, dialog };
}

/** "Synced 9:41 AM", or "Synced Mon 9:41 AM" when it's been a while. */
export function syncedLabel(at: number | undefined, now = Date.now()): string {
  if (!at) return 'Not synced yet';
  const d = new Date(at);
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (now - at < 20 * 60 * 60 * 1000 && new Date(now).getDate() === d.getDate()) return `Synced ${time}`;
  return `Synced ${d.toLocaleDateString('en-US', { weekday: 'short' })} ${time}`;
}
