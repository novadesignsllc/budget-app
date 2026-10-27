import { create } from 'zustand';

import { backend } from '@/backend';
import type { Unsubscribe } from '@/backend/types';
import { ACCENTS, useAccent } from '@/theme';

/**
 * Profiles: up to three completely separate budgets in one account (accounts, envelopes,
 * debts, recurring, everything). The first profile ("main") is the data that was always
 * there, at users/{uid}/…; each other profile lives at users/{uid}/profiles/{id}/….
 * The list itself (names, icons, colors) is users/{uid}/profiles/{id}.
 */
export type Profile = { id: string; name: string; emoji: string; color: string; order: number };

export const MAIN_PROFILE = 'main';
export const MAX_PROFILES = 3;

const MAIN_DEFAULT: Profile = { id: MAIN_PROFILE, name: 'Personal', emoji: '🏠', color: ACCENTS[0].hex, order: 0 };

type ProfilesState = {
  list: Profile[];
  activeId: string;
  /** True while a newly picked profile's data is loading. */
  switching: boolean;
};

export const useProfiles = create<ProfilesState>()(() => ({
  list: [MAIN_DEFAULT],
  activeId: MAIN_PROFILE,
  switching: false,
}));

/** Where a profile's data lives, as the backend's scope. */
export function scopeFor(uid: string, profileId: string): string {
  return profileId === MAIN_PROFILE ? uid : `${uid}/profiles/${profileId}`;
}

export function activeProfile(): Profile {
  const { list, activeId } = useProfiles.getState();
  return list.find((p) => p.id === activeId) ?? list[0] ?? MAIN_DEFAULT;
}

// The last profile used on this device, so the app reopens where you left it.
const storageKey = (uid: string) => `slip-profile:${uid}`;
export function rememberedProfile(uid: string): string {
  try {
    return localStorage.getItem(storageKey(uid)) ?? MAIN_PROFILE;
  } catch {
    return MAIN_PROFILE;
  }
}
export function rememberProfile(uid: string, profileId: string) {
  try {
    localStorage.setItem(storageKey(uid), profileId);
  } catch {}
}

/** Keeps the profile list in step with Firebase. The first profile shows even before it's been named. */
export function listenToProfiles(uid: string): Unsubscribe {
  return backend.listen(
    uid,
    'profiles',
    (docs) => {
      const saved = docs.map((d) => ({ ...MAIN_DEFAULT, ...(d as unknown as Partial<Profile>), id: d.id }) as Profile);
      const list = [...(saved.some((p) => p.id === MAIN_PROFILE) ? [] : [MAIN_DEFAULT]), ...saved].sort(
        (a, b) => a.order - b.order,
      );
      useProfiles.setState({ list: list.slice(0, MAX_PROFILES) });
    },
    () => {},
  );
}

/** Adds or updates a profile's name, icon and color. */
export function saveProfile(uid: string, profile: Profile) {
  return backend.commit(uid, [{ collection: 'profiles', id: profile.id, data: { ...profile } }]);
}

export function newProfileId(): string {
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// The accent follows whichever profile you're in.
useProfiles.subscribe((s) => {
  const color = (s.list.find((p) => p.id === s.activeId) ?? s.list[0])?.color ?? ACCENTS[0].hex;
  if (useAccent.getState().accent !== color) useAccent.setState({ accent: color });
});

/**
 * Every document in one profile, read once from the server (for deleting an account).
 * Waits for the server's copy, not just this device's cache, so nothing is missed.
 */
export function readScopeOnce(scope: string, collections: readonly string[], timeoutMs = 15000) {
  return Promise.all(
    collections.map(
      (name) =>
        new Promise<{ collection: string; ids: string[] }>((resolve, reject) => {
          let unsub: Unsubscribe | undefined;
          const timer = setTimeout(() => {
            unsub?.();
            reject(new Error('timeout'));
          }, timeoutMs);
          unsub = backend.listen(
            scope,
            name,
            (docs, meta) => {
              if (meta.fromCache) return;
              clearTimeout(timer);
              unsub?.();
              resolve({ collection: name, ids: docs.map((d) => d.id) });
            },
            (e) => {
              clearTimeout(timer);
              reject(e);
            },
          );
        }),
    ),
  );
}
