import 'expo-sqlite/localStorage/install';
import { create } from 'zustand';

/** Budget groups you've folded closed. Kept per device, like light and dark. */
const KEY = 'slip-collapsed-groups';

function saved(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((g) => typeof g === 'string') : [];
  } catch {
    return [];
  }
}

export const useCollapsedGroups = create<{ closed: string[]; toggle: (group: string) => void }>()((set, get) => ({
  closed: saved(),
  toggle: (group) => {
    const closed = get().closed.includes(group) ? get().closed.filter((g) => g !== group) : [...get().closed, group];
    try {
      localStorage.setItem(KEY, JSON.stringify(closed));
    } catch {}
    set({ closed });
  },
}));
