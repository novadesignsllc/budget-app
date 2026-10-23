import type { Account, Allocation, Cents, Envelope, ISODate, Transaction } from './types';
import { isCashAccount } from './types';

export type LedgerInput = {
  accounts: Account[];
  envelopes: Envelope[];
  transactions: Transaction[];
  allocations: Allocation[];
};

export type Ledger = {
  /** Working balance per account (opening + every transaction). */
  balance: Map<string, Cents>;
  /** Balance counting only cleared transactions. Used by reconciliation. */
  clearedBalance: Map<string, Cents>;
  /** Money sitting in each envelope right now. */
  available: Map<string, Cents>;
  /** Total cash across checking, savings, and cash accounts. */
  cashTotal: Cents;
  /** Total owed across debt accounts, as a positive number. */
  debtTotal: Cents;
  /** Cash that hasn't been given a job yet. Cash total minus every envelope. */
  readyToAssign: Cents;
};

/**
 * The core rule of the app: every dollar of cash is either in an envelope or in
 * Ready to Assign, so `readyToAssign + sum(available) === cashTotal` always holds.
 *
 * Envelope math per transaction:
 * - Cash account with an envelope: the envelope moves by the amount (spend is negative).
 * - Debt account with an envelope (a slip): the envelope moves by the amount, and the
 *   card's payment envelope moves the opposite way. The cash is still in the bank,
 *   now set aside to pay the card back.
 * - No envelope (income, interest, cash-to-cash transfers): no envelope changes.
 */
export function computeLedger({ accounts, envelopes, transactions, allocations }: LedgerInput): Ledger {
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const paymentEnvelopeByDebt = new Map<string, string>();
  for (const e of envelopes) {
    if (e.debtAccountId) paymentEnvelopeByDebt.set(e.debtAccountId, e.id);
  }

  const balance = new Map<string, Cents>();
  const clearedBalance = new Map<string, Cents>();
  for (const a of accounts) {
    balance.set(a.id, a.openingBalance);
    clearedBalance.set(a.id, a.openingBalance);
  }

  const available = new Map<string, Cents>();
  for (const e of envelopes) available.set(e.id, 0);
  const bump = (map: Map<string, Cents>, key: string, by: Cents) =>
    map.set(key, (map.get(key) ?? 0) + by);

  for (const al of allocations) bump(available, al.envelopeId, al.amount);

  for (const t of transactions) {
    const account = accountById.get(t.accountId);
    if (!account) continue;
    bump(balance, t.accountId, t.amount);
    if (t.cleared) bump(clearedBalance, t.accountId, t.amount);

    if (!t.envelopeId) continue;
    bump(available, t.envelopeId, t.amount);
    if (!isCashAccount(account)) {
      const paymentEnvelope = paymentEnvelopeByDebt.get(account.id);
      if (paymentEnvelope) bump(available, paymentEnvelope, -t.amount);
    }
  }

  let cashTotal = 0;
  let debtTotal = 0;
  for (const a of accounts) {
    const b = balance.get(a.id) ?? 0;
    if (isCashAccount(a)) cashTotal += b;
    else debtTotal += -b;
  }

  let assigned = 0;
  for (const v of available.values()) assigned += v;

  return {
    balance,
    clearedBalance,
    available,
    cashTotal,
    debtTotal,
    readyToAssign: cashTotal - assigned,
  };
}

/** Total spent from an envelope within [from, to], as a positive number. */
export function spentInRange(
  envelopeId: string,
  transactions: Transaction[],
  from: ISODate,
  to: ISODate,
): Cents {
  let spent = 0;
  for (const t of transactions) {
    if (t.envelopeId === envelopeId && t.date >= from && t.date <= to && t.amount < 0) {
      spent += -t.amount;
    }
  }
  return spent;
}

/** Envelopes that went below zero. Spending more than you have is shown, never hidden. */
export function overspentEnvelopes(ledger: Ledger, envelopes: Envelope[]): Envelope[] {
  return envelopes.filter((e) => (ledger.available.get(e.id) ?? 0) < 0);
}
