import type { Cents } from './types';

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const usdWhole = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

/** $1,234.56. Negative values get a leading minus: -$12.00 */
export function formatMoney(cents: Cents, opts: { whole?: boolean; signed?: boolean } = {}): string {
  const fmt = opts.whole ? usdWhole : usd;
  const text = fmt.format(Math.abs(cents) / 100);
  if (cents < 0) return `-${text}`;
  if (opts.signed && cents > 0) return `+${text}`;
  return text;
}

/**
 * The budget works in whole dollars. Money to assign and money left are rounded down
 * (a few cents always stay unassigned, which is on purpose); spending is rounded up.
 */
export function floorDollars(cents: Cents): Cents {
  return Math.floor(cents / 100) * 100;
}

export function ceilDollars(cents: Cents): Cents {
  return Math.ceil(cents / 100) * 100;
}

/** "$2,179" from 217927. Rounds down unless told to round up. */
export function formatDollars(cents: Cents, round: 'down' | 'up' = 'down'): string {
  return formatMoney(round === 'down' ? floorDollars(cents) : ceilDollars(cents), { whole: true });
}

/** Parses "10.99", "$1,200", "10" into cents. Returns null when there's no number. */
export function parseMoney(input: string): Cents | null {
  const cleaned = input.replace(/[$,\s]/g, '');
  if (!/^-?\d*\.?\d{0,2}$/.test(cleaned) || cleaned === '' || cleaned === '.' || cleaned === '-') {
    return null;
  }
  return Math.round(parseFloat(cleaned) * 100);
}

export function sum(values: Cents[]): Cents {
  return values.reduce((a, b) => a + b, 0);
}
