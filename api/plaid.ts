import type { IncomingMessage, ServerResponse } from 'node:http';

import { configFromEnv, handle, HttpError } from './_lib/core';

/**
 * POST /api/plaid with `{ action, ... }` and the user's Firebase ID token as a Bearer
 * header. See `_lib/core.ts` for what each action does.
 */
export default async function handler(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  // The phones call this from the app; the website from its own origin. Neither needs cookies.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: 'bad_request', message: 'Use POST.' }));
    return;
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : ((req.body ?? {}) as Record<string, unknown>);
    const result = await handle(configFromEnv(), req.headers.authorization, body);
    res.statusCode = 200;
    res.end(JSON.stringify(result));
  } catch (e) {
    const err = e instanceof HttpError ? e : new HttpError(500, 'server_error', 'Something went wrong. Try again.');
    if (!(e instanceof HttpError)) console.error(e);
    res.statusCode = err.status;
    res.end(JSON.stringify({ error: err.code, message: err.message }));
  }
}
