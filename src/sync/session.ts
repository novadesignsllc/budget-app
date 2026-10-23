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

/** Follows Firebase auth and runs sync for whoever is signed in. Mount once, at the root. */
export function useSessionBootstrap() {
  useEffect(() => {
    let stopSync: (() => void) | undefined;
    const unsubscribe = backend.onAuth((user) => {
      stopSync?.();
      stopSync = undefined;
      resetStore();
      useSyncStatus.getState().reset();
      if (!user) {
        useSession.setState({ status: 'signedOut', user: null, dataReady: false });
        return;
      }
      useSession.setState({ status: 'signedIn', user, dataReady: false });
      stopSync = startSync({
        backend,
        uid: user.uid,
        store: useStore,
        status: useSyncStatus.getState(),
        onReady: () => {
          // Older data kept payee memory as a map; move it into the payees list once.
          useStore.getState().migrateMerchantMemory();
          useSession.setState({ dataReady: true });
        },
      });
    });
    return () => {
      unsubscribe();
      stopSync?.();
    };
  }, []);
}
