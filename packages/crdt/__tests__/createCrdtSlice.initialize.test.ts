import {describe, expect, it, jest} from '@jest/globals';
import {schema} from 'loro-mirror';
import {createStore} from 'zustand/vanilla';

import {
  createCrdtSlice,
  type CrdtSliceState,
  type CrdtSyncConnector,
} from '../src';

type AppState = CrdtSliceState & {
  counter: number;
  setCounter: (value: number) => void;
};

const mirrorSchema = schema({
  shared: schema.LoroMap({
    counter: schema.Number(),
  }),
});

describe('createCrdtSlice.initialize', () => {
  it('is idempotent (double-call only connects once)', async () => {
    const connect = jest.fn<Required<CrdtSyncConnector>['connect']>(
      async () => undefined,
    );
    const sync: CrdtSyncConnector = {connect};

    const store = createStore<AppState>()((set, get, api) => {
      const base: Omit<AppState, keyof CrdtSliceState> = {
        counter: 0,
        setCounter: (value) => set({counter: value}),
      };

      const crdt = createCrdtSlice<{counter: number}, typeof mirrorSchema>({
        schema: mirrorSchema,
        bindings: [
          {
            key: 'shared',
            select: (s) => ({counter: (s as any).counter}) as any,
            apply: (value) => set({counter: (value as any).counter}),
          },
        ],
        sync,
      })(set as any, get as any, api as any);

      return Object.assign(base, crdt) as AppState;
    });

    await Promise.all([
      store.getState().crdt.initialize(),
      store.getState().crdt.initialize(),
    ]);

    expect(store.getState().crdt.status).toBe('ready');
    expect(connect).toHaveBeenCalledTimes(1);

    // A later call should be a no-op, too.
    await store.getState().crdt.initialize();
    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('can be destroyed and re-initialized (connect called again)', async () => {
    const connect = jest.fn<Required<CrdtSyncConnector>['connect']>(
      async () => undefined,
    );
    const sync: CrdtSyncConnector = {connect};

    const store = createStore<AppState>()((set, get, api) => {
      const base: Omit<AppState, keyof CrdtSliceState> = {
        counter: 0,
        setCounter: (value) => set({counter: value}),
      };

      const crdt = createCrdtSlice<{counter: number}, typeof mirrorSchema>({
        schema: mirrorSchema,
        bindings: [
          {
            key: 'shared',
            select: (s) => ({counter: (s as any).counter}) as any,
            apply: (value) => set({counter: (value as any).counter}),
          },
        ],
        sync,
      })(set as any, get as any, api as any);

      return Object.assign(base, crdt) as AppState;
    });

    await store.getState().crdt.initialize();
    expect(connect).toHaveBeenCalledTimes(1);
    expect(store.getState().crdt.status).toBe('ready');

    await store.getState().crdt.destroy();
    expect(store.getState().crdt.status).toBe('idle');

    await store.getState().crdt.initialize();
    expect(connect).toHaveBeenCalledTimes(2);
    expect(store.getState().crdt.status).toBe('ready');
  });
});
