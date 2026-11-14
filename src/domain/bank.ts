import { addDays, daysBetween } from './dates';
import { findPayee, payeeMemory } from './payees';
import { envelopeFor, normalizePayee } from './quick-add';
import { isCashAccount, type Account, type AccountKind, type Cents, type Envelope, type ISODate, type Payee, type Recurring, type Transaction } from './types';

/**
 * Bank sync. Transactions are still entered by hand; the bank's copy is a check on them.
 * Each bank transaction either links to one you entered (exact amount, close date), waits
 * on Home for you to approve it, or was skipped. Linked transactions get the bank's
 * pending/posted status.
 */

/** One account at a linked bank, and the Slip account it feeds. */
export type BankAccountLink = {
  plaidAccountId: string;
  name: string;
  mask?: string;
  /** Plaid's type: depository, credit, loan, investment, other. */
  type: string;
  subtype?: string;
  /** The Slip account it feeds. Unset means you chose not to track it. */
  accountId?: string;
  /** Nothing before this day is brought in. */
  since?: ISODate;
  /** The bank's balance in Slip's sign (what's owed is negative). */
  balance?: Cents;
  available?: Cents;
  limit?: Cents;
};

/** One bank login (a Plaid item). `token` only works through Slip's server. */
export type BankLink = {
  /** Plaid's item id. */
  id: string;
  institution: string;
  token: string;
  cursor?: string;
  accounts: BankAccountLink[];
  linkedAt: number;
  syncedAt?: number;
  /** The bank wants you to sign in again before it sends anything new. */
  needsLogin?: boolean;
};

export type BankTxnStatus = 'new' | 'linked' | 'skipped' | 'gone';

/** The bank's copy of one transaction. */
export type BankTransaction = {
  /** Plaid's transaction id. */
  id: string;
  linkId: string;
  plaidAccountId: string;
  accountId: string;
  date: ISODate;
  /** Slip's sign: negative left the account. */
  amount: Cents;
  /** The cleaned-up name (merchant) when the bank has one, else its own text. */
  name: string;
  /** The bank's own text. */
  raw: string;
  pending: boolean;
  /** For a posted transaction: the pending one it replaced. */
  pendingId?: string;
  category?: string;
  status: BankTxnStatus;
  /** The Slip transaction it's linked to. */
  transactionId?: string;
  createdAt: number;
};

/** What the server sends for one transaction (see api/_lib/core.ts). */
export type SyncedTxn = {
  id: string;
  plaidAccountId: string;
  date: ISODate;
  name: string;
  merchant?: string;
  amount: Cents;
  pending: boolean;
  pendingId?: string;
  category?: string;
};

export type SyncedAccount = {
  plaidAccountId: string;
  name: string;
  mask?: string;
  type: string;
  subtype?: string;
  current?: Cents;
  available?: Cents;
  limit?: Cents;
};

export type SyncResult = {
  added: SyncedTxn[];
  modified: SyncedTxn[];
  removed: string[];
  cursor: string;
  ready: boolean;
  accounts: SyncedAccount[];
};

/** How far apart the bank's date and yours can be and still link on their own. */
export const MATCH_DAYS = 5;
/** Same amount but further apart than that, up to this, is only suggested. */
const SUGGEST_DAYS = 10;

/** Plaid reports what's owed on cards and loans as positive; Slip keeps debts negative. */
export function slipBalance(type: string, current: Cents | undefined): Cents | undefined {
  if (current === undefined) return undefined;
  return type === 'credit' || type === 'loan' ? -current : current;
}

/** Bank accounts Slip can track: money (checking, savings) and debts. Investments aren't tracked. */
export function trackable(a: Pick<BankAccountLink, 'type'>): boolean {
  return a.type === 'depository' || a.type === 'credit' || a.type === 'loan';
}

/** The kind a new Slip account gets for a bank account. */
export function kindFor(a: Pick<BankAccountLink, 'type' | 'subtype'>): AccountKind {
  if (a.type === 'credit') return 'credit_card';
  if (a.type === 'loan') {
    if (a.subtype === 'student') return 'student_loan';
    if (a.subtype === 'mortgage') return 'mortgage';
    if (a.subtype === 'auto') return 'auto_loan';
    return 'personal_loan';
  }
  return a.subtype === 'savings' || a.subtype === 'money market' || a.subtype === 'cd' ? 'savings' : 'checking';
}

