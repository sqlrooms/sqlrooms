import {afterEach, describe, expect, it, jest} from '@jest/globals';
import type {StoreApi} from 'zustand';
import type {BaseRoomStoreState} from '../src/BaseRoomStore';

type DevHmr = {
  nextId: () => string;
  get: (id: string) => StoreApi<any> | undefined;
  set: (id: string, store: StoreApi<any>) => Map<string, StoreApi<any>>;
  delete: (id: string) => boolean;
};

function createDevHmr(): DevHmr {
  const stores = new Map<string, StoreApi<any>>();
  let nextId = 0;
  return {
    nextId: () => `store_${nextId++}`,
    get: (id) => stores.get(id),
    set: (id, store) => stores.set(id, store),
    delete: (id) => stores.delete(id),
  };
}

async function loadBaseRoomStore({
  isDev,
  devHmr,
}: {
  isDev: boolean;
  devHmr: DevHmr | null;
}) {
  jest.resetModules();
  jest.unstable_mockModule('../src/hmr', () => ({
    IS_DEV: isDev,
    DEV_HMR: devHmr,
  }));
  return import('../src/BaseRoomStore');
}

function installDevtoolsExtension() {
  const connections: Array<{
    init: jest.Mock;
    send: jest.Mock;
    subscribe: jest.Mock;
    unsubscribe: jest.Mock;
  }> = [];
  const connect = jest.fn(() => {
    const connection = {
      init: jest.fn(),
      send: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };
    connections.push(connection);
    return connection;
  });
  (globalThis as any).window = {
    __REDUX_DEVTOOLS_EXTENSION__: {connect},
  };
  return {connect, connections};
}

afterEach(() => {
  jest.unstable_unmockModule('../src/hmr');
  jest.resetModules();
  delete (globalThis as any).window;
});

describe('createRoomStoreCreator DevTools integration', () => {
  it('reuses the HMR store and gives each store key a stable DevTools name', async () => {
    const devHmr = createDevHmr();
    const {connect} = installDevtoolsExtension();
    const {createBaseRoomSlice, createRoomStoreCreator} =
      await loadBaseRoomStore({isDev: true, devHmr});
    const creator =
      createRoomStoreCreator<BaseRoomStoreState>()(createBaseRoomSlice);

    const first = creator.createRoomStore({storeKey: 'project-a'});
    const reused = creator.createRoomStore({storeKey: 'project-a'});

    expect(reused).toBe(first);
    expect(connect).toHaveBeenCalledTimes(1);
    expect(connect).toHaveBeenCalledWith(
      expect.objectContaining({name: 'RoomStore:project-a'}),
    );
  });

  it('cleans up the old DevTools connection when the store key changes', async () => {
    const devHmr = createDevHmr();
    const {connections} = installDevtoolsExtension();
    const {createBaseRoomSlice, createRoomStoreCreator} =
      await loadBaseRoomStore({isDev: true, devHmr});
    const creator =
      createRoomStoreCreator<BaseRoomStoreState>()(createBaseRoomSlice);

    creator.createRoomStore({storeKey: 'project-a'});
    creator.createRoomStore({storeKey: 'project-b'});

    expect(connections).toHaveLength(2);
    expect(connections[0]?.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('does not connect DevTools outside development', async () => {
    const {connect} = installDevtoolsExtension();
    const {createBaseRoomSlice, createRoomStoreCreator} =
      await loadBaseRoomStore({isDev: false, devHmr: null});
    const creator =
      createRoomStoreCreator<BaseRoomStoreState>()(createBaseRoomSlice);

    creator.createRoomStore({storeKey: 'project-a'});

    expect(connect).not.toHaveBeenCalled();
  });
});
