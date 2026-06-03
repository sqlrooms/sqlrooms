import type {StoreApi} from 'zustand';
import type {PersistStorage, StorageValue} from 'zustand/middleware';
import {
  createPersistenceController,
  type PersistenceController,
  type PersistenceSaveMetadata,
  type PersistenceSaveReason,
} from './PersistenceController';

export type RoomStorePersistenceSnapshotCodec<TPersisted, TSnapshot> = {
  serialize?: (persisted: TPersisted) => TSnapshot;
  deserialize?: (snapshot: TSnapshot) => TPersisted;
};

export type CreateRoomStorePersistenceOptions<
  TState,
  TPersisted = Partial<TState>,
  TSnapshot = string,
> = RoomStorePersistenceSnapshotCodec<TPersisted, TSnapshot> & {
  partialize: (state: TState) => TPersisted;
  load: () => Promise<TSnapshot | null>;
  save: (
    snapshot: TSnapshot,
    metadata?: PersistenceSaveMetadata,
  ) => Promise<void>;
  remove?: () => Promise<void>;
  store?: StoreApi<TState>;
  applySnapshot?: (
    persisted: TPersisted,
    context: {store?: StoreApi<TState>},
  ) => void | Promise<void>;
  autosaveDelayMs?: number | null;
  version?: number;
  now?: () => number;
  markInitialSnapshotSaved?: boolean;
  subscribeReason?: PersistenceSaveReason;
};

export type RoomStorePersistence<TState, TPersisted, TSnapshot> = {
  controller: PersistenceController<TSnapshot>;
  storage: PersistStorage<TPersisted>;
  partialize: (state: TState) => TPersisted;
  hydrate: () => Promise<TPersisted | null>;
  flush: (reason?: PersistenceSaveReason) => Promise<void>;
  markStateSnapshotSaved: (state: TState) => void;
  onRehydrateStorage: () => (state?: TState, error?: unknown) => void;
  bindStore: (
    store: StoreApi<TState>,
    options?: {markInitialSnapshotSaved?: boolean},
  ) => () => void;
};

function defaultSerialize<TPersisted, TSnapshot>(
  persisted: TPersisted,
): TSnapshot {
  return JSON.stringify(persisted) as TSnapshot;
}

function defaultDeserialize<TPersisted, TSnapshot>(
  snapshot: TSnapshot,
): TPersisted {
  if (typeof snapshot === 'string') {
    return JSON.parse(snapshot) as TPersisted;
  }
  return snapshot as unknown as TPersisted;
}

export function createRoomStorePersistence<
  TState,
  TPersisted = Partial<TState>,
  TSnapshot = string,
>({
  partialize,
  load,
  save,
  remove,
  store,
  applySnapshot,
  autosaveDelayMs = null,
  version = 0,
  now,
  serialize = defaultSerialize<TPersisted, TSnapshot>,
  deserialize = defaultDeserialize<TPersisted, TSnapshot>,
  markInitialSnapshotSaved = true,
  subscribeReason = 'store-change',
}: CreateRoomStorePersistenceOptions<
  TState,
  TPersisted,
  TSnapshot
>): RoomStorePersistence<TState, TPersisted, TSnapshot> {
  const toSnapshot = (state: TState) => serialize(partialize(state));
  const controller = createPersistenceController<TSnapshot>({
    autosaveDelayMs,
    now,
    getSnapshot: store ? () => toSnapshot(store.getState()) : undefined,
    adapter: {
      load,
      save,
      ...(remove ? {remove} : {}),
    },
  });

  const markStateSnapshotSaved = (state: TState) => {
    controller.markSnapshotSaved(toSnapshot(state));
  };

  const storage: PersistStorage<TPersisted> = {
    getItem: async (name: string): Promise<StorageValue<TPersisted> | null> => {
      void name;
      const snapshot = await controller.hydrate();
      if (snapshot === null) return null;
      return {
        state: deserialize(snapshot),
        version,
      };
    },
    setItem: async (
      name: string,
      value: StorageValue<TPersisted>,
    ): Promise<void> => {
      void name;
      controller.setSnapshot(serialize(value.state), 'setItem');
    },
    removeItem: async (name: string): Promise<void> => {
      void name;
      controller.markSnapshotSaved(null);
      await controller.flush('remove');
      if (!remove) return;
      await controller.pause(remove);
      controller.markSnapshotSaved(null);
    },
  };

  const bindStore: RoomStorePersistence<
    TState,
    TPersisted,
    TSnapshot
  >['bindStore'] = (storeToBind, options = {}) => {
    let lastObservedSnapshot = toSnapshot(storeToBind.getState());
    const shouldMarkInitial =
      options.markInitialSnapshotSaved ?? markInitialSnapshotSaved;
    if (shouldMarkInitial) {
      controller.markSnapshotSaved(lastObservedSnapshot);
    }

    return storeToBind.subscribe((state) => {
      const snapshot = toSnapshot(state);
      if (snapshot === lastObservedSnapshot) return;
      lastObservedSnapshot = snapshot;
      controller.setSnapshot(snapshot, subscribeReason);
    });
  };

  if (store) {
    bindStore(store, {markInitialSnapshotSaved});
  }

  return {
    controller,
    storage,
    partialize,
    hydrate: async () => {
      const snapshot = await controller.hydrate();
      if (snapshot === null) return null;
      const persisted = deserialize(snapshot);
      if (applySnapshot) {
        await controller.pause(() => applySnapshot(persisted, {store}));
      }
      if (store) {
        markStateSnapshotSaved(store.getState());
      }
      return persisted;
    },
    flush: (reason = 'flush') => controller.flush(reason),
    markStateSnapshotSaved,
    onRehydrateStorage:
      () =>
      (state?: TState, error?: unknown): void => {
        if (error || !state) return;
        markStateSnapshotSaved(state);
      },
    bindStore,
  };
}
