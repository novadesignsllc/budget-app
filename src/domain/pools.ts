import type { Account, Envelope } from './types';

/**
 * Money is budgeted in two pools that match real accounts: spending (checking and cash)
 * pays for Daily, Bills, Subscriptions and debt payments; savings (savings accounts)
 * holds the Savings envelopes. Only used once there is a savings account; before that
 * everything is one pool.
 */
export type Pool = 'spending' | 'savings';

export function accountPool(account: Pick<Account, 'kind'>): Pool {
  return account.kind === 'savings' ? 'savings' : 'spending';
}

export function envelopePool(envelope: Pick<Envelope, 'group'>): Pool {
  return envelope.group === 'Savings' ? 'savings' : 'spending';
}

/** The split only applies when there's a savings account for the Savings envelopes to match. */
export function hasSavingsAccount(accounts: Pick<Account, 'kind' | 'closed'>[]): boolean {
  return accounts.some((a) => a.kind === 'savings' && !a.closed);
}
