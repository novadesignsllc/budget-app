/**
 * Bank sync's server side: the only place that holds the Plaid secret.
 *
 * Plaid's access tokens are encrypted here (AES-256-GCM, key in PLAID_TOKEN_KEY) and handed
 * to the app, which keeps them in the user's own Firestore data. A token is only useful
 * together with the Plaid secret, and each one is sealed to the Firebase user it was made
 * for, so the server stays stateless and never needs database access.
 */
import { createCipheriv, createDecipheriv, createVerify, randomBytes } from 'node:crypto';

const FIREBASE_PROJECT = 'zero-budget-adfe6';
const CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

export type PlaidEnv = 'sandbox' | 'production';

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export type Config = {
  env: PlaidEnv;
  clientId: string;
  secret: string;
  tokenKey: Buffer;
  /** OAuth banks: the redirect page registered in Plaid's dashboard (web and iPhone). */
  redirectUri?: string;
  /** OAuth banks on Android: the package name registered in Plaid's dashboard. */
  androidPackage?: string;
  /** Local testing only: skip Firebase and act as this user. Never set on Vercel. */
  devUid?: string;
};

export function configFromEnv(env: NodeJS.ProcessEnv = process.env): Config {
  const plaidEnv: PlaidEnv = env.PLAID_ENV === 'production' ? 'production' : 'sandbox';
  const secret = plaidEnv === 'production' ? env.PLAID_SECRET : (env.PLAID_SANDBOX_SECRET ?? env.PLAID_SECRET);
  const key = env.PLAID_TOKEN_KEY ? Buffer.from(env.PLAID_TOKEN_KEY, 'base64') : null;
  if (!env.PLAID_CLIENT_ID || !secret || !key || key.length !== 32) {
    throw new HttpError(500, 'not_configured', 'Bank sync isn’t set up on the server.');
  }
  return {
    env: plaidEnv,
    clientId: env.PLAID_CLIENT_ID,
    secret,
    tokenKey: key,
    redirectUri: env.PLAID_REDIRECT_URI || undefined,
    androidPackage: env.PLAID_ANDROID_PACKAGE || undefined,
    devUid: plaidEnv === 'sandbox' ? env.PLAID_DEV_UID || undefined : undefined,
  };
}

// ---------------------------------------------------------------------------------------
// Firebase sign-in

let certs: { pems: Record<string, string>; until: number } | null = null;

async function googleCerts(): Promise<Record<string, string>> {
  if (certs && certs.until > Date.now()) return certs.pems;
  const res = await fetch(CERTS_URL);
  if (!res.ok) throw new HttpError(503, 'auth_unavailable', 'Couldn’t check your sign-in. Try again.');
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get('cache-control') ?? '')?.[1] ?? 3600);
  certs = { pems: (await res.json()) as Record<string, string>, until: Date.now() + maxAge * 1000 };
  return certs.pems;
}

function b64urlJson(part: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
}

/** Checks a Firebase ID token the way Firebase's own SDK does and returns the user's id. */
export async function verifyFirebaseToken(token: string, config: Config): Promise<string> {
  if (config.devUid) return config.devUid;
  const parts = token.split('.');
  if (parts.length !== 3) throw new HttpError(401, 'signed_out', 'Sign in again.');
  const [h, p, sig] = parts;
  let header: Record<string, unknown>;
  let payload: Record<string, unknown>;
  try {
    header = b64urlJson(h);
    payload = b64urlJson(p);
  } catch {
    throw new HttpError(401, 'signed_out', 'Sign in again.');
  }
  const pems = await googleCerts();
  const pem = typeof header.kid === 'string' ? pems[header.kid] : undefined;
  const now = Math.floor(Date.now() / 1000);
  const valid =
    header.alg === 'RS256' &&
    !!pem &&
    payload.aud === FIREBASE_PROJECT &&
    payload.iss === `https://securetoken.google.com/${FIREBASE_PROJECT}` &&
    typeof payload.exp === 'number' &&
    payload.exp > now &&
    typeof payload.iat === 'number' &&
    payload.iat <= now + 60 &&
    typeof payload.sub === 'string' &&
    payload.sub.length > 0 &&
    createVerify('RSA-SHA256').update(`${h}.${p}`).verify(pem, Buffer.from(sig, 'base64url'));
  if (!valid) throw new HttpError(401, 'signed_out', 'Sign in again.');
  return payload.sub as string;
}

// ---------------------------------------------------------------------------------------
// Sealed access tokens

export function seal(accessToken: string, uid: string, config: Config): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', config.tokenKey, iv);
  const body = Buffer.concat([cipher.update(JSON.stringify({ u: uid, t: accessToken, e: config.env }), 'utf8'), cipher.final()]);
  return 'v1.' + Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url');
}

