import {
  AppleAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
} from '@react-native-firebase/auth';
import {
  collection,
  doc,
  getFirestore,
  onSnapshot,
  waitForPendingWrites,
  writeBatch,
} from '@react-native-firebase/firestore';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

import { fakeBackend } from './fake';
import { chunks, clean } from './firestore-shared';
import type { Backend } from './types';

function createNativeBackend(): Backend {
  const auth = getAuth();
  const db = getFirestore();

  return {
    onAuth: (cb) => onAuthStateChanged(auth, (u) => cb(u ? { uid: u.uid, email: u.email } : null)),
    signInWithEmail: async (email, password) => {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    },
    createAccount: async (email, password) => {
      await createUserWithEmailAndPassword(auth, email.trim(), password);
    },
    sendPasswordReset: (email) => sendPasswordResetEmail(auth, email.trim()),
    appleSignInAvailable: process.env.EXPO_OS === 'ios',
    signInWithApple: async () => {
      // Apple gets a hash of the nonce; Firebase gets the raw value to check it.
      const rawNonce = Crypto.randomUUID();
      const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
      const result = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
        nonce: hashedNonce,
      });
      if (!result.identityToken) throw Object.assign(new Error('No identity token'), { code: 'apple/no-token' });
      await signInWithCredential(auth, AppleAuthProvider.credential(result.identityToken, rawNonce));
    },
    signOut: () => signOut(auth),

    listen: (uid, name, onDocs, onError) =>
      onSnapshot(
        collection(db, 'users', uid, name),
        { includeMetadataChanges: true },
        (snap) =>
          onDocs(
            snap.docs.map((d) => ({ ...(d.data() as object), id: d.id })),
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

export const backend: Backend = process.env.EXPO_PUBLIC_FAKE_BACKEND === '1' ? fakeBackend : createNativeBackend();
