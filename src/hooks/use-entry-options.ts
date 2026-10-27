import { useMemo } from 'react';

import type { DropdownOption } from '@/components/dropdown';
import { formatDollars, formatMoney } from '@/domain/money';
import { isCashAccount } from '@/domain/types';
import { useAccounts, useLedger } from '@/hooks/use-ledger';
import { useStore } from '@/store';
import { groupColor } from '@/theme';
import { orderGroups } from '@/utils/group-order';

/**
 * The Envelope and Account choices for entering a transaction: envelopes in the Budget's
 * order with what's left in each, then accounts with balances and cards in red.
 */
export function useEntryOptions() {
  const ledger = useLedger();
  const envelopes = useStore((s) => s.envelopes);
  const groupOrder = useStore((s) => s.settings.groupOrder);
  const { all: accounts } = useAccounts();

  const envelopeOptions = useMemo<DropdownOption<string>[]>(() => {
    const listedGroups = orderGroups(
      envelopes.map((e) => e.group),
      groupOrder,
    );
    return envelopes
      .filter((e) => !e.hidden && !e.debtAccountId)
      .sort((a, b) => listedGroups.indexOf(a.group) - listedGroups.indexOf(b.group) || a.order - b.order)
      .map((e) => {
        const left = ledger.available.get(e.id) ?? 0;
        return {
          value: e.id,
          label: e.name,
          dot: groupColor(e.group),
          section: e.group,
          detail: left < 0 ? formatDollars(left) : `${formatDollars(left)} left`,
          tone: left < 0 ? 'negative' : undefined,
        };
      });
  }, [envelopes, groupOrder, ledger]);

  const accountOptions = useMemo<DropdownOption<string>[]>(
    () => [
      ...accounts.filter(isCashAccount).map((a) => ({
        value: a.id,
        label: a.name,
        face: a.order,
        section: 'Accounts',
        detail: formatMoney(ledger.balance.get(a.id) ?? 0),
      })),
      ...accounts
        .filter((a) => !isCashAccount(a))
        .map((a) => ({
          value: a.id,
          label: a.name,
          face: a.order,
          section: 'Cards',
          tone: 'negative' as const,
        })),
    ],
    [accounts, ledger],
  );

  return { envelopeOptions, accountOptions };
}
