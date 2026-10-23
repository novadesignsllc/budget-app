import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { createFakeBackend } from '@/backend/fake';
import { initialState, resetStore, useStore } from '@/store';

import { startSync } from './engine';

const UID = 'u1';

function setup(latencyMs = 50) {
  const backend = createFakeBackend({ latencyMs });
  const events: string[] = [];
  const status = {
    begin: () => events.push('begin'),
    end: () => events.push('end'),
    fail: () => events.push('fail'),
  };
  let ready = false;
  const stop = startSync({ backend, uid: UID, store: useStore, status, onReady: () => (ready = true) });
  return { backend, events, stop, isReady: () => ready };
}

async function tick(ms = 0) {
  await jest.advanceTimersByTimeAsync(ms);
}

beforeEach(() => {
  jest.useFakeTimers();
  resetStore();
});
afterEach(() => {
  jest.useRealTimers();
});

describe('startSync', () => {
  it('becomes ready once every collection has loaded, without writing anything for an empty store', async () => {
    const { isReady, backend, stop } = setup();
    expect(isReady()).toBe(false);
    await tick(10);
    expect(isReady()).toBe(true);
    // Only the settings doc gets created for a brand-new account.
    await tick(100);
    expect(backend.serverDocs(UID, 'accounts')).toEqual([]);
    expect(backend.serverDocs(UID, 'meta')).toHaveLength(1);
    stop();
  });

  it('uploads a new transaction and confirms it', async () => {
    const { backend, events, stop } = setup();
    await tick(200);
    events.length = 0;
    const id = useStore.getState().addAccount({ name: 'Checking', kind: 'checking', balance: 10000 });
    await tick(0); // jest's fake timers also hold back queueMicrotask
    expect(events).toEqual(['begin']);
    await tick(100);
    expect(events).toEqual(['begin', 'end']);
    expect(backend.serverDocs(UID, 'accounts').map((d) => d.id)).toEqual([id]);
    stop();
  });

  it('sends changes made in the same moment as one upload', async () => {
    const { events, stop } = setup();
    await tick(200);
    events.length = 0;
    const a = useStore.getState().addAccount({ name: 'Checking', kind: 'checking', balance: 0 });
    useStore.getState().addEnvelope({ name: 'Groceries', group: 'Daily' });
    useStore.getState().updateAccount(a, { name: 'Main Checking' });
    await tick(200);
    expect(events).toEqual(['begin', 'end']);
    stop();
  });

  it('keeps offline changes on the device and uploads them when the connection returns', async () => {
    const { backend, events, stop } = setup();
    await tick(200);
    const account = useStore.getState().addAccount({ name: 'Checking', kind: 'checking', balance: 10000 });
    await tick(200);
    events.length = 0;

    backend.setOnline(false);
    useStore.getState().addTransaction({
      date: '2026-10-22',
      accountId: account,
      amount: 1099,
      kind: 'spend',
      payee: "McDonald's",
    });
    await tick(10_000);
    // Visible in the app right away, not on the server yet, still pending.
    expect(useStore.getState().transactions).toHaveLength(1);
    expect(backend.serverDocs(UID, 'transactions')).toHaveLength(0);
    expect(events).toEqual(['begin']);

    backend.setOnline(true);
    await tick(200);
    expect(backend.serverDocs(UID, 'transactions')).toHaveLength(1);
    expect(events).toEqual(['begin', 'end']);
    stop();
  });

  it('a slow snapshot never undoes a change you just made', async () => {
    const { backend, stop } = setup(500);
    await tick(1000);
    backend.setOnline(false);
    const a = useStore.getState().addAccount({ name: 'A', kind: 'checking', balance: 0 });
    useStore.getState().updateAccount(a, { name: 'A renamed' });
    await tick(10);
    expect(useStore.getState().accounts.map((x) => x.name)).toEqual(['A renamed']);
    backend.setOnline(true);
    await tick(2000);
    expect(useStore.getState().accounts.map((x) => x.name)).toEqual(['A renamed']);
    expect(backend.serverDocs(UID, 'accounts').map((x) => x.name)).toEqual(['A renamed']);
    stop();
  });

  it('adding then deleting before the server answers leaves nothing behind', async () => {
    const { backend, stop } = setup(500);
    await tick(1000);
    const a = useStore.getState().addAccount({ name: 'Checking', kind: 'checking', balance: 0 });
    const t = useStore.getState().addTransaction({
      date: '2026-10-22',
      accountId: a,
      amount: 500,
      kind: 'income',
      payee: 'Oops',
    });
    useStore.getState().deleteTransaction(t);
    await tick(3000);
    expect(backend.serverDocs(UID, 'transactions')).toHaveLength(0);
    expect(useStore.getState().transactions).toHaveLength(0);
    stop();
  });

  it('loads data written by another device, and later changes from it', async () => {
    const backend = createFakeBackend({ latencyMs: 10 });
    const account = (name: string) => ({
      id: 'x',
      name,
      kind: 'checking',
      openingBalance: 500,
      openedOn: '2026-10-01',
      order: 0,
    });
    const first = backend.commit(UID, [{ collection: 'accounts', id: 'x', data: account('From desktop') }]);
    await tick(50);
    await first;

    const status = { begin: () => {}, end: () => {}, fail: () => {} };
    const stop = startSync({ backend, uid: UID, store: useStore, status });
    await tick(50);
    expect(useStore.getState().accounts.map((a) => a.name)).toEqual(['From desktop']);

    // The other device renames it.
    const rename = backend.commit(UID, [{ collection: 'accounts', id: 'x', data: account('Renamed elsewhere') }]);
    await tick(50);
    await rename;
    expect(useStore.getState().accounts.map((a) => a.name)).toEqual(['Renamed elsewhere']);
    stop();
  });

  it('does not echo remote changes back as new writes', async () => {
    const backend = createFakeBackend({ latencyMs: 10 });
    const events: string[] = [];
    const status = { begin: () => events.push('begin'), end: () => events.push('end'), fail: () => events.push('fail') };
    const stop = startSync({ backend, uid: UID, store: useStore, status });
    await tick(100);
    events.length = 0;
    const commit = backend.commit(UID, [
      { collection: 'envelopes', id: 'e', data: { id: 'e', name: 'Groceries', group: 'Daily', order: 0 } },
    ]);
    await tick(100);
    await commit;
    expect(useStore.getState().envelopes).toHaveLength(1);
    expect(events).toEqual([]);
    stop();
  });

  it('starts from a clean store after sign-out', () => {
    useStore.getState().addAccount({ name: 'X', kind: 'checking', balance: 0 });
    resetStore();
    expect(useStore.getState().accounts).toEqual(initialState.accounts);
  });
});
