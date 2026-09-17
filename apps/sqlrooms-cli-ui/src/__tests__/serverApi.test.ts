import {afterEach, describe, expect, jest, test} from '@jest/globals';
import {createStore} from 'zustand/vanilla';
import {persist} from 'zustand/middleware';
import {createDuckDbPersistStorage, fetchMcpStatus} from '../serverApi';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  jest.useRealTimers();
});

describe('DuckDB workspace restoration', () => {
  type WorkspaceState = {documents: string[]; title?: string};

  /** Creates a controllable database load and records every attempted save. */
  function createWorkspace(
    failMerge: boolean,
    saved: WorkspaceState | null,
    loadPending?: Promise<void>,
    synchronize?: (state: WorkspaceState) => WorkspaceState,
  ) {
    let body = saved === null ? null : JSON.stringify(saved);
    const writes: string[] = [];
    const storage = createDuckDbPersistStorage<WorkspaceState>({
      query: async (sql) => {
        if (sql.startsWith('SELECT')) {
          await loadPending;
          return {toArray: () => (body === null ? [] : [{payload_json: body}])};
        }
        if (sql.startsWith('INSERT')) writes.push(sql);
      },
    });
    const store = createStore<WorkspaceState>()(
      persist((): WorkspaceState => ({documents: []}), {
        name: 'test',
        storage,
        skipHydration: true,
        merge: (persisted, current) => {
          if (failMerge) throw new Error('Invalid saved workspace');
          return {...current, ...(persisted as typeof current)};
        },
        onRehydrateStorage: () => (state, error) => {
          if (!state || error) return;
          if (synchronize) store.setState(synchronize(state));
          storage.completeHydration(store.getState());
        },
      }),
    );
    return {
      store,
      storage,
      writes,
      repair: () => {
        failMerge = false;
        body = JSON.stringify({documents: ['repaired']});
      },
    };
  }

  test('never overwrites a workspace after merge fails, even on final flush', async () => {
    jest.useFakeTimers();
    const {store, storage, writes, repair} = createWorkspace(true, {
      documents: ['saved'],
    });
    await store.persist.rehydrate();
    expect(store.persist.hasHydrated()).toBe(false);
    store.setState({documents: []});
    await jest.advanceTimersByTimeAsync(500);
    await storage.flush();
    expect(writes).toEqual([]);

    repair();
    await store.persist.rehydrate();
    expect(store.getState().documents).toEqual(['repaired']);
    store.setState({documents: ['edited']});
    await storage.flush();
    expect(writes).toHaveLength(1);
  });

  test.each([null, {documents: ['saved']}])(
    'enables saving after successful restoration of %j',
    async (saved) => {
      const {store, storage, writes} = createWorkspace(false, saved);
      store.setState({documents: ['initializing']});
      await storage.flush();
      expect(writes).toEqual([]);
      await store.persist.rehydrate();
      expect(store.persist.hasHydrated()).toBe(true);
      await storage.flush();
      const initialWrites = saved === null ? 1 : 0;
      expect(writes).toHaveLength(initialWrites);
      store.setState({documents: ['edited']});
      await storage.flush();
      expect(writes).toHaveLength(initialWrites + 1);
      expect(writes[initialWrites]).toContain('edited');
    },
  );

  test.each([null, {documents: ['saved']}])(
    'saves startup changes retained by merge once after loading %j',
    async (saved) => {
      jest.useFakeTimers();
      let finishLoad!: () => void;
      const loadPending = new Promise<void>((resolve) => {
        finishLoad = resolve;
      });
      const {store, storage, writes} = createWorkspace(
        false,
        saved,
        loadPending,
      );
      const hydration = store.persist.rehydrate();
      store.setState({title: 'Initialized title'});
      await jest.advanceTimersByTimeAsync(500);
      await storage.flush();
      expect(writes).toEqual([]);

      finishLoad();
      await hydration;
      expect(store.getState()).toEqual({
        documents: saved?.documents ?? [],
        title: 'Initialized title',
      });
      expect(storage.controller.getState().dirty).toBe(true);
      await jest.advanceTimersByTimeAsync(500);
      expect(writes).toHaveLength(1);
      expect(writes[0]).toContain(JSON.stringify(store.getState()));
      expect(storage.controller.getState().dirty).toBe(false);
      await storage.flush();
      expect(writes).toHaveLength(1);
    },
  );

  test('saves post-load synchronization from the latest store state', async () => {
    const {store, storage, writes} = createWorkspace(
      false,
      {documents: ['saved']},
      undefined,
      (state) => ({...state, title: 'Synchronized title'}),
    );
    await store.persist.rehydrate();
    await storage.flush();
    expect(writes).toHaveLength(1);
    expect(writes[0]).toContain(JSON.stringify(store.getState()));
    expect(writes[0]).toContain('Synchronized title');
  });
});

describe('fetchMcpStatus', () => {
  test('aborts a stalled status request before the polling interval', async () => {
    jest.useFakeTimers();
    let signal: AbortSignal | undefined;
    globalThis.fetch = jest.fn(
      (
        _url: Parameters<typeof fetch>[0],
        init?: Parameters<typeof fetch>[1],
      ) => {
        void _url;
        signal = init?.signal ?? undefined;
        return new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () => reject(new Error('aborted')));
        });
      },
    ) as typeof fetch;

    const request = fetchMcpStatus({apiBaseUrl: 'http://127.0.0.1:4173'});
    const rejection = expect(request).rejects.toThrow('aborted');
    await jest.advanceTimersByTimeAsync(1_000);

    await rejection;
    expect(signal?.aborted).toBe(true);
  });
});
