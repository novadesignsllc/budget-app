import { initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  getAuth,
  OAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  collection,
  doc,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  waitForPendingWrites,
  writeBatch,
} from 'firebase/firestore';

import { createDemoBackend } from './demo';
import { fakeBackend } from './fake';
import { chunks, clean } from './firestore-shared';
import { isDemoMode } from './mode';
import type { Backend } from './types';

/**
 * Sign in with Apple on the web goes through a popup and needs the Apple web setup in the
 * Firebase console (a Services ID), so it's switched on once that's done.
 */
const webApple = process.env.EXPO_PUBLIC_WEB_APPLE_SIGN_IN === '1';

function appleProvider() {
  const provider = new OAuthProvider('apple.com');
  provider.addScope('email');
  return provider;
}

function createWebBackend(): Backend {
  const app = initializeApp({
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  });
  const auth = getAuth(app);
  const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });

  return {
    onAuth: (cb) => onAuthStateChanged(auth, (u) => cb(u ? { uid: u.uid, email: u.email } : null)),
    signInWithEmail: async (email, password) => {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    },
    createAccount: async (email, password) => {
      await createUserWithEmailAndPassword(auth, email.trim(), password);
    },
    sendPasswordReset: (email) => sendPasswordResetEmail(auth, email.trim()),
    appleSignInAvailable: webApple,
    signInWithApple: async () => {
      await signInWithPopup(auth, appleProvider());
    },
    signOut: () => signOut(auth),
    signInMethod: () => {
      const providers = auth.currentUser?.providerData.map((p) => p.providerId) ?? [];
      return providers.includes('password') ? 'password' : providers.includes('apple.com') ? 'apple' : null;
    },
    reauthenticate: async (password) => {
      const user = auth.currentUser;
      if (!user) throw Object.assign(new Error('Not signed in'), { code: 'auth/no-current-user' });
      if (password === undefined && user.providerData.some((p) => p.providerId === 'apple.com')) {
        await reauthenticateWithPopup(user, appleProvider());
        return;
      }
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email ?? '', password ?? ''));
    },
    deleteSignIn: async () => {
      if (auth.currentUser) await deleteUser(auth.currentUser);
    },

    listen: (uid, name, onDocs, onError) =>
      onSnapshot(
        collection(db, `users/${uid}/${name}`),
        { includeMetadataChanges: true },
        (snap) =>
          onDocs(
            snap.docs.map((d) => ({ ...d.data(), id: d.id })),
            { fromCache: snap.metadata.fromCache, hasPendingWrites: snap.metadata.hasPendingWrites },
          ),
        onError,
      ),
    commit: async (uid, ops) => {
      await Promise.all(
        chunks(ops).map((group) => {
          const batch = writeBatch(db);
          for (const op of group) {
            const ref = doc(db, `users/${uid}/${op.collection}/${op.id}`);
            if (op.data) batch.set(ref, clean(op.data));
            else batch.delete(ref);
          }
          return batch.commit();
        }),
      );
    },
    waitForPendingWrites: () => waitForPendingWrites(db),
  };
}

/** True when this device is running the demo account (local data only). */
export const inDemo = isDemoMode();

// The demo wins over everything, then the dev fake, then real Firebase. Firebase is only
// set up in the last case, so the demo never makes a network call.
export const backend: Backend = inDemo
  ? createDemoBackend()
  : process.env.EXPO_PUBLIC_FAKE_BACKEND === '1'
    ? fakeBackend
    : createWebBackend();