/** Whether a Slip account of this kind can stand for this bank account. */
export function kindFits(a: Pick<BankAccountLink, 'type'>, kind: AccountKind): boolean {
  const cash = kind === 'checking' || kind === 'savings' || kind === 'cash';
  if (a.type === 'depository') return cash;
  if (a.type === 'credit') return kind === 'credit_card';
  if (a.type === 'loan') return !cash && kind !== 'credit_card';
  return false;
}

/** A bank name boiled down for comparing: lowercase letters only, store numbers and noise gone. */
export function nameKey(name: string): string {
  return normalizePayee(
    name
      // Card processors put their own prefix first: "SQ *JOES COFFEE", "TST* PIZZA".
      .replace(/^\s*(sq|tst|sp|pp|py|in|dd)\s*\*\s*/i, '')
      .replace(/\b(pos|debit|purchase|card|recurring|payment|ach|ppd|web|id|pmt|online|mobile|transfer)\b/gi, ' ')
      // Store and order numbers: "#0412", "*2K4L19".
      .replace(/[#*][\w-]*\d[\w-]*/g, ' ')
      .replace(/\d+/g, ' '),
  );
}

/** Whether a bank transaction's name looks like the payee you typed. */
export function similarName(bank: Pick<BankTransaction, 'name' | 'raw'>, payee: string, payees: Payee[] = []): boolean {
  const p = nameKey(payee);
  if (!p) return false;
  const keys = [nameKey(bank.name), nameKey(bank.raw)].filter((k) => k.length >= 3);
  if (keys.some((k) => k.includes(p) || p.includes(k))) return true;
  // A bank name you linked to this payee before.
  const known = payees.find((x) => nameKey(x.name) === p)?.bankNames ?? [];
  return keys.some((k) => known.includes(k));
}

/** Transactions a bank transaction could link to: same account, not linked to anything yet. */
function candidates(bank: BankTransaction, transactions: Transaction[], taken: Set<string>): Transaction[] {
  return transactions.filter(
    (t) =>
      t.accountId === bank.accountId &&
      !t.bankId &&
      !taken.has(t.id) &&
      t.kind !== 'adjustment' &&
      Math.sign(t.amount) === Math.sign(bank.amount),
  );
}

/**
 * The transaction you entered that's this bank transaction: the same amount within
 * MATCH_DAYS, closest date first, a similar name breaking ties.
 */
export function exactMatch(
  bank: BankTransaction,
  transactions: Transaction[],
  payees: Payee[] = [],
  taken: Set<string> = new Set(),
): Transaction | undefined {
  return candidates(bank, transactions, taken)
    .filter((t) => t.amount === bank.amount && Math.abs(daysBetween(t.date, bank.date)) <= MATCH_DAYS)
    .sort(
      (a, b) =>
        Math.abs(daysBetween(a.date, bank.date)) - Math.abs(daysBetween(b.date, bank.date)) ||
        Number(similarName(bank, b.payee, payees)) - Number(similarName(bank, a.payee, payees)) ||
        a.createdAt - b.createdAt,
    )[0];
}

/**
 * A transaction that's probably this one but not exactly: a tip or a gas hold changed the
 * amount, or the same amount landed on a different day. Approving asks before linking.
 */
export function nearMatch(
  bank: BankTransaction,
  transactions: Transaction[],
  payees: Payee[] = [],
  taken: Set<string> = new Set(),
): Transaction | undefined {
  const close = (t: Transaction) => {
    const days = Math.abs(daysBetween(t.date, bank.date));
    if (!similarName(bank, t.payee, payees)) return false;
    if (t.amount === bank.amount) return days <= SUGGEST_DAYS;
    const diff = Math.abs(t.amount - bank.amount);
    return days <= MATCH_DAYS && diff <= Math.max(2000, Math.abs(t.amount) * 0.3);
  };
  return candidates(bank, transactions, taken)
    .filter(close)
    .sort(
      (a, b) =>
        Math.abs(a.amount - bank.amount) - Math.abs(b.amount - bank.amount) ||
        Math.abs(daysBetween(a.date, bank.date)) - Math.abs(daysBetween(b.date, bank.date)),
    )[0];
}

/** A change to one of your transactions that a sync makes. */
export type TxnPatch = {
  id: string;
  bankId?: string | null;
  cleared?: boolean;
  amount?: Cents;
  /** The bank changed or dropped it after it was linked: flag it for a look. */
  flag?: boolean;
};

export type SyncPlan = {
  /** Every bank transaction after the sync. */
  bankTransactions: BankTransaction[];
  patches: TxnPatch[];
};

/**
 * Applies one sync from the bank. Pure: returns the new bank transactions and the changes
 * to make to yours. Running the same sync twice changes nothing the second time, so two
 * devices syncing at once can't double anything up.
 */
export function planSync(input: {
  link: BankLink;
  result: Pick<SyncResult, 'added' | 'modified' | 'removed'>;
  bankTransactions: BankTransaction[];
  transactions: Transaction[];
  payees: Payee[];
  now: number;
}): SyncPlan {
  const { link, result, transactions, payees, now } = input;
  const byId = new Map(input.bankTransactions.map((b) => [b.id, b]));
  const patches = new Map<string, TxnPatch>();
  const patch = (p: TxnPatch) => patches.set(p.id, { ...patches.get(p.id), ...p });
  const accountFor = new Map(link.accounts.filter((a) => a.accountId).map((a) => [a.plaidAccountId, a]));
  // Transactions already linked, including ones linked earlier in this same sync.
  const taken = new Set<string>();
  for (const b of byId.values()) if (b.transactionId && b.status === 'linked') taken.add(b.transactionId);
  const txnById = new Map(transactions.map((t) => [t.id, t]));

  const toBank = (s: SyncedTxn, accountId: string): BankTransaction => ({
    id: s.id,
    linkId: link.id,
    plaidAccountId: s.plaidAccountId,
    accountId,
    date: s.date,
    amount: s.amount,
    name: s.merchant || s.name,
    raw: s.name,
    pending: s.pending,
    ...(s.pendingId ? { pendingId: s.pendingId } : {}),
    ...(s.category ? { category: s.category } : {}),
    status: 'new',
    createdAt: now,
  });

  /** A linked transaction follows the bank: posted is checked, and a new amount is flagged. */
  const follow = (txnId: string, b: BankTransaction, prev?: BankTransaction) => {
    const t = txnById.get(txnId);
    if (!t) return;
    const p: TxnPatch = { id: txnId, bankId: b.id };
    // Reconciled ones are locked; the bank only updates the status of open ones.
    if (!t.reconciled) {
      p.cleared = !b.pending;
      if (t.amount !== b.amount && prev && prev.amount !== b.amount) {
        p.amount = b.amount;
        p.flag = true;
      }
    }
    patch(p);
  };

  for (const s of result.added) {
    const acct = accountFor.get(s.plaidAccountId);
    if (!acct?.accountId || byId.has(s.id)) continue;
    if (acct.since && s.date < acct.since && !(s.pendingId && byId.has(s.pendingId))) continue;
    const b = toBank(s, acct.accountId);
    const before = s.pendingId ? byId.get(s.pendingId) : undefined;
    if (before && before.status !== 'gone') {
      // The pending charge posted. It takes over whatever the pending one had.
      byId.set(before.id, { ...before, status: 'gone' });
      if (before.status === 'linked' && before.transactionId) {
        byId.set(b.id, { ...b, status: 'linked', transactionId: before.transactionId });
        follow(before.transactionId, b, before);
        continue;
      }
      if (before.status === 'skipped') {
        byId.set(b.id, { ...b, status: 'skipped' });
        continue;
      }
    }
    const match = exactMatch(b, transactions, payees, taken);
    if (match) {
      taken.add(match.id);
      byId.set(b.id, { ...b, status: 'linked', transactionId: match.id });
      follow(match.id, b);
    } else {
      byId.set(b.id, b);
    }
  }

  for (const s of result.modified) {
    const old = byId.get(s.id);
    if (!old) continue;
    const b: BankTransaction = { ...toBank(s, old.accountId), status: old.status, transactionId: old.transactionId, createdAt: old.createdAt };
    byId.set(b.id, b);
    if (b.status === 'linked' && b.transactionId) follow(b.transactionId, b, old);
  }

  for (const id of result.removed) {
    const old = byId.get(id);
    if (!old || old.status === 'gone') continue;
    byId.set(id, { ...old, status: 'gone' });
    // A linked charge the bank dropped (a hold that never posted): unlink it and flag it.
    if (old.status === 'linked' && old.transactionId) {
      const replaced = [...byId.values()].some((x) => x.pendingId === id && x.status === 'linked');
      const t = txnById.get(old.transactionId);
      if (!replaced && t && !t.reconciled) patch({ id: old.transactionId, bankId: null, cleared: false, flag: true });
    }
  }

  return { bankTransactions: [...byId.values()], patches: [...patches.values()] };
}

/** Bank transactions waiting for you on Home, newest first. */
export function waiting(bankTransactions: BankTransaction[]): BankTransaction[] {
  return bankTransactions
    .filter((b) => b.status === 'new')
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt));
}

