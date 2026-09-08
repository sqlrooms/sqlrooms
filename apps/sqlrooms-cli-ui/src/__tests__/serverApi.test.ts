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
  function createWorkspace(
    failMerge: boolean,
    saved: {documents: string[]} | null,
  ) {
    let body = saved === null ? null : JSON.stringify(saved);
    const writes: string[] = [];
    const storage = createDuckDbPersistStorage<{documents: string[]}>({
      query: async (sql) => {
        if (sql.startsWith('SELECT')) {
          return {toArray: () => (body === null ? [] : [{payload_json: body}])};
        }
        if (sql.startsWith('INSERT')) writes.push(sql);
      },
    });
    const store = createStore(
      persist(() => ({documents: [] as string[]}), {
        name: 'test',
        storage,
        skipHydration: true,
        merge: (persisted, current) => {
          if (failMerge) throw new Error('Invalid saved workspace');
          return {...current, ...(persisted as typeof current)};
        },
        onRehydrateStorage: () => (state, error) => {
          if (state && !error) storage.markStateSnapshotSaved(state);
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
      expect(writes).toEqual([]);
      store.setState({documents: ['edited']});
      await storage.flush();
      expect(writes).toHaveLength(1);
      expect(writes[0]).toContain('edited');
    },
  );
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
