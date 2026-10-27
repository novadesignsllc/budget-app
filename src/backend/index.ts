import {
  AppleAuthProvider,
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  getAuth,
  onAuthStateChanged,
  reauthenticateWithCredential,
  revokeToken,
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

import { createDemoBackend } from './demo';
import { fakeBackend } from './fake';
import { chunks, clean } from './firestore-shared';
import { isDemoMode } from './mode';
import type { Backend } from './types';

/** Apple sign-in with a nonce: Apple gets its hash, Firebase gets the raw value to check it. */
async function appleCredential() {
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
  const result = await AppleAuthentication.signInAsync({
    requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
    nonce: hashedNonce,
  });
  if (!result.identityToken) throw Object.assign(new Error('No identity token'), { code: 'apple/no-token' });
  return { credential: AppleAuthProvider.credential(result.identityToken, rawNonce), code: result.authorizationCode };
}

function createNativeBackend(): Backend {
  const auth = getAuth();
  const db = getFirestore();
  // Apple's code from the last re-check, needed to revoke the app's access when the account is deleted.
  let appleCode: string | null = null;

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
      const { credential } = await appleCredential();
      await signInWithCredential(auth, credential);
    },
    signOut: () => signOut(auth),
    signInMethod: () => {
      const providers = auth.currentUser?.providerData.map((p) => p.providerId) ?? [];
      return providers.includes('password') ? 'password' : providers.includes('apple.com') ? 'apple' : null;
    },
    reauthenticate: async (password) => {
      const user = auth.currentUser;
      if (!user) throw Object.assign(new Error('Not signed in'), { code: 'auth/no-current-user' });
      if (password !== undefined) {
        await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email ?? '', password));
        return;
      }
      const { credential, code } = await appleCredential();
      await reauthenticateWithCredential(user, credential);
      appleCode = code;
    },
    deleteSignIn: async () => {
      const user = auth.currentUser;
      if (!user) return;
      if (appleCode) {
        // Apple asks apps to revoke their access when an account is deleted.
        await revokeToken(auth, appleCode).catch(() => {});
        appleCode = null;
      }
      await deleteUser(user);
    },

    listen: (uid, name, onDocs, onError) => {
      let delivered = false;
      return onSnapshot(
        collection(db, `users/${uid}/${name}`),
        { includeMetadataChanges: true },
        (snap) => {
          // After the first one, skip snapshots where only the metadata changed (a write
          // being confirmed): the docs are the same, and re-reading thousands is slow.
          if (delivered && snap.docChanges().length === 0) return;
          delivered = true;
          onDocs(
            snap.docs.map((d) => ({ ...(d.data() as object), id: d.id })),
            { fromCache: snap.metadata.fromCache, hasPendingWrites: snap.metadata.hasPendingWrites },
          );
        },
        onError,
      );
    },
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
    : createNativeBackend();
