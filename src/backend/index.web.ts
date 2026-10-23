import { initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
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

import { fakeBackend } from './fake';
import { chunks, clean } from './firestore-shared';
import type { Backend } from './types';

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
    appleSignInAvailable: false,
    signInWithApple: () => Promise.reject(new Error('Sign in with Apple is only on iPhone.')),
    signOut: () => signOut(auth),

    listen: (uid, name, onDocs, onError) =>
      onSnapshot(
        collection(db, 'users', uid, name),
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
            const ref = doc(db, 'users', uid, op.collection, op.id);
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

export const backend: Backend = process.env.EXPO_PUBLIC_FAKE_BACKEND === '1' ? fakeBackend : createWebBackend();
