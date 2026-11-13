import { demoDocs } from '@/store/demo-data';

import { createFakeBackend } from './fake';
import { setDemoMode } from './mode';
import type { Backend, SessionUser } from './types';

const DEMO_USER: SessionUser = { uid: 'demo', email: null };

/**
 * The demo account: a fake backend that lives only on this device, seeded with six
 * months of history the first time. Nothing here talks to Firebase.
 */
export function createDemoBackend(): Backend {
  const fake = createFakeBackend({ persist: true, latencyMs: 250, namespace: 'demo-v2-' });
  if (!fake.hasData(DEMO_USER.uid)) fake.seed(DEMO_USER.uid, demoDocs());

  return {
    ...fake,
    appleSignInAvailable: false,
    onAuth(cb) {
      const t = setTimeout(() => cb(DEMO_USER), 0);
      return () => clearTimeout(t);
    },
    signInWithEmail: async () => {},
    createAccount: async () => {},
    sendPasswordReset: async () => {},
    signInWithApple: async () => {},
    // The demo never talks to Slip's server, so bank sync stays off.
    idToken: async () => null,
    // Signing out of the demo means leaving it.
    signOut: () => setDemoMode(false),
  };
}
