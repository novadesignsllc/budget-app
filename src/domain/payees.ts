import { normalizePayee } from './quick-add';
import type { Payee } from './types';

/** Payees as the quick-add parser's memory: normalized name to default envelope. */
export function payeeMemory(payees: Payee[]): Record<string, string> {
  const memory: Record<string, string> = {};
  for (const p of payees) if (p.envelopeId && !p.income) memory[normalizePayee(p.name)] = p.envelopeId;
  return memory;
}

/** Payees set to always go to Ready to assign, by normalized name. */
export function incomePayees(payees: Payee[]): Set<string> {
  return new Set(payees.filter((p) => p.income).map((p) => normalizePayee(p.name)));
}

export function findPayee(payees: Payee[], name: string): Payee | undefined {
  const key = normalizePayee(name);
  return key ? payees.find((p) => normalizePayee(p.name) === key) : undefined;
}
