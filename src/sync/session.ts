import { useEffect } from 'react';
import { create } from 'zustand';

import { backend } from '@/backend';
import type { SessionUser } from '@/backend/types';
import { resetStore, useStore } from '@/store';

import { startSync } from './engine';
import { useSyncStatus } from './status';

type Session = {
  status: 'loading' | 'signedOut' | 'signedIn';
  user: SessionUser | null;
  /** True once the signed-in user's data has loaded from Firebase (cache or server). */
  dataReady: boolean;
};

export const useSession = create<Session>()(() => ({ status: 'loading', user: null, dataReady: false }));

let stopSync: (() => void) | undefined;

function runSync(user: SessionUser) {
  stopSync?.();
  stopSync = startSync({
    backend,
    uid: user.uid,
    store: useStore,
    status: useSyncStatus.getState(),
    onReady: () => {
      // Older data kept payee memory as a map; move it into the payees list once.
      useStore.getState().migrateMerchantMemory();
      // Groups are fixed now: rename Everyday to Daily and fold custom groups into it.
      useStore.getState().normalizeGroups();
      useSession.setState({ dataReady: true });
    },
  });
}

/**
 * Stops syncing while the account is being deleted, so nothing writes the data back
 * between deleting it and deleting the sign-in. `resumeSync` picks up again if that fails.
 */
export function pauseSync() {
  stopSync?.();
  stopSync = undefined;
}

export function resumeSync() {
  const user = useSession.getState().user;
  if (user && !stopSync) runSync(user);
}

/** Follows Firebase auth and runs sync for whoever is signed in. Mount once, at the root. */
export function useSessionBootstrap() {
  useEffect(() => {
    const unsubscribe = backend.onAuth((user) => {
      pauseSync();
      resetStore();
      useSyncStatus.getState().reset();
      if (!user) {
        useSession.setState({ status: 'signedOut', user: null, dataReady: false });
        return;
      }
      useSession.setState({ status: 'signedIn', user, dataReady: false });
      runSync(user);
    });
    return () => {
      unsubscribe();
      pauseSync();
    };
  }, []);
}
