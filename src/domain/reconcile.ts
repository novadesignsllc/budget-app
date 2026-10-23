import type { Account, Cents, Transaction } from './types';

/** Reconciled transactions are locked: editing one asks first. */
export function isLocked(t: Pick<Transaction, 'reconciled'>): boolean {
  return !!t.reconciled;
}

/** Flagged transactions stay out of reconciliation until the flag is cleared. */
export function canReconcile(t: Pick<Transaction, 'flagged'>): boolean {
  return !t.flagged;
}

/** Opening balance plus every reconciled transaction: what the bank statement should show. */
export function reconciledBalance(account: Pick<Account, 'id' | 'openingBalance'>, transactions: Transaction[]): Cents {
  return transactions
    .filter((t) => t.accountId === account.id && t.reconciled)
    .reduce((a, t) => a + t.amount, account.openingBalance);
}
