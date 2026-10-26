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