/**
 * Bringing in an account that's already in Slip: what the bank has from `since` on, what
 * links, what's new, and what you entered that the bank doesn't have.
 */
export function linkPreview(input: {
  accountId: string;
  since: ISODate;
  synced: SyncedTxn[];
  plaidAccountId: string;
  transactions: Transaction[];
  payees: Payee[];
}) {
  const { accountId, since, plaidAccountId, transactions, payees } = input;
  const bank = input.synced.filter((s) => s.plaidAccountId === plaidAccountId && s.date >= since);
  const taken = new Set<string>();
  let matched = 0;
  const fresh: SyncedTxn[] = [];
  for (const s of bank) {
    const b: BankTransaction = {
      id: s.id,
      linkId: '',
      plaidAccountId,
      accountId,
      date: s.date,
      amount: s.amount,
      name: s.merchant || s.name,
      raw: s.name,
      pending: s.pending,
      status: 'new',
      createdAt: 0,
    };
    const m = exactMatch(b, transactions, payees, taken);
    if (m) {
      taken.add(m.id);
      matched++;
    } else fresh.push(s);
  }
  const missing = transactions.filter(
    (t) => t.accountId === accountId && t.date >= since && !t.bankId && !taken.has(t.id) && !t.reconciled && t.kind !== 'adjustment',
  );
  return { matched, fresh, missing };
}

