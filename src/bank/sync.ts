import { useEffect } from 'react';
import { AppState } from 'react-native';

import type { BankLink, SyncResult } from '@/domain/bank';
import { useStore } from '@/store';

import { bankApi, BankError } from './api';
import { openPlaidLink } from './plaid-link';

/** Banks refresh a few times a day; checking more often than this only costs time. */
const EVERY_MS = 10 * 60 * 1000;

let running: Promise<void> | null = null;

/**
 * Fetches everything new from one bank. A bank that wants a fresh sign-in is marked so
 * Settings can offer Reconnect; anything else is thrown for the caller to show.
 */
export async function syncBank(linkId: string): Promise<void> {
  const link = useStore.getState().bankLinks.find((l) => l.id === linkId);
  if (!link || !link.accounts.some((a) => a.accountId)) return;
  try {
    const result = await bankApi.sync(link.token, link.cursor);
    useStore.getState().applyBankSync(linkId, result);
  } catch (e) {
    if (e instanceof BankError && (e.code === 'login_required' || e.code === 'item_gone' || e.code === 'other_env')) {
      useStore.getState().updateBankLink(linkId, { needsLogin: true });
      return;
    }
    throw e;
  }
}

/** Syncs every linked bank, skipping ones synced in the last few minutes unless `force`. */
export function syncAllBanks({ force = false } = {}): Promise<void> {
  running ??= (async () => {
    try {
      const now = Date.now();
      for (const link of useStore.getState().bankLinks) {
        if (link.needsLogin && !force) continue;
        if (!force && link.syncedAt && now - link.syncedAt < EVERY_MS) continue;
        await syncBank(link.id).catch(() => {});
      }
    } finally {
      running = null;
    }
  })();
  return running;
}

/** Keeps banks fresh: when the data first loads, and whenever the app comes back to the front. */
export function useBankAutoSync() {
  const linkIds = useStore((s) => s.bankLinks.map((l) => l.id).join(','));
  useEffect(() => {
    if (linkIds) void syncAllBanks();
  }, [linkIds]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncAllBanks();
    });
    return () => sub.remove();
  }, []);
}

/**
 * Plaid's sign-in, then the token swap. The new bank is saved right away with no accounts
 * picked yet, so leaving the setup screen early never loses it. Null if they backed out.
 */
export async function linkNewBank(): Promise<BankLink | null> {
  const { linkToken } = await bankApi.linkToken();
  const publicToken = await openPlaidLink(linkToken);
  if (!publicToken) return null;
  const ex = await bankApi.exchange(publicToken);
  // The same bank login again (Plaid can hand back the same item): keep how its accounts were set up.
  const before = useStore.getState().bankLinks.find((l) => l.id === ex.itemId);
  if (before) {
    const kept = new Map(before.accounts.map((a) => [a.plaidAccountId, a]));
    const relinked: BankLink = {
      ...before,
      token: ex.token,
      institution: ex.institution.name,
      needsLogin: false,
      accounts: ex.accounts.map((a) => ({
        ...kept.get(a.plaidAccountId),
        plaidAccountId: a.plaidAccountId,
        name: a.name,
        ...(a.mask ? { mask: a.mask } : {}),
        type: a.type,
        ...(a.subtype ? { subtype: a.subtype } : {}),
      })),
    };
    useStore.getState().saveBankLink(relinked);
    return relinked;
  }
  const link: BankLink = {
    id: ex.itemId,
    institution: ex.institution.name,
    token: ex.token,
    linkedAt: Date.now(),
    accounts: ex.accounts.map((a) => ({
      plaidAccountId: a.plaidAccountId,
      name: a.name,
      ...(a.mask ? { mask: a.mask } : {}),
      type: a.type,
      ...(a.subtype ? { subtype: a.subtype } : {}),
    })),
  };
  useStore.getState().saveBankLink(link);
  return link;
}

/** Signs back in to a bank that stopped sending. Same link, so no new Plaid slot is used. */
export async function reconnectBank(linkId: string): Promise<boolean> {
  const link = useStore.getState().bankLinks.find((l) => l.id === linkId);
  if (!link) return false;
  const { linkToken } = await bankApi.linkToken(link.token);
  const done = await openPlaidLink(linkToken);
  if (!done) return false;
  useStore.getState().updateBankLink(linkId, { needsLogin: false });
  await syncBank(linkId).catch(() => {});
  return true;
}

/** Stops a bank at Plaid and forgets it here. Your transactions stay. */
export async function unlinkBank(linkId: string): Promise<void> {
  const link = useStore.getState().bankLinks.find((l) => l.id === linkId);
  if (!link) return;
  try {
    await bankApi.remove(link.token);
  } catch (e) {
    // Offline or already gone at Plaid: forget it here anyway; Plaid drops idle links on its own.
    if (!(e instanceof BankError)) throw e;
  }
  useStore.getState().removeBankLink(linkId);
}

/**
 * The first full fetch after linking, waiting a little if Plaid is still pulling the
 * history from the bank. Nothing is applied: setup applies it once accounts are picked.
 */
export async function firstSync(link: BankLink, waitMs = 45000): Promise<SyncResult> {
  const start = Date.now();
  let result = await bankApi.sync(link.token);
  while (!result.ready && Date.now() - start < waitMs) {
    await new Promise((r) => setTimeout(r, 3000));
    result = await bankApi.sync(link.token);
  }
  return result;
}
