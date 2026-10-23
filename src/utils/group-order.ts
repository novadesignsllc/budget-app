import { DEBT_GROUP } from '@/store';

const DEFAULT = ['Bills', 'Everyday', 'Savings'];

/**
 * Budget groups top to bottom: the user's saved order first, then any group they haven't
 * placed yet (Bills, Everyday, Savings, others by name, debt payments last).
 */
export function orderGroups(names: string[], saved: string[] = []): string[] {
  const rank = (g: string) => {
    const i = saved.indexOf(g);
    if (i >= 0) return i;
    if (g === DEBT_GROUP) return 10_000;
    const d = DEFAULT.indexOf(g);
    return 1_000 + (d >= 0 ? d : 50);
  };
  return [...new Set(names)].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}