/**
 * How far Slip will be from the bank once an account is linked and everything waiting on
 * Home is approved: the bank's posted balance against your posted (and reconciled) ones,
 * counting what links and what's new. History before `since` counts as posted. Linking
 * posts this as one Error adjustment.
 */
export function linkGap(input: {
  account: Pick<Account, 'id' | 'openingBalance'>;
  since: ISODate;
  plaidAccountId: string;
  synced: SyncedTxn[];
  transactions: Transaction[];
  payees: Payee[];
  bankBalance: Cents;
  remove?: Set<string>;
}): Cents {
  const { account, since, plaidAccountId, payees, bankBalance } = input;
  const mine = input.transactions
    .filter((t) => t.accountId === account.id && !input.remove?.has(t.id))
    .map((t) => (t.date < since && !t.reconciled ? { ...t, cleared: true } : t));
  const preview: BankLink = {
    id: 'preview',
    institution: '',
    token: '',
    linkedAt: 0,
    accounts: [{ plaidAccountId, name: '', type: '', accountId: account.id, since }],
  };
  const plan = planSync({
    link: preview,
    result: { added: input.synced, modified: [], removed: [] },
    bankTransactions: [],
    transactions: mine,
    payees,
    now: 0,
  });
  const patched = new Map(plan.patches.map((p) => [p.id, p]));
  let posted = account.openingBalance;
  for (const t of mine) {
    const p = patched.get(t.id);
    if (p?.cleared ?? (t.cleared || t.reconciled)) posted += p?.amount ?? t.amount;
  }
  const queued = plan.bankTransactions.filter((b) => b.status === 'new' && !b.pending).reduce((a, b) => a + b.amount, 0);
  return bankBalance - posted - queued;
}

/** A new account's opening balance: the bank's balance before the posted transactions that come in to approve. */
export function openingFromBank(bankBalance: Cents, synced: SyncedTxn[], plaidAccountId: string, since: ISODate): Cents {
  return synced
    .filter((s) => s.plaidAccountId === plaidAccountId && s.date >= since && !s.pending)
    .reduce((a, s) => a - s.amount, bankBalance);
}

/** The start of a new account's history: a week back, so the last 7 days come in to approve. */
export function newAccountSince(day: ISODate): ISODate {
  return addDays(day, -6);
}

/**
 * An account already in Slip matches from the 1st of this month, or from the day it was
 * opened if that's later (a new account, or one that just had a fresh start), so nothing
 * from before it existed comes in to approve.
 */
export function existingAccountSince(day: ISODate, openedOn?: ISODate): ISODate {
  const first = `${day.slice(0, 7)}-01`;
  return openedOn && openedOn > first ? openedOn : first;
}

/** The payee of the one transaction that brings a new account's bank balance into Slip. */
export const STARTING_BALANCE = 'Starting balance';