export function unseal(sealed: unknown, uid: string, config: Config): string {
  if (typeof sealed !== 'string' || !sealed.startsWith('v1.')) throw new HttpError(400, 'bad_token', 'This bank link is broken. Link it again.');
  try {
    const raw = Buffer.from(sealed.slice(3), 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', config.tokenKey, raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    const data = JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8'));
    if (data.u !== uid) throw new Error('other user');
    if (data.e !== config.env) throw new HttpError(409, 'other_env', 'This bank was linked in test mode. Link it again.');
    return data.t as string;
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(400, 'bad_token', 'This bank link is broken. Link it again.');
  }
}

// ---------------------------------------------------------------------------------------
// Plaid

type PlaidError = { error_code?: string; error_message?: string; display_message?: string | null };

async function plaid<T>(config: Config, path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`https://${config.env}.plaid.com/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Plaid-Version': '2020-09-14' },
    body: JSON.stringify({ client_id: config.clientId, secret: config.secret, ...body }),
  });
  const data = (await res.json()) as T & PlaidError;
  if (!res.ok) {
    const code = data.error_code ?? 'plaid_error';
    if (code === 'ITEM_LOGIN_REQUIRED' || code === 'PENDING_EXPIRATION' || code === 'ACCESS_NOT_GRANTED') {
      throw new HttpError(409, 'login_required', 'Your bank wants you to sign in again.');
    }
    if (code === 'ITEM_NOT_FOUND' || code === 'INVALID_ACCESS_TOKEN') {
      throw new HttpError(410, 'item_gone', 'This bank isn’t linked anymore. Link it again.');
    }
    if (code === 'TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION') throw new HttpError(409, 'retry_sync', code);
    if (code === 'PRODUCT_NOT_READY') throw new HttpError(409, 'not_ready', 'Your bank is still sending transactions.');
    throw new HttpError(502, code, data.display_message || data.error_message || 'The bank connection failed. Try again.');
  }
  return data;
}

type PlaidAccount = {
  account_id: string;
  name: string;
  official_name?: string | null;
  mask?: string | null;
  type: string;
  subtype?: string | null;
  balances: { current: number | null; available: number | null; limit: number | null };
};

type PlaidTransaction = {
  transaction_id: string;
  account_id: string;
  amount: number;
  date: string;
  authorized_date?: string | null;
  name: string;
  merchant_name?: string | null;
  pending: boolean;
  pending_transaction_id?: string | null;
  personal_finance_category?: { primary?: string } | null;
};

/** What the app gets for one bank account. Money is integer cents, as Plaid reports it. */
export type BankAccountOut = {
  plaidAccountId: string;
  name: string;
  mask?: string;
  type: string;
  subtype?: string;
  /** Plaid's current balance in cents: posted money for bank accounts, what's owed for cards and loans. */
  current?: number;
  available?: number;
  limit?: number;
};

/** One transaction. `amount` is already in Slip's sign: negative leaves the account. */
export type BankTxnOut = {
  id: string;
  plaidAccountId: string;
  date: string;
  name: string;
  merchant?: string;
  amount: number;
  pending: boolean;
  pendingId?: string;
  category?: string;
};

const cents = (n: number | null | undefined) => (typeof n === 'number' ? Math.round(n * 100) : undefined);

function accountOut(a: PlaidAccount): BankAccountOut {
  return {
    plaidAccountId: a.account_id,
    name: a.official_name || a.name,
    mask: a.mask ?? undefined,
    type: a.type,
    subtype: a.subtype ?? undefined,
    current: cents(a.balances.current),
    available: cents(a.balances.available),
    limit: cents(a.balances.limit),
  };
}

function txnOut(t: PlaidTransaction): BankTxnOut {
  return {
    id: t.transaction_id,
    plaidAccountId: t.account_id,
    // A pending card charge carries the day it was made; that's the day you'd enter it.
    date: t.pending ? (t.authorized_date ?? t.date) : t.date,
    name: t.name,
    merchant: t.merchant_name ?? undefined,
    // Plaid counts money leaving an account as positive. Slip counts it as negative.
    amount: -Math.round(t.amount * 100),
    pending: t.pending,
    pendingId: t.pending_transaction_id ?? undefined,
    category: t.personal_finance_category?.primary ?? undefined,
  };
}

const ANDROID_PLATFORMS = new Set(['android']);

export async function createLinkToken(
  config: Config,
  uid: string,
  input: { platform?: unknown; update?: unknown },
): Promise<{ linkToken: string; expiration: string }> {
  const update = input.update ? unseal(input.update, uid, config) : undefined;
  const android = typeof input.platform === 'string' && ANDROID_PLATFORMS.has(input.platform);
  const body: Record<string, unknown> = {
    client_name: 'Slip',
    language: 'en',
    country_codes: ['US'],
    user: { client_user_id: uid },
    ...(update ? { access_token: update } : { products: ['transactions'], transactions: { days_requested: 30 } }),
    ...(android && config.androidPackage ? { android_package_name: config.androidPackage } : {}),
    ...(!android && config.redirectUri ? { redirect_uri: config.redirectUri } : {}),
  };
  const data = await plaid<{ link_token: string; expiration: string }>(config, 'link/token/create', body);
  return { linkToken: data.link_token, expiration: data.expiration };
}

export async function exchange(
  config: Config,
  uid: string,
  input: { publicToken?: unknown },
): Promise<{ itemId: string; token: string; institution: { id?: string; name: string }; accounts: BankAccountOut[] }> {
  if (typeof input.publicToken !== 'string') throw new HttpError(400, 'bad_request', 'Missing the public token.');
  const ex = await plaid<{ access_token: string; item_id: string }>(config, 'item/public_token/exchange', {
    public_token: input.publicToken,
  });
  const acc = await plaid<{ accounts: PlaidAccount[]; item: { institution_id?: string | null } }>(config, 'accounts/get', {
    access_token: ex.access_token,
  });
  let name = 'Your bank';
  const institutionId = acc.item.institution_id ?? undefined;
  if (institutionId) {
    try {
      const inst = await plaid<{ institution: { name: string } }>(config, 'institutions/get_by_id', {
        institution_id: institutionId,
        country_codes: ['US'],
      });
      name = inst.institution.name;
    } catch {
      // The name is only for showing; the link works without it.
    }
  }
  return {
    itemId: ex.item_id,
    token: seal(ex.access_token, uid, config),
    institution: { id: institutionId, name },
    accounts: acc.accounts.map(accountOut),
  };
}

export async function syncTransactions(
  config: Config,
  uid: string,
  input: { token?: unknown; cursor?: unknown },
): Promise<{
  added: BankTxnOut[];
  modified: BankTxnOut[];
  removed: string[];
  cursor: string;
  ready: boolean;
  accounts: BankAccountOut[];
}> {
  const accessToken = unseal(input.token, uid, config);
  const start = typeof input.cursor === 'string' && input.cursor ? input.cursor : undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    let cursor = start;
    const added: PlaidTransaction[] = [];
    const modified: PlaidTransaction[] = [];
    const removed: string[] = [];
    let status = '';
    try {
      for (let page = 0; page < 25; page++) {
        const data = await plaid<{
          added: PlaidTransaction[];
          modified: PlaidTransaction[];
          removed: { transaction_id: string }[];
          next_cursor: string;
          has_more: boolean;
          transactions_update_status?: string;
        }>(config, 'transactions/sync', { access_token: accessToken, count: 500, ...(cursor ? { cursor } : {}) });
        added.push(...data.added);
        modified.push(...data.modified);
        removed.push(...data.removed.map((r) => r.transaction_id));
        cursor = data.next_cursor;
        status = data.transactions_update_status ?? status;
        if (!data.has_more) break;
      }
    } catch (e) {
      if (e instanceof HttpError && e.code === 'retry_sync') continue;
      throw e;
    }
    const acc = await plaid<{ accounts: PlaidAccount[] }>(config, 'accounts/get', { access_token: accessToken });
    return {
      added: added.map(txnOut),
      modified: modified.map(txnOut),
      removed,
      cursor: cursor ?? '',
      // Right after linking, Plaid can still be fetching the first batch from the bank.
      ready: status !== 'NOT_READY',
      accounts: acc.accounts.map(accountOut),
    };
  }
  throw new HttpError(503, 'busy', 'Your bank is busy. Try again in a minute.');
}

export async function removeItem(config: Config, uid: string, input: { token?: unknown }): Promise<{ ok: true }> {
  const accessToken = unseal(input.token, uid, config);
  try {
    await plaid(config, 'item/remove', { access_token: accessToken });
  } catch (e) {
    // Already gone at Plaid is fine.
    if (!(e instanceof HttpError && e.code === 'item_gone')) throw e;
  }
  return { ok: true };
}

/** Routes one request. `authorization` is the "Bearer <Firebase ID token>" header. */
export async function handle(
  config: Config,
  authorization: string | undefined,
  body: Record<string, unknown>,
): Promise<unknown> {
  const idToken = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!idToken && !config.devUid) throw new HttpError(401, 'signed_out', 'Sign in again.');
  const uid = await verifyFirebaseToken(idToken, config);
  switch (body.action) {
    case 'link-token':
      return createLinkToken(config, uid, body);
    case 'exchange':
      return exchange(config, uid, body);
    case 'sync':
      return syncTransactions(config, uid, body);
    case 'remove':
      return removeItem(config, uid, body);
    case 'env':
      return { env: config.env };
    default:
      throw new HttpError(400, 'bad_request', 'Unknown action.');
  }
}
