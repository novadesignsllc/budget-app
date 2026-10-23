import type { Backend, DocData, SessionUser, SnapshotMeta, WriteOp } from './types';

/**
 * An in-memory stand-in for Firebase, used by tests and by `EXPO_PUBLIC_FAKE_BACKEND=1`
 * for trying the app without touching the real project. It copies the Firestore
 * behavior the app depends on: writes show up in listeners right away as pending,
 * and only reach the "server" (and resolve) while online.
 */

type Listener = { uid: string; collection: string; cb: (docs: DocData[], meta: SnapshotMeta) => void };
type Queued = { uid: string; ops: WriteOp[]; resolve: () => void };

const key = (uid: string, collection: string) => `${uid}/${collection}`;

export function createFakeBackend(opts: { latencyMs?: number; persist?: boolean; namespace?: string } = {}) {
  const latency = opts.latencyMs ?? 600;
  const storage = opts.persist && typeof localStorage !== 'undefined' ? localStorage : null;
  // Separate namespaces keep the demo's data apart from the dev fake's.
  const ns = opts.namespace ?? '';
  const SERVER = `${ns}fake-server`;
  const QUEUE = `${ns}fake-queue`;
  const USER = `${ns}fake-user`;

  const server = new Map<string, Map<string, DocData>>(
    storage ? JSON.parse(storage.getItem(SERVER) ?? '[]').map(([k, v]: [string, [string, DocData][]]) => [k, new Map(v)]) : [],
  );
  let user: SessionUser | null = storage ? JSON.parse(storage.getItem(USER) ?? 'null') : null;
  let online = true;
  let flushing = false;
  // Pending writes survive a reload, like Firestore's on-device queue.
  const queue: Queued[] = storage
    ? (JSON.parse(storage.getItem(QUEUE) ?? '[]') as Omit<Queued, 'resolve'>[]).map((q) => ({ ...q, resolve: () => {} }))
    : [];
  const listeners = new Set<Listener>();
  const authListeners = new Set<(u: SessionUser | null) => void>();
  const drainWaiters: (() => void)[] = [];

  function save() {
    storage?.setItem(SERVER, JSON.stringify([...server].map(([k, v]) => [k, [...v]])));
    storage?.setItem(QUEUE, JSON.stringify(queue.map(({ uid, ops }) => ({ uid, ops }))));
  }

  /** The local view: server data with every queued write applied on top. */
  function view(uid: string, collection: string): DocData[] {
    const docs = new Map(server.get(key(uid, collection)) ?? []);
    for (const q of queue) {
      if (q.uid !== uid) continue;
      for (const op of q.ops) {
        if (op.collection !== collection) continue;
        if (op.data) docs.set(op.id, op.data);
        else docs.delete(op.id);
      }
    }
    return [...docs.values()];
  }

  function emit(uid: string, collection: string) {
    const pending = queue.some((q) => q.uid === uid && q.ops.some((o) => o.collection === collection));
    for (const l of listeners) {
      if (l.uid === uid && l.collection === collection) {
        l.cb(view(uid, collection), { fromCache: !online, hasPendingWrites: pending });
      }
    }
  }

  async function flush() {
    if (flushing) return;
    flushing = true;
    while (online && queue.length) {
      await new Promise((r) => setTimeout(r, latency));
      if (!online) break;
      const q = queue.shift()!;
      const touched = new Set<string>();
      for (const op of q.ops) {
        const k = key(q.uid, op.collection);
        if (!server.has(k)) server.set(k, new Map());
        if (op.data) server.get(k)!.set(op.id, op.data);
        else server.get(k)!.delete(op.id);
        touched.add(op.collection);
      }
      save();
      q.resolve();
      for (const c of touched) emit(q.uid, c);
    }
    flushing = false;
    if (!queue.length) drainWaiters.splice(0).forEach((r) => r());
  }

  const api: Backend & {
    setOnline(value: boolean): void;
    isOnline(): boolean;
    serverDocs(uid: string, collection: string): DocData[];
    /** True when anything is stored for this user. */
    hasData(uid: string): boolean;
    /** Writes docs straight to the "server", as if another device had synced them. */
    seed(uid: string, docs: Record<string, DocData[]>): void;
  } = {
    onAuth(cb) {
      authListeners.add(cb);
      setTimeout(() => cb(user), 0);
      return () => authListeners.delete(cb);
    },
    async signInWithEmail(email, password) {
      if (!password) throw Object.assign(new Error('bad'), { code: 'auth/invalid-credential' });
      user = { uid: 'fake-user', email };
      storage?.setItem(USER, JSON.stringify(user));
      authListeners.forEach((cb) => cb(user));
    },
    async createAccount(email, password) {
      if (password.length < 6) throw Object.assign(new Error('weak'), { code: 'auth/weak-password' });
      return api.signInWithEmail(email, password);
    },
    async sendPasswordReset() {},
    appleSignInAvailable: false,
    async signInWithApple() {},
    async signOut() {
      user = null;
      storage?.removeItem(USER);
      authListeners.forEach((cb) => cb(null));
    },

    listen(uid, collection, onDocs) {
      const l: Listener = { uid, collection, cb: onDocs };
      listeners.add(l);
      setTimeout(() => emit(uid, collection), 0);
      return () => listeners.delete(l);
    },
    commit(uid, ops) {
      return new Promise<void>((resolve) => {
        const touched = new Set(ops.map((o) => o.collection));
        queue.push({ uid, ops, resolve });
        save();
        for (const c of touched) emit(uid, c);
        void flush();
      });
    },
    waitForPendingWrites() {
      if (!queue.length) return Promise.resolve();
      return new Promise((resolve) => drainWaiters.push(resolve));
    },

    setOnline(value) {
      online = value;
      if (online) void flush();
    },
    isOnline: () => online,
    serverDocs: (uid, collection) => [...(server.get(key(uid, collection))?.values() ?? [])],
    hasData: (uid) => [...server.entries()].some(([k, v]) => k.startsWith(`${uid}/`) && v.size > 0),
    seed(uid, docs) {
      for (const [collection, list] of Object.entries(docs)) {
        server.set(key(uid, collection), new Map(list.map((d) => [d.id, d])));
      }
      save();
    },
  };
  if (queue.length) setTimeout(() => void flush(), 0);
  return api;
}

export const fakeBackend = createFakeBackend({ persist: true });

// Lets a browser test flip the connection: window.__fakeBackend.setOnline(false)
if (typeof window !== 'undefined' && process.env.EXPO_PUBLIC_FAKE_BACKEND === '1') {
  (window as unknown as { __fakeBackend: typeof fakeBackend }).__fakeBackend = fakeBackend;
}
