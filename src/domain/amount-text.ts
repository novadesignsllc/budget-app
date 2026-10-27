/**
 * Money is typed the way YNAB does it: digits fill in from the right, so 4 is $0.04 and
 * 4, 3, 5, 7 is $43.57. Returns plain text like "43.57" (or "" when empty). With
 * `negative`, typing a minus flips the sign.
 */
export function cleanAmount(v: string, negative = false) {
  const minus = negative && (v.match(/-/g)?.length ?? 0) % 2 === 1 ? '-' : '';
  const digits = v.replace(/\D/g, '').replace(/^0+/, '').slice(0, 9);
  // A lone minus waits for digits, so an overdrawn balance can be typed minus-first.
  if (!digits) return minus;
  return minus + (parseInt(digits, 10) / 100).toFixed(2);
}

/** Whole dollars only, for budget amounts like targets: "600". */
export function cleanDollars(v: string) {
  return v.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 7);
}

/** "43.57" as "$43.57", "-12.00" as "-$12.00", with thousands commas. */
export function showAmount(v: string) {
  if (v === '-') return '-$';
  const negative = v.startsWith('-');
  const [whole, cents] = (negative ? v.slice(1) : v).split('.');
  const text = `$${Number(whole || 0).toLocaleString('en-US')}${cents !== undefined ? `.${cents}` : ''}`;
  return negative ? `-${text}` : text;
}

/**
 * What a typed amount on a computer adds up to, in cents: "43.57", "$1,200", "560+40",
 * "25.00 + 12.99 - 5". Whole mode rounds to whole dollars. Null when nothing's typed or
 * it can't be read.
 */
export function typedCents(text: string, mode: 'cents' | 'whole' = 'cents'): number | null {
  const s = text.replace(/[$,%\s]/g, '');
  if (!s) return null;
  if (!/^-?\d*\.?\d*([+-]\d*\.?\d*)*$/.test(s)) return null;
  const parts = s.match(/[+-]?[^+-]+/g) ?? [];
  let total = 0;
  for (const p of parts) {
    const n = Number(p);
    if (!Number.isFinite(n)) return null;
    total += n;
  }
  if (!parts.length) return null;
  return mode === 'whole' ? Math.round(total) * 100 : Math.round(total * 100);
}

/** A typed amount as the field's plain text ("43.57", "600"), or "" when empty or unreadable. */
export function typedText(text: string, mode: 'cents' | 'whole' = 'cents', negative = false): string {
  const cents = typedCents(text, mode);
  if (cents === null) return '';
  const value = negative ? cents : Math.abs(cents);
  return mode === 'cents' ? (value / 100).toFixed(2) : String(Math.trunc(value / 100));
}
