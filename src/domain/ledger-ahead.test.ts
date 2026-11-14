import { describe, expect, it } from '@jest/globals';

import { budgetHealth } from './health';
import { computeLedger } from './ledger';
import { computeMonth } from './months';
import type { Account, Allocation, Envelope } from './types';

const accounts: Account[] = [{ id: 'c', name: 'Checking', kind: 'checking', openingBalance: 100000, openedOn: '2026-10-01', order: 0 }];
const envelopes: Envelope[] = [{ id: 'leads', name: 'Leads', group: 'Daily', order: 0 }];
const allocations: Allocation[] = [
  { id: 'a', date: '2026-11-03', envelopeId: 'leads', amount: 50000, createdAt: 1 },
  // Budgeted ahead for December.
  { id: 'b', date: '2026-12-01', envelopeId: 'leads', amount: 50000, createdAt: 1 },
];

describe('money assigned to next month', () => {
  const input = { accounts, envelopes, transactions: [], allocations, asOf: '2026-11-14' };

  it('is not in the envelope yet, and the picker agrees with the Budget page', () => {
    const ledger = computeLedger(input);
    const nov = computeMonth(input, '2026-11');
    expect(ledger.available.get('leads')).toBe(50000);
    expect(ledger.available.get('leads')).toBe(nov.envelopes.get('leads')!.available);
    expect(ledger.assignedAhead).toBe(50000);
  });

  it('still leaves the same Ready to assign, and still counts as promised', () => {
    const ledger = computeLedger(input);
    expect(ledger.readyToAssign).toBe(computeMonth(input, '2026-11').readyToAssign);
    expect(ledger.readyToAssign).toBe(0);
    expect(budgetHealth(ledger).short).toBe(0);
  });
});
