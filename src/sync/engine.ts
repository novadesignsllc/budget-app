import type { StoreApi } from 'zustand';

import type { Backend, DocData, WriteOp } from '@/backend/types';
import { defaultSettings, type State } from '@/store';

/** Firestore layout: users/{uid}/{collection}/{id}, plus users/{uid}/meta/state for settings. */
export const COLLECTIONS = ['accounts', 'envelopes', 'transactions', 'allocations', 'recurring'] as const;
const META = 'meta';
const META_ID = 'state';
const ALL = [...COLLECTIONS, META];

type Status = { begin: () => void; end: () => void; fail: (e: unknown) => void };

/** JSON with sorted keys and no undefined, so equal docs always compare equal. */
export function stable(value: unknown): string {
  return JSON.stringify(value, (_k, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]]))
      : v,
  );
}

function localDocs(state: State, name: string): DocData[] {
  if (name === META) {
    return [{ id: META_ID, settings: state.settings, merchantMemory: state.merchantMemory }];
  }
  return state[name as (typeof COLLECTIONS)[number]] as unknown as DocData[];
}

function toState(name: string, docs: DocData[]): Partial<State> {
  if (name === META) {
    const d = docs.find((x) => x.id === META_ID) as
      | (DocData & Partial<Pick<State, 'settings' | 'merchantMemory'>>)
      | undefined;
    return {
      settings: { ...defaultSettings, ...d?.settings },
      merchantMemory: d?.merchantMemory ?? {},
    };
  }
  return { [name]: docs } as Partial<State>;
}

/**
 * Two-way sync between the zustand store and Firestore for one signed-in user.
 *
 * - Local changes: every store change is diffed against what Firestore has, and only
 *   the changed docs are written. Firestore applies them to its on-device cache at once,
 *   so they survive going offline (and, on iPhone, the app closing), and uploads them
 *   when there's a connection.
 * - Remote changes: snapshots from Firestore (the other device, or the cache on launch)
 *   replace the matching slice of the store, with writes still in flight laid on top so
 *   a slow snapshot never undoes something you just did.
 *
 * Nothing is written until every collection has loaded once, so stale state can't
 * overwrite newer data from the other device.
 */
export function startSync({
  backend,
  uid,
  store,
  status,
  onReady,
}: {
  backend: Backend;
  uid: string;
  store: StoreApi<State>;
  status: Status;
  onReady?: () => void;
}) {
  const remote: Record<string, Map<string, string>> = {};
  const remoteDocs: Record<string, DocData[]> = {};
  const hadPending: Record<string, boolean> = {};
  /** Writes we've sent that a snapshot hasn't reflected yet. null = delete. */
  const inflight: Record<string, Map<string, { json: string | null; data: DocData | null }>> = {};
  for (const name of ALL) {
    remote[name] = new Map();
    inflight[name] = new Map();
  }
  let ready = false;
  let applying = false;
  let stopped = false;
  let pushScheduled = false;

  /** Changes made in the same moment (one tap can change several things) go up as one batch. */
  function schedulePush() {
    if (pushScheduled) return;
    pushScheduled = true;
    queueMicrotask(flushPush);
  }

  function flushPush() {
    if (!pushScheduled) return;
    pushScheduled = false;
    push();
  }

  /** Firestore's view with our in-flight writes laid on top. */
  function view(name: string): Map<string, string> {
    const merged = new Map(remote[name]);
    for (const [id, w] of inflight[name]) {
      if (w.json === null) merged.delete(id);
      else merged.set(id, w.json);
    }
    return merged;
  }

  function apply(name: string) {
    // Send anything waiting first, so a snapshot can't overwrite a change that hasn't gone out yet.
    flushPush();
    // Drop in-flight entries the snapshot now reflects.
    for (const [id, w] of inflight[name]) {
      if ((remote[name].get(id) ?? null) === w.json) inflight[name].delete(id);
    }
    const byId = new Map(remoteDocs[name].map((d) => [d.id, d]));
    for (const [id, w] of inflight[name]) {
      if (w.data) byId.set(id, w.data);
      else byId.delete(id);
    }
    const docs = [...byId.values()];
    const current = localDocs(store.getState(), name);
    if (stable([...current].sort(byIdOrder)) === stable([...docs].sort(byIdOrder))) return;
    applying = true;
    store.setState(toState(name, docs));
    applying = false;
  }

  function push() {
    if (!ready || stopped) return;
    const state = store.getState();
    const ops: WriteOp[] = [];
    for (const name of ALL) {
      const known = view(name);
      const seen = new Set<string>();
      for (const d of localDocs(state, name)) {
        seen.add(d.id);
        if (known.get(d.id) !== stable(d)) ops.push({ collection: name, id: d.id, data: d });
      }
      for (const id of known.keys()) {
        if (!seen.has(id)) ops.push({ collection: name, id, data: null });
      }
    }
    if (!ops.length) return;

    for (const op of ops) {
      inflight[op.collection].set(op.id, { json: op.data ? stable(op.data) : null, data: op.data });
    }
    status.begin();
    backend.commit(uid, ops).then(
      () => {
        for (const op of ops) {
          const w = inflight[op.collection].get(op.id);
          if (w && w.json === (op.data ? stable(op.data) : null)) inflight[op.collection].delete(op.id);
        }
        status.end();
      },
      (error) => status.fail(error),
    );
  }

  function becomeReady() {
    ready = true;
    for (const name of ALL) apply(name);
    // Writes queued on a previous launch (offline) are still uploading.
    if (ALL.some((n) => hadPending[n])) {
      status.begin();
      backend.waitForPendingWrites().then(() => status.end(), (e) => status.fail(e));
    }
    push();
    onReady?.();
  }

  const unsubs = ALL.map((name) =>
    backend.listen(
      uid,
      name,
      (docs, meta) => {
        if (stopped) return;
        remoteDocs[name] = docs;
        remote[name] = new Map(docs.map((d) => [d.id, stable(d)]));
        hadPending[name] = meta.hasPendingWrites;
        if (!ready) {
          if (ALL.every((n) => remoteDocs[n])) becomeReady();
          return;
        }
        apply(name);
      },
      (error) => status.fail(error),
    ),
  );

  const unsubStore = store.subscribe(() => {
    if (!applying && ready) schedulePush();
  });

  return function stop() {
    stopped = true;
    unsubs.forEach((u) => u());
    unsubStore();
  };
}

function byIdOrder(a: DocData, b: DocData) {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
