import { create } from 'zustand';

/**
 * What the sync indicator shows.
 * - syncing: changes are on the device and on their way to Firebase
 * - waiting: still not confirmed after a few seconds, almost always no signal
 * - synced: Firebase confirmed everything; shown briefly, then hidden
 * - error: Firebase refused a write (rules, auth)
 */
export type SyncPhase = 'idle' | 'syncing' | 'waiting' | 'synced' | 'error';

const WAITING_AFTER_MS = 4000;
const SYNCED_VISIBLE_MS = 1400;

type SyncStatus = {
  phase: SyncPhase;
  pending: number;
  begin: () => void;
  end: () => void;
  fail: (error: unknown) => void;
  reset: () => void;
};

let waitingTimer: ReturnType<typeof setTimeout> | undefined;
let hideTimer: ReturnType<typeof setTimeout> | undefined;

export const useSyncStatus = create<SyncStatus>()((set, get) => ({
  phase: 'idle',
  pending: 0,

  begin: () => {
    clearTimeout(hideTimer);
    const first = get().pending === 0;
    set((s) => ({ pending: s.pending + 1, phase: s.phase === 'waiting' ? 'waiting' : 'syncing' }));
    if (first) {
      clearTimeout(waitingTimer);
      waitingTimer = setTimeout(() => {
        if (get().pending > 0) set({ phase: 'waiting' });
      }, WAITING_AFTER_MS);
    }
  },

  end: () => {
    const pending = Math.max(0, get().pending - 1);
    if (pending > 0) return set({ pending });
    clearTimeout(waitingTimer);
    set({ pending: 0, phase: get().phase === 'error' ? 'error' : 'synced' });
    hideTimer = setTimeout(() => {
      if (get().pending === 0 && get().phase === 'synced') set({ phase: 'idle' });
    }, SYNCED_VISIBLE_MS);
  },

  fail: (error) => {
    console.warn('[sync] write failed', error);
    clearTimeout(waitingTimer);
    set((s) => ({ pending: Math.max(0, s.pending - 1), phase: 'error' }));
  },

  reset: () => {
    clearTimeout(waitingTimer);
    clearTimeout(hideTimer);
    set({ phase: 'idle', pending: 0 });
  },
}));
