import type { Cents } from './types';

/**
 * The number pad's math. An expression is digits and operators, like "4357+1000".
 * In `cents` mode each number fills from the right (4357 is $43.57); in `whole` mode
 * numbers are whole dollars (600 is $600). The value is always in cents.
 */
export type KeypadMode = 'cents' | 'whole';
/** How numbers read: dollars, a rate like 24.99%, or a plain count like a day of the month. */
export type KeypadUnit = 'money' | 'percent' | 'number';
export type KeypadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '+' | '-' | '=' | 'back' | 'clear';

const OPS = new Set(['+', '-']);
/** Long enough for $9,999,999.99; anything more is a typo. */
const MAX_DIGITS = 9;

function operands(expr: string): { sign: 1 | -1; digits: string }[] {
  const parts: { sign: 1 | -1; digits: string }[] = [];
  let sign: 1 | -1 = 1;
  let digits = '';
  for (const ch of expr) {
    if (OPS.has(ch)) {
      if (digits) parts.push({ sign, digits });
      digits = '';
      sign = ch === '-' ? -1 : 1;
    } else digits += ch;
  }
  if (digits) parts.push({ sign, digits });
  return parts;
}

/** What the expression adds up to, in cents. Unfinished parts ("12+") count what's there. */
export function keypadValue(expr: string, mode: KeypadMode): Cents {
  return operands(expr).reduce((sum, p) => {
    const n = parseInt(p.digits, 10) || 0;
    return sum + p.sign * (mode === 'cents' ? n : n * 100);
  }, 0);
}

/** True when there's math to work out (shows the "= result" preview). */
export function hasMath(expr: string): boolean {
  return /\d[+-]/.test(expr);
}

/** The expression a value starts from when the pad opens: 4357 for $43.57, 600 for $600. */
export function exprFrom(cents: Cents | null, mode: KeypadMode): string {
  if (!cents) return '';
  const n = mode === 'cents' ? Math.abs(cents) : Math.abs(Math.round(cents / 100));
  return `${cents < 0 ? '-' : ''}${n}`;
}

/**
 * One key press. `fresh` means the pad just opened on an existing value: the first digit
 * replaces it (like selecting the number), while an operator keeps it and adds to it.
 */
export function press(
  expr: string,
  key: KeypadKey,
  mode: KeypadMode,
  opts: { fresh?: boolean; negative?: boolean } = {},
): string {
  if (key === 'clear') return '';
  if (key === 'back') return opts.fresh ? '' : expr.slice(0, -1);
  if (key === '=') return exprFrom(keypadValue(expr, mode), mode);
  if (OPS.has(key)) {
    // A leading minus makes a negative amount, only where that's allowed.
    if (!expr) return key === '-' && opts.negative ? '-' : '';
    const last = expr[expr.length - 1];
    return OPS.has(last) ? expr.slice(0, -1) + key : expr + key;
  }
  const start = opts.fresh ? '' : expr;
  const current = start.split(/[+-]/).pop() ?? '';
  if (current.length >= MAX_DIGITS) return start;
  // A lone 0 is allowed (a $0 balance); a digit after it replaces it, so there are no leading zeros.
  if (current === '0') return start.slice(0, -1) + key;
  return start + key;
}

/** "$43.57 + $10.00", "$600 − $50" in whole dollars, "24.99%" for a rate, "15" for a day. */
export function keypadDisplay(expr: string, mode: KeypadMode, unit: KeypadUnit = 'money'): string {
  const money = (digits: string) => {
    const n = parseInt(digits, 10) || 0;
    const num =
      mode === 'whole'
        ? n.toLocaleString('en-US')
        : (n / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return unit === 'money' ? `$${num}` : unit === 'percent' ? `${num}%` : num;
  };
  let out = '';
  let digits = '';
  const flush = () => {
    if (digits) out += money(digits);
    digits = '';
  };
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (OPS.has(ch)) {
      flush();
      // A minus with nothing before it is the sign of the number, not an operation.
      out += out ? (ch === '-' ? ' − ' : ' + ') : ch === '-' ? '-' : '';
    } else digits += ch;
  }
  flush();
  return out;
}

/** The field's value for an expression: "" when nothing's typed, else "43.57" or "600". */
export function keypadText(expr: string, mode: KeypadMode): string {
  if (!/\d/.test(expr)) return '';
  const cents = keypadValue(expr, mode);
  return mode === 'cents' ? (cents / 100).toFixed(2) : String(Math.trunc(cents / 100));
}

/** The other way: the field's text ("43.57", "600", "-12.00") as cents, or null when empty. */
export function textCents(text: string, mode: KeypadMode): Cents | null {
  if (!text.trim()) return null;
  const n = Number(text.replace(/[$,\s]/g, ''));
  if (!Number.isFinite(n)) return null;
  return mode === 'cents' ? Math.round(n * 100) : Math.round(n) * 100;
}
