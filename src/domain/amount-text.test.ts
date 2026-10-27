import { describe, expect, it } from '@jest/globals';

import { typedCents, typedText } from './amount-text';

describe('typed amounts (desktop)', () => {
  it('reads plain amounts with or without a dollar sign and commas', () => {
    expect(typedCents('43.57')).toBe(4357);
    expect(typedCents('$1,200')).toBe(120000);
    expect(typedCents('43')).toBe(4300);
    expect(typedCents('.5')).toBe(50);
  });
  it('does math', () => {
    expect(typedCents('560+40', 'whole')).toBe(60000);
    expect(typedCents('25.00 + 12.99 - 5')).toBe(3299);
    expect(typedCents('12+')).toBe(1200);
  });
  it('rounds whole mode to dollars', () => {
    expect(typedCents('599.60', 'whole')).toBe(60000);
  });
  it('reads rates and days', () => {
    expect(typedText('24.99%')).toBe('24.99');
    expect(typedText('15', 'whole')).toBe('15');
  });
  it('returns nothing for empty or unreadable text', () => {
    expect(typedCents('')).toBeNull();
    expect(typedCents('abc')).toBeNull();
    expect(typedText('abc')).toBe('');
  });
  it('drops the sign unless negatives are allowed', () => {
    expect(typedText('-12')).toBe('12.00');
    expect(typedText('-12', 'cents', true)).toBe('-12.00');
  });
});
