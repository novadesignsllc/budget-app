import type { DocData } from './types';

/** Firestore rejects `undefined` values, so drop them before writing. */
export function clean(data: DocData): DocData {
  return JSON.parse(JSON.stringify(data)) as DocData;
}

export const BATCH_LIMIT = 450;

export function chunks<T>(items: T[], size = BATCH_LIMIT): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
