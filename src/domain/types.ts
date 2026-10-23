/** All money is integer cents. Dates are local `YYYY-MM-DD` strings. */
export type Cents = number;
export type ISODate = string;

export type CashKind = 'checking' | 'savings' | 'cash';
export type DebtKind =
  | 'credit_card'
  | 'auto_loan'
  | 'student_loan'
  | 'mortgage'
  | 'personal_loan'
  | 'medical'
  | 'other_debt';
export type AccountKind = CashKind | DebtKind;

export type Account = {
  id: string;
  name: string;
  kind: AccountKind;
  /** Balance on the day the account was added. Debts are negative (money owed). */
  openingBalance: Cents;
  openedOn: ISODate;
  order: number;
  closed?: boolean;
  /** Debt-only fields. APR in basis points (24.99% = 2499). */
  apr?: number;
  minPayment?: Cents;
  dueDay?: number;
  /** Cash-only: last time the user confirmed the bank balance. */
  lastReconciledOn?: ISODate;
};

export type Envelope = {
  id: string;
  name: string;
  group: string;
  order: number;
  /** Set when this is the auto-created payment envelope for a debt account. */
  debtAccountId?: string;
  /**
   * Monthly target by month: an entry applies from that month on, until a later entry.
   * `null` clears the target from that month. Older envelopes may only have
   * `monthlyTarget`, which applies to months before any entry.
   */
  targets?: Record<string, Cents | null>;
  /** Legacy single target, used before any `targets` entry. */
  monthlyTarget?: Cents;
  hidden?: boolean;
};

export type TransactionKind =
  | 'spend' // cash account outflow from an envelope
  | 'income' // cash account inflow to Ready to Assign
  | 'slip' // a credit card purchase. Allowed, frowned upon.
  | 'transfer' // between two of the user's accounts (includes debt payments)
  | 'interest' // statement interest/fees posted to a debt
  | 'adjustment'; // reconciliation difference

export type Transaction = {
  id: string;
  date: ISODate;
  accountId: string;
  /** Signed from the account's perspective: negative leaves the account. */
  amount: Cents;
  kind: TransactionKind;
  payee: string;
  /** Envelope the money came from. Undefined for income, interest, and cash-to-cash transfers. */
  envelopeId?: string;
  /** For transfers: the other account. Each transfer is stored as two linked rows. */
  transferAccountId?: string;
  transferPairId?: string;
  /** Notes. */
  memo?: string;
  cleared: boolean;
  /** Flagged for follow-up. A flagged transaction can never be reconciled. */
  flagged?: boolean;
  /** Matched against the bank statement and locked. Editing it asks first. */
  reconciled?: boolean;
  recurringId?: string;
  createdAt: number;
};

/** A merchant you've paid, with the envelope its transactions default to. */
export type Payee = {
  id: string;
  name: string;
  envelopeId?: string;
};

/** Money assigned to (positive) or pulled from (negative) an envelope. */
export type Allocation = {
  id: string;
  date: ISODate;
  envelopeId: string;
  amount: Cents;
  createdAt: number;
};

export type RecurringKind = 'bill' | 'subscription';
export type Frequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

export type Recurring = {
  id: string;
  name: string;
  kind: RecurringKind;
  /** Positive cents. Bills are an estimate and get confirmed each time. */
  amount: Cents;
  accountId: string;
  envelopeId?: string;
  frequency: Frequency;
  nextDue: ISODate;
  active: boolean;
};

export const CASH_KINDS: readonly CashKind[] = ['checking', 'savings', 'cash'];

export function isCashAccount(account: Pick<Account, 'kind'>): boolean {
  return (CASH_KINDS as readonly string[]).includes(account.kind);
}

export function isDebtAccount(account: Pick<Account, 'kind'>): boolean {
  return !isCashAccount(account);
}