/**
 * What approving a bank transaction makes of it: spending from (or a refund to) an
 * envelope, income, a transfer with another account, a due bill, interest on a debt, or a
 * plain correction.
 */
export type BankChoice =
  | { type: 'envelope'; envelopeId: string }
  | { type: 'income' }
  | { type: 'transfer'; accountId: string }
  | { type: 'bill'; recurringId: string }
  | { type: 'interest' }
  | { type: 'adjustment' };

/** A choice as one string, for a dropdown's value. */
export function choiceKey(c: BankChoice | undefined): string | undefined {
  if (!c) return undefined;
  switch (c.type) {
    case 'envelope':
      return `env:${c.envelopeId}`;
    case 'transfer':
      return `xfer:${c.accountId}`;
    case 'bill':
      return `bill:${c.recurringId}`;
    default:
      return c.type;
  }
}

export function choiceFromKey(key: string): BankChoice | undefined {
  const i = key.indexOf(':');
  const head = i < 0 ? key : key.slice(0, i);
  const id = key.slice(i + 1);
  if (head === 'env') return { type: 'envelope', envelopeId: id };
  if (head === 'xfer') return { type: 'transfer', accountId: id };
  if (head === 'bill') return { type: 'bill', recurringId: id };
  if (head === 'income' || head === 'interest' || head === 'adjustment') return { type: head };
  return undefined;
}

/** A bill or subscription that this bank transaction looks like: same account, similar name, due within a week. */
export function dueBill(bank: BankTransaction, recurring: Recurring[]): Recurring | undefined {
  if (bank.amount >= 0) return undefined;
  return recurring
    .filter(
      (r) =>
        r.active &&
        r.accountId === bank.accountId &&
        Math.abs(daysBetween(r.nextDue, bank.date)) <= 7 &&
        similarName(bank, r.name),
    )
    .sort((a, b) => Math.abs(daysBetween(a.nextDue, bank.date)) - Math.abs(daysBetween(b.nextDue, bank.date)))[0];
}

/** The other side of a transfer between two linked accounts: the opposite amount within 3 days. */
export function transferPartner(bank: BankTransaction, bankTransactions: BankTransaction[]): BankTransaction | undefined {
  return bankTransactions.find(
    (b) =>
      b.id !== bank.id &&
      b.accountId !== bank.accountId &&
      b.status !== 'gone' &&
      b.amount === -bank.amount &&
      Math.abs(daysBetween(b.date, bank.date)) <= 3,
  );
}

/**
 * Where a bank transaction most likely goes, so most need only a tap on Approve: a bill
 * that's due, then what you picked for this payee before, the other side of a transfer,
 * a paycheck, interest on a card, then a guess from the name.
 */
export function guessChoice(
  bank: BankTransaction,
  ctx: {
    accounts: Account[];
    envelopes: Envelope[];
    payees: Payee[];
    recurring: Recurring[];
    bankTransactions: BankTransaction[];
  },
): BankChoice | undefined {
  const account = ctx.accounts.find((a) => a.id === bank.accountId);
  if (!account) return undefined;
  const cash = isCashAccount(account);
  const bill = dueBill(bank, ctx.recurring);
  if (bill) return { type: 'bill', recurringId: bill.id };
  const keys = [nameKey(bank.raw), nameKey(bank.name)];
  const payee = ctx.payees.find((p) => p.bankNames?.some((k) => keys.includes(k))) ?? findPayee(ctx.payees, bank.name);
  const live = (id?: string) => !!id && ctx.envelopes.some((e) => e.id === id && !e.hidden);
  if (payee?.income && bank.amount > 0 && cash) return { type: 'income' };
  if (payee && live(payee.envelopeId)) return { type: 'envelope', envelopeId: payee.envelopeId! };
  const partner = transferPartner(bank, ctx.bankTransactions);
  if (partner) return { type: 'transfer', accountId: partner.accountId };
  if (bank.amount > 0 && cash && bank.category === 'INCOME') return { type: 'income' };
  if (bank.amount < 0 && !cash && bank.category === 'BANK_FEES') return { type: 'interest' };
  if (bank.amount < 0) {
    const guess = envelopeFor(bank.name, { envelopes: ctx.envelopes, merchantMemory: payeeMemory(ctx.payees) });
    if (guess.envelopeId && live(guess.envelopeId)) return { type: 'envelope', envelopeId: guess.envelopeId };
  }
  return undefined;
}
