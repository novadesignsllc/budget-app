import { router } from 'expo-router';
import { useMemo } from 'react';

import { ceilDollars } from '@/domain/money';
import type { BudgetMonth } from '@/domain/months';
import { accountPool, envelopePool, type Pool } from '@/domain/pools';
import { isCashAccount, type Account, type Cents, type Envelope } from '@/domain/types';
import { useAccounts, useLedger } from '@/hooks/use-ledger';

export type PoolView = {
  pool: Pool;
  readyToAssign: Cents;
  /** "SoFi Checking", or "2 accounts" when the pool has several. */
  accountsLabel: string;
  /** Where money for this pool lives: its account with the most in it. */
  primary?: Account;
};

const OTHER: Record<Pool, Pool> = { spending: 'savings', savings: 'spending' };

/**
 * Spending and savings for one budget month, with the accounts behind each, or null when
 * there's no savings account (one pool). Also how much an envelope can draw on.
 */
export function usePools(budget: BudgetMonth) {
  const { all } = useAccounts();
  const ledger = useLedger();
  return useMemo(() => {
    const cash = all.filter(isCashAccount);
    const view = (pool: Pool): PoolView => {
      const mine = cash.filter((a) => accountPool(a) === pool);
      const primary = [...mine].sort((a, b) => (ledger.balance.get(b.id) ?? 0) - (ledger.balance.get(a.id) ?? 0))[0];
      return {
        pool,
        readyToAssign: budget.pools?.[pool].readyToAssign ?? budget.readyToAssign,
        accountsLabel: mine.length === 1 ? mine[0].name : `${mine.length} accounts`,
        primary,
      };
    };
    const pools = budget.pools ? { spending: view('spending'), savings: view('savings') } : null;
    /** What an envelope can be given from: its pool's Ready to assign, or the one total. */
    const readyFor = (e: Pick<Envelope, 'group'>) => (pools ? pools[envelopePool(e)].readyToAssign : budget.readyToAssign);
    return { pools, readyFor };
  }, [all, ledger, budget]);
}

/** What to move to cover a short pool: the shortfall rounded up to whole dollars, so it lands at $0 or a little over. */
export function moveToCover(view: PoolView): Cents {
  return ceilDollars(-view.readyToAssign);
}

/** Opens a transfer that covers a short pool from the other one, amount filled in. */
export function coverShortfall(pools: Record<Pool, PoolView>, short: Pool) {
  const to = pools[short].primary;
  const from = pools[OTHER[short]].primary;
  const amount = (moveToCover(pools[short]) / 100).toFixed(2);
  router.push({ pathname: '/transfer', params: { from: from?.id, to: to?.id, amount } });
}

export const POOL_NAME: Record<Pool, string> = { spending: 'Spending', savings: 'Savings' };
/** "from checking" / "from savings", for group headings. */
export const POOL_SOURCE: Record<Pool, string> = { spending: 'from checking', savings: 'from savings' };
