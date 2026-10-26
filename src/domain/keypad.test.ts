import { describe, expect, it } from '@jest/globals';

import { exprFrom, hasMath, keypadDisplay, keypadText, keypadValue, press, textCents, type KeypadKey } from './keypad';

const type = (keys: string, mode: 'cents' | 'whole' = 'cents', opts: { fresh?: boolean; negative?: boolean } = {}) => {
  let expr = '';
  let fresh = opts.fresh ?? false;
  for (const k of keys.split(' ')) {
    expr = press(expr, k as KeypadKey, mode, { ...opts, fresh });
    fresh = false;
  }
  return expr;
};

describe('keypad', () => {
  it('fills cents from the right like YNAB', () => {
    expect(keypadValue(type('4'), 'cents')).toBe(4);
    expect(keypadValue(type('4 3 5 7'), 'cents')).toBe(4357);
    expect(keypadDisplay(type('4 3 5 7'), 'cents')).toBe('$43.57');
  });
  it('adds and subtracts', () => {
    const e = type('4 3 5 7 + 1 0 0 0');
    expect(keypadDisplay(e, 'cents')).toBe('$43.57 + $10.00');
    expect(hasMath(e)).toBe(true);
    expect(keypadValue(e, 'cents')).toBe(5357);
    expect(keypadValue(type('6 0 0 - 5 0', 'whole'), 'whole')).toBe(55000);
  });
  it('equals works the result out and keeps going', () => {
    const e = type('6 0 0 - 5 0 =', 'whole');
    expect(e).toBe('550');
    expect(keypadDisplay(press(e, '+', 'whole'), 'whole')).toBe('$550 + ');
  });
  it('swaps an operator instead of stacking two', () => {
    expect(type('5 + -')).toBe('5-');
  });
  it('only allows a leading minus where negatives are allowed', () => {
    expect(type('- 5')).toBe('5');
    expect(keypadValue(type('- 1 2 0 0', 'cents', { negative: true }), 'cents')).toBe(-1200);
    expect(keypadDisplay('-1200', 'cents')).toBe('-$12.00');
  });
  it('starts over on the first digit after opening, but adds to it with an operator', () => {
    expect(press('600', '5', 'whole', { fresh: true })).toBe('5');
    expect(press('600', '+', 'whole', { fresh: true })).toBe('600+');
  });
  it('round-trips a value', () => {
    expect(exprFrom(4357, 'cents')).toBe('4357');
    expect(exprFrom(60000, 'whole')).toBe('600');
    expect(exprFrom(-1200, 'cents')).toBe('-1200');
    expect(exprFrom(0, 'cents')).toBe('');
  });
  it('lets you type a $0 amount', () => {
    expect(type('0')).toBe('0');
    expect(keypadText(type('0'), 'cents')).toBe('0.00');
    expect(keypadText('', 'cents')).toBe('');
    expect(keypadText(type('6 0 0', 'whole'), 'whole')).toBe('600');
    expect(textCents('43.57', 'cents')).toBe(4357);
    expect(textCents('600', 'whole')).toBe(60000);
  });
  it('deletes, clears, and ignores leading zeros', () => {
    expect(type('1 2 back')).toBe('1');
    expect(type('1 2 clear')).toBe('');
    expect(type('0 0 5')).toBe('5');
  });
});
