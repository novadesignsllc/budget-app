/** Everything the app needs from Firebase, so native, web, and the test fake share one shape. */

export type SessionUser = { uid: string; email: string | null };

export type DocData = Record<string, unknown> & { id: string };

export type SnapshotMeta = {
  /** True when the data came from the on-device cache, not confirmed by the server. */
  fromCache: boolean;
  /** True when some of these docs have local changes Firebase hasn't confirmed yet. */
  hasPendingWrites: boolean;
};

/**
 * A set (data) or delete (null) of one document under users/{scope}/{collection}/{id}. The
 * scope is the user's id for their first profile, or `{uid}/profiles/{profileId}` for another.
 */
export type WriteOp = { collection: string; id: string; data: DocData | null };

export type Unsubscribe = () => void;

export type Backend = {
  onAuth(cb: (user: SessionUser | null) => void): Unsubscribe;
  signInWithEmail(email: string, password: string): Promise<void>;
  createAccount(email: string, password: string): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  /** Sign in with Apple is iPhone-only here. The desktop uses email. */
  appleSignInAvailable: boolean;
  signInWithApple(): Promise<void>;
  signOut(): Promise<void>;
  /** How the signed-in person signs in, so deleting the account knows what to ask for. */
  signInMethod(): 'password' | 'apple' | null;
  /** Proves it's really them before deleting the account: their password, or Sign in with Apple again. */
  reauthenticate(password?: string): Promise<void>;
  /** Deletes the sign-in itself (and revokes Apple's token). Call after their data is gone. */
  deleteSignIn(): Promise<void>;

  listen(
    /** The user's id, or `{uid}/profiles/{id}` for one of their other profiles. */
    uid: string,
    collection: string,
    onDocs: (docs: DocData[], meta: SnapshotMeta) => void,
    onError: (error: Error) => void,
  ): Unsubscribe;
  /**
   * Applies writes. They land in the local cache right away (and show up in listeners);
   * the promise resolves only once the server has them. Offline, it waits until online.
   */
  commit(uid: string, ops: WriteOp[]): Promise<void>;
  /** Resolves when every write made so far, including ones from a previous launch, is on the server. */
  waitForPendingWrites(): Promise<void>;
};

/** Turns Firebase auth error codes into something a person can act on. */
export function authErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
    return 'That email and password don’t match.';
  }
  if (code.includes('email-already-in-use')) return 'There’s already an account with that email. Sign in instead.';
  if (code.includes('weak-password')) return 'Use at least 6 characters.';
  if (code.includes('invalid-email')) return 'That doesn’t look like an email address.';
  if (code.includes('network')) return 'No connection. Try again when you’re online.';
  if (code.includes('too-many-requests')) return 'Too many tries. Wait a minute and try again.';
  if (code.includes('canceled') || code.includes('ERR_REQUEST_CANCELED')) return '';
  // The web's Apple window.
  if (code.includes('popup-closed-by-user') || code.includes('cancelled-popup-request')) return '';
  if (code.includes('popup-blocked')) return 'Your browser blocked the Apple window. Allow pop-ups for this site and try again.';
  if (code.includes('unauthorized-domain')) return 'Sign-in isn’t set up for this web address yet.';
  if (code.includes('account-exists-with-different-credential')) {
    return 'That email already has an account. Sign in with your email and password.';
  }
  return 'Something went wrong. Try again.';
}
