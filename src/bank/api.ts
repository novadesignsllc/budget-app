import { backend } from '@/backend';
import type { SyncedAccount, SyncResult } from '@/domain/bank';

/**
 * Slip's own server (api/plaid.ts on Vercel) is the only thing that talks to Plaid. The
 * website calls it on its own address; the phones call the website's.
 */
const BASE = process.env.EXPO_PUBLIC_API_URL ?? (process.env.EXPO_OS === 'web' ? '' : 'https://slip-budget.vercel.app');

export class BankError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  const token = await backend.idToken();
  if (!token) throw new BankError('signed_out', 'Sign in to use bank sync.');
  let res: Response;
  try {
    res = await fetch(`${BASE}/api/plaid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, ...body }),
    });
  } catch {
    throw new BankError('offline', 'No connection. Try again when you’re online.');
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string; message?: string };
  if (!res.ok) throw new BankError(data.error ?? 'server_error', data.message ?? 'Something went wrong. Try again.');
  return data;
}

export type Exchanged = {
  itemId: string;
  token: string;
  institution: { id?: string; name: string };
  accounts: SyncedAccount[];
};

export const bankApi = {
  linkToken: (update?: string) =>
    call<{ linkToken: string }>('link-token', { platform: process.env.EXPO_OS, ...(update ? { update } : {}) }),
  exchange: (publicToken: string) => call<Exchanged>('exchange', { publicToken }),
  sync: (token: string, cursor?: string) => call<SyncResult>('sync', { token, ...(cursor ? { cursor } : {}) }),
  remove: (token: string) => call<{ ok: true }>('remove', { token }),
};
