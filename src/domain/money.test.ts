import { describe, expect, it } from '@jest/globals';

import { ceilDollars, floorDollars, formatDollars } from './money';

describe('whole dollars', () => {
  it('rounds money to assign and money left down', () => {
    expect(floorDollars(217927)).toBe(217900);
    expect(floorDollars(456992)).toBe(456900);
    expect(floorDollars(-2450)).toBe(-2500);
    expect(formatDollars(217927)).toBe('$2,179');
  });

  it('rounds spending up', () => {
    expect(ceilDollars(39231)).toBe(39300);
    expect(ceilDollars(39200)).toBe(39200);
    expect(formatDollars(39231, 'up')).toBe('$393');
  });
});
