import {describe, expect, it} from '@jest/globals';
import {createStore} from 'zustand';
import {createRoomStorePersistence} from '../src/createRoomStorePersistence';

type TestState = {
  count: number;
  transient: string;
};

describe('createRoomStorePersistence', () => {
  it('creates controller-backed persist storage and marks rehydrated state saved', async () => {
    const saved: string[] = [];
    const persistence = createRoomStorePersistence<TestState>({
      partialize: (state) => ({count: state.count}),
      load: async () => '{"count":2}',
      save: async (snapshot) => {
        saved.push(snapshot);
      },
    });

    const value = await persistence.storage.getItem('test');

    expect(value).toEqual({state: {count: 2}, version: 0});
    persistence.onRehydrateStorage()({
      count: 2,
      transient: 'runtime-only',
    });
    await persistence.flush();

    expect(saved).toEqual([]);
    expect(persistence.controller.getState().dirty).toBe(false);
  });

  it('saves Zustand persist storage values as already-partialized state', async () => {
    const saved: string[] = [];
    const persistence = createRoomStorePersistence<
      TestState,
      Pick<TestState, 'count'>
    >({
      partialize: (state) => ({count: state.count}),
      load: async () => null,
      save: async (snapshot) => {
        saved.push(snapshot);
      },
    });

    await persistence.storage.setItem('test', {state: {count: 3}});
    await persistence.flush();

    expect(saved).toEqual(['{"count":3}']);
  });

  it('binds to a store and saves partialized snapshots on changes', async () => {
    const saved: string[] = [];
    const store = createStore<TestState>(() => ({
      count: 1,
      transient: 'a',
    }));
    const persistence = createRoomStorePersistence<TestState>({
      store,
      partialize: (state) => ({count: state.count}),
      load: async () => null,
      save: async (snapshot) => {
        saved.push(snapshot);
      },
    });

    store.setState({transient: 'b'});
    await persistence.flush();
    store.setState({count: 2});
    await persistence.flush();

    expect(saved).toEqual(['{"count":2}']);
    expect(persistence.controller.getState()).toMatchObject({
      dirty: false,
      lastSaveReason: 'flush',
    });
  });

  it('persists the initial bound snapshot when it is not marked saved', async () => {
    const saved: string[] = [];
    const store = createStore<TestState>(() => ({
      count: 1,
      transient: 'a',
    }));
    const persistence = createRoomStorePersistence<TestState>({
      partialize: (state) => ({count: state.count}),
      load: async () => null,
      save: async (snapshot) => {
        saved.push(snapshot);
      },
    });

    persistence.bindStore(store, {markInitialSnapshotSaved: false});
    await persistence.flush();
    await persistence.flush();

    expect(saved).toEqual(['{"count":1}']);
    expect(persistence.controller.getState().dirty).toBe(false);
  });

  it('uses snapshot comparison when subscribed structured snapshots are equivalent', async () => {
    const saved: Array<{count: number}> = [];
    const store = createStore<TestState>(() => ({
      count: 1,
      transient: 'a',
    }));
    const persistence = createRoomStorePersistence<
      TestState,
      Pick<TestState, 'count'>,
      {count: number}
    >({
      store,
      partialize: (state) => ({count: state.count}),
      serialize: (state) => ({...state}),
      deserialize: (snapshot) => snapshot,
      compareSnapshots: (next, previous) => next.count === previous.count,
      load: async () => null,
      save: async (snapshot) => {
        saved.push(snapshot);
      },
    });

    store.setState({transient: 'b'});
    await persistence.flush();
    store.setState({count: 2});
    await persistence.flush();

    expect(saved).toEqual([{count: 2}]);
  });

  it('uses snapshot revisions when subscribed structured snapshots are equivalent', async () => {
    const saved: Array<{revision: number; payload: {count: number}}> = [];
    const store = createStore<TestState>(() => ({
      count: 1,
      transient: 'a',
    }));
    const persistence = createRoomStorePersistence<
      TestState,
      Pick<TestState, 'count'>,
      {revision: number; payload: {count: number}}
    >({
      store,
      partialize: (state) => ({count: state.count}),
      serialize: (state) => ({revision: state.count, payload: {...state}}),
      deserialize: (snapshot) => snapshot.payload,
      getSnapshotRevision: (snapshot) => snapshot.revision,
      load: async () => null,
      save: async (snapshot) => {
        saved.push(snapshot);
      },
    });

    store.setState({transient: 'b'});
    await persistence.flush();
    store.setState({count: 2});
    await persistence.flush();

    expect(saved).toEqual([{revision: 2, payload: {count: 2}}]);
  });

  it('skips guarded store changes without saving them later', async () => {
    const saved: string[] = [];
    let persistEnabled = false;
    const store = createStore<TestState>(() => ({
      count: 1,
      transient: 'a',
    }));
    const persistence = createRoomStorePersistence<TestState>({
      store,
      partialize: (state) => ({count: state.count}),
      shouldPersistChange: () => persistEnabled,
      load: async () => null,
      save: async (snapshot) => {
        saved.push(snapshot);
      },
    });

    store.setState({count: 2});
    await persistence.flush();

    persistEnabled = true;
    store.setState({transient: 'b'});
    await persistence.flush();

    store.setState({count: 3});
    await persistence.flush();

    expect(saved).toEqual(['{"count":3}']);
  });

  it('only marks removed snapshots saved after deletion succeeds', async () => {
    const saved: string[] = [];
    const persistence = createRoomStorePersistence<TestState>({
      partialize: (state) => ({count: state.count}),
      load: async () => '{"count":1}',
      save: async (snapshot) => {
        saved.push(snapshot);
      },
      remove: async () => {
        throw new Error('remove failed');
      },
    });

    await persistence.storage.getItem('test');

    await expect(persistence.storage.removeItem('test')).rejects.toThrow(
      'remove failed',
    );

    await persistence.storage.setItem('test', {state: {count: 1}});
    await persistence.flush();

    expect(saved).toEqual([]);
    expect(persistence.controller.getState().dirty).toBe(false);
  });

  it('rejects removal when no remove implementation is configured', async () => {
    const persistence = createRoomStorePersistence<TestState>({
      partialize: (state) => ({count: state.count}),
      load: async () => null,
      save: async () => {},
    });

    await expect(persistence.storage.removeItem('test')).rejects.toThrow(
      'remove option',
    );
  });

  it('hydrates and applies snapshots while persistence is paused', async () => {
    const saved: string[] = [];
    const store = createStore<TestState>(() => ({
      count: 1,
      transient: 'a',
    }));
    const persistence = createRoomStorePersistence<TestState>({
      store,
      partialize: (state) => ({count: state.count}),
      load: async () => '{"count":5}',
      save: async (snapshot) => {
        saved.push(snapshot);
      },
      applySnapshot: (snapshot, {store}) => {
        store?.setState({
          count: snapshot.count ?? 0,
        });
      },
    });

    const snapshot = await persistence.hydrate();
    await persistence.flush();

    expect(snapshot).toEqual({count: 5});
    expect(store.getState().count).toBe(5);
    expect(saved).toEqual([]);
    expect(persistence.controller.getState().dirty).toBe(false);
  });

  it('does not mark the current store snapshot saved when hydrate does not apply it', async () => {
    const saved: string[] = [];
    const store = createStore<TestState>(() => ({
      count: 1,
      transient: 'a',
    }));
    const persistence = createRoomStorePersistence<TestState>({
      store,
      partialize: (state) => ({count: state.count}),
      load: async () => '{"count":5}',
      save: async (snapshot) => {
        saved.push(snapshot);
      },
    });

    const snapshot = await persistence.hydrate();
    store.setState({count: 5});
    await persistence.flush();

    expect(snapshot).toEqual({count: 5});
    expect(saved).toEqual([]);
    expect(persistence.controller.getState().dirty).toBe(false);
  });
});
