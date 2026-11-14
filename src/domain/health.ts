import type { Ledger } from './ledger';
import type { Cents } from './types';

export type BudgetHealth = {
  /** Cash in checking, savings and cash accounts. */
  cash: Cents;
  /** Everything sitting in envelopes, debt payment envelopes included. */
  assigned: Cents;
  /** How far cash falls short of what's assigned. Anything above zero is urgent. */
  short: Cents;
};

/**
 * Envelopes can promise more than the accounts hold (assigning money you don't have, or
 * a balance adjustment that took cash away). When that happens the budget isn't real
 * anymore, so it's the one thing Home shouts about. Card slips never cause it: they move
 * money between envelopes and leave cash alone.
 */
export function budgetHealth(ledger: Pick<Ledger, 'cashTotal' | 'available'> & { assignedAhead?: Cents }): BudgetHealth {
  // Money assigned ahead is promised too.
  let assigned = ledger.assignedAhead ?? 0;
  for (const v of ledger.available.values()) assigned += v;
  return { cash: ledger.cashTotal, assigned, short: Math.max(0, assigned - ledger.cashTotal) };
}
