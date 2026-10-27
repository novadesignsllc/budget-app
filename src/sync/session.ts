import { router } from 'expo-router';
import { useEffect } from 'react';
import { create } from 'zustand';


import { backend } from '@/backend';
import type { SessionUser } from '@/backend/types';
import { initialState, resetStore, useStore, type State } from '@/store';

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

/** Each profile's data as last seen this session, so switching back shows it at once. */
const seen = new Map<string, State>();
const DATA_KEYS = Object.keys(initialState) as (keyof State)[];

/**
 * Opens another profile: lands on Home, stops syncing the one you're in, and loads the
 * other. A profile already opened this session appears right away from memory while
 * Firebase catches up; a new one shows a short loading cover. Nothing is written to either
 * while it switches.
 */
export function switchProfile(profileId: string) {
  const user = useSession.getState().user;
  const { activeId } = useProfiles.getState();
  if (!user || activeId === profileId) return;
  router.navigate('/');
  const state = useStore.getState();
  seen.set(activeId, Object.fromEntries(DATA_KEYS.map((k) => [k, state[k]])) as State);
  const cached = seen.get(profileId);
  useProfiles.setState({ activeId: profileId, switching: !cached });
  rememberProfile(user.uid, profileId);
  // Let the tap and the move to Home draw first; then swap the data.
  setTimeout(() => {
    pauseSync();
    useSyncStatus.getState().reset();
    if (cached) useStore.setState(cached);
    else resetStore();
    runSync(user);
  }, 0);
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
      seen.clear();
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
