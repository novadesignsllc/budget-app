import { useMemo, useState } from 'react';

import type { DropdownOption } from '@/components/dropdown';
import { useToast } from '@/components/toast';
import {
  choiceFromKey,
  choiceKey,
  guessChoice,
  nearMatch,
  waiting,
  type BankTransaction,
} from '@/domain/bank';
import { daysBetween } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import { isCashAccount, type Account, type Transaction } from '@/domain/types';
import { useEntryOptions } from '@/hooks/use-entry-options';
import { useStore } from '@/store';
import { haptic } from '@/utils/haptics';

export type QueueItem = {
  bank: BankTransaction;
  account: Account;
  /** What Approve does unless you pick something else. */
  guess?: string;
  /** One you entered that's close but not the same: Approve asks first. */
  near?: Transaction;
};

/** Bank transactions waiting on Home, each with its best guess and any near match. */
export function useBankQueue(): QueueItem[] {
  const bankTransactions = useStore((s) => s.bankTransactions);
  const transactions = useStore((s) => s.transactions);
  const accounts = useStore((s) => s.accounts);
  const envelopes = useStore((s) => s.envelopes);
  const payees = useStore((s) => s.payees);
  const recurring = useStore((s) => s.recurring);
  return useMemo(() => {
    const byId = new Map(accounts.map((a) => [a.id, a]));
    const items: QueueItem[] = [];
    for (const bank of waiting(bankTransactions)) {
      const account = byId.get(bank.accountId);
      if (!account || account.closed) continue;
      const ctx = { accounts, envelopes, payees, recurring, bankTransactions };
      items.push({
        bank,
        account,
        guess: choiceKey(guessChoice(bank, ctx)),
        near: nearMatch(bank, transactions, payees),
      });
    }
    return items;
  }, [bankTransactions, transactions, accounts, envelopes, payees, recurring]);
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
    // Card payments come in on the card as money in; spending on a card is a slip from an envelope.
    if (!(inflow && !cash)) for (const o of envelopeOptions) out.push({ ...o, value: `env:${o.value}` });
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
 * Approve, link, skip, each with Undo. A bank transaction close to one you entered opens
 * the "Same as one you entered?" question first; `dialog` is what MatchDialog needs.
 */
export function useBankActions() {
  const approveBank = useStore((s) => s.approveBank);
  const linkBank = useStore((s) => s.linkBank);
  const skipBank = useStore((s) => s.skipBank);
  const restoreBank = useStore((s) => s.restoreBank);
  const showToast = useToast((s) => s.show);
  const [asking, setAsking] = useState<{ item: QueueItem; choice?: string } | null>(null);

  const undoable = (message: string, bankId: string) =>
    showToast({ message, actionLabel: 'Undo', onAction: () => restoreBank(bankId) });

  function add(item: QueueItem, key: string | undefined) {
    const choice = key ? choiceFromKey(key) : undefined;
    if (!choice) {
      showToast({ message: `Pick where ${item.bank.name} goes first.` });
      return;
    }
    if (!approveBank(item.bank.id, choice)) return;
    haptic('success');
    // A bill moves on to its next due date, which Undo can't take back, so it gets none.
    if (choice.type === 'bill') showToast({ message: `Added ${item.bank.name} · ${formatMoney(item.bank.amount)}` });
    else undoable(`Added ${item.bank.name} · ${formatMoney(item.bank.amount)}`, item.bank.id);
  }

  function approve(item: QueueItem, key: string | undefined) {
    if (item.near) {
      setAsking({ item, choice: key });
      return;
    }
    add(item, key);
  }

  function link(item: QueueItem, txn: Transaction) {
    linkBank(item.bank.id, txn.id);
    haptic('success');
    undoable(`Linked to your ${txn.payee}`, item.bank.id);
  }

  function skip(item: QueueItem) {
    skipBank(item.bank.id);
    undoable(`Skipped ${item.bank.name}`, item.bank.id);
  }

  const dialog = {
    mine: asking?.item.near ?? null,
    bank: asking?.item.bank ?? null,
    onLink: () => {
      if (asking?.item.near) link(asking.item, asking.item.near);
      setAsking(null);
    },
    onAddNew: () => {
      if (asking) add(asking.item, asking.choice);
      setAsking(null);
    },
    onCancel: () => setAsking(null),
  };

  return { approve, link, skip, dialog };
}

/** "Synced 9:41 AM", or "Synced Mon 9:41 AM" when it's been a while. */
export function syncedLabel(at: number | undefined, now = Date.now()): string {
  if (!at) return 'Not synced yet';
  const d = new Date(at);
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (now - at < 20 * 60 * 60 * 1000 && new Date(now).getDate() === d.getDate()) return `Synced ${time}`;
  return `Synced ${d.toLocaleDateString('en-US', { weekday: 'short' })} ${time}`;
}
