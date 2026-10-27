import { useEffect } from 'react';
import { create } from 'zustand';

import { backend } from '@/backend';
import type { SessionUser } from '@/backend/types';
import { resetStore, useStore } from '@/store';

import { startSync } from './engine';
import { listenToProfiles, MAIN_PROFILE, rememberedProfile, rememberProfile, scopeFor, useProfiles } from './profiles';
import { useSyncStatus } from './status';

type Session = {
  status: 'loading' | 'signedOut' | 'signedIn';
  user: SessionUser | null;
  /** True once the signed-in user's data has loaded from Firebase (cache or server). */
  dataReady: boolean;
};

export const useSession = create<Session>()(() => ({ status: 'loading', user: null, dataReady: false }));

let stopSync: (() => void) | undefined;
let stopProfiles: (() => void) | undefined;

function runSync(user: SessionUser) {
  stopSync?.();
  stopSync = startSync({
    backend,
    // The profile you're in decides which budget syncs.
    uid: scopeFor(user.uid, useProfiles.getState().activeId),
    store: useStore,
    status: useSyncStatus.getState(),
    onReady: () => {
      // Older data kept payee memory as a map; move it into the payees list once.
      useStore.getState().migrateMerchantMemory();
      // Groups are fixed now: rename Everyday to Daily and fold custom groups into it.
      useStore.getState().normalizeGroups();
      useSession.setState({ dataReady: true });
      useProfiles.setState({ switching: false });
    },
  });
}

/**
 * Opens another profile: stops syncing the one you're in, clears it from the screen, and
 * loads the other. Nothing is written to either while it switches.
 */
export function switchProfile(profileId: string) {
  const user = useSession.getState().user;
  if (!user || useProfiles.getState().activeId === profileId) return;
  pauseSync();
  resetStore();
  useSyncStatus.getState().reset();
  rememberProfile(user.uid, profileId);
  useProfiles.setState({ activeId: profileId, switching: true });
  runSync(user);
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
      stopProfiles?.();
      stopProfiles = undefined;
      resetStore();
      useSyncStatus.getState().reset();
      if (!user) {
        useProfiles.setState({ activeId: MAIN_PROFILE, switching: false });
        useSession.setState({ status: 'signedOut', user: null, dataReady: false });
        return;
      }
      useProfiles.setState({ activeId: rememberedProfile(user.uid), switching: false });
      stopProfiles = listenToProfiles(user.uid);
      useSession.setState({ status: 'signedIn', user, dataReady: false });
      runSync(user);
    });
    return () => {
      unsubscribe();
      pauseSync();
      stopProfiles?.();
    };
  }, []);
}
