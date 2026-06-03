import type {StoreApi} from 'zustand';
import type {PersistStorage, StorageValue} from 'zustand/middleware';
import {
  createPersistenceController,
  type PersistenceController,
  type PersistenceSaveMetadata,
  type PersistenceSaveReason,
} from './PersistenceController';

/**
 * Converts between a persisted room-state shape and the snapshot value handled
 * by a persistence adapter.
 *
 * The default codec stores snapshots as JSON strings. Provide a custom codec
 * when the backing store already accepts structured values, compressed payloads,
 * encrypted payloads, or another non-string snapshot format.
 *
 * @typeParam TPersisted - The partial room-state shape persisted by Zustand.
 * @typeParam TSnapshot - The durable snapshot shape accepted by the adapter.
 */
export type RoomStorePersistenceSnapshotCodec<TPersisted, TSnapshot> = {
  /** Serializes the already-partialized persisted state into a durable snapshot. */
  serialize?: (persisted: TPersisted) => TSnapshot;
  /** Deserializes a durable snapshot into the shape Zustand will merge. */
  deserialize?: (snapshot: TSnapshot) => TPersisted;
};

/**
 * Options for creating controller-backed persistence for a room store.
 *
 * This helper composes Zustand persist storage, room-store partialization, and
 * `createPersistenceController()` so apps can share dirty tracking, autosave,
 * final flush, and hydration saved-snapshot behavior without repeating glue.
 *
 * @typeParam TState - The full room-store state.
 * @typeParam TPersisted - The partial state shape written by Zustand persist.
 * @typeParam TSnapshot - The durable snapshot shape handled by the adapter.
 */
export type CreateRoomStorePersistenceOptions<
  TState,
  TPersisted = Partial<TState>,
  TSnapshot = string,
> = RoomStorePersistenceSnapshotCodec<TPersisted, TSnapshot> & {
  /**
   * Selects the portion of full room-store state that should be persisted.
   *
   * When using Zustand's `persist` middleware, pass the same function to its
   * `partialize` option so the storage receives the same `TPersisted` shape.
   */
  partialize: (state: TState) => TPersisted;
  /** Loads the latest durable snapshot, or `null` when none exists. */
  load: () => Promise<TSnapshot | null>;
  /**
   * Writes a durable snapshot.
   *
   * Metadata carries the save reason, such as `setItem`, `store-change`,
   * `autosave`, or `final-flush`, for adapters that want observability.
   */
  save: (
    snapshot: TSnapshot,
    metadata?: PersistenceSaveMetadata,
  ) => Promise<void>;
  /** Removes the durable snapshot when Zustand clears persistence. */
  remove?: () => Promise<void>;
  /**
   * Optional Zustand store to observe directly.
   *
   * Provide this when persistence should track store changes independently of
   * Zustand persist's `setItem` calls.
   */
  store?: StoreApi<TState>;
  /**
   * Applies a deserialized snapshot to runtime state during `hydrate()`.
   *
   * The helper runs this callback while persistence is paused, so restoring
   * state does not mark the controller dirty.
   */
  applySnapshot?: (
    persisted: TPersisted,
    context: {store?: StoreApi<TState>},
  ) => void | Promise<void>;
  /** Debounce delay for autosaves, or `null` to disable autosave. */
  autosaveDelayMs?: number | null;
  /** Version returned from `storage.getItem()` for Zustand persist migrations. */
  version?: number;
  /** Clock used by the underlying controller, mostly useful for tests. */
  now?: () => number;
  /**
   * Whether an initially-bound store snapshot should be treated as already saved.
   *
   * Defaults to `true`, which avoids treating the current runtime state as a
   * user edit immediately after binding.
   */
  markInitialSnapshotSaved?: boolean;
  /** Save reason used when `bindStore()` detects a changed partialized snapshot. */
  subscribeReason?: PersistenceSaveReason;
};

/**
 * Controller-backed persistence utilities for a room store.
 *
 * `storage` is typed as `PersistStorage<TPersisted>` because Zustand persist
 * calls custom storage with the already-partialized state shape, not the full
 * runtime store state.
 */
export type RoomStorePersistence<TState, TPersisted, TSnapshot> = {
  /** Low-level persistence controller for save state, dirty tracking, and flushes. */
  controller: PersistenceController<TSnapshot>;
  /** Zustand persist storage backed by the controller and adapter callbacks. */
  storage: PersistStorage<TPersisted>;
  /** The partialization function passed into the helper. */
  partialize: (state: TState) => TPersisted;
  /**
   * Hydrates through the controller, deserializes the snapshot, and optionally
   * applies it to the bound store while persistence is paused.
   */
  hydrate: () => Promise<TPersisted | null>;
  /** Flushes pending dirty state immediately. */
  flush: (reason?: PersistenceSaveReason) => Promise<void>;
  /** Marks the partialized snapshot for a full store state as saved. */
  markStateSnapshotSaved: (state: TState) => void;
  /**
   * Convenience callback for Zustand persist's `onRehydrateStorage` option.
   *
   * Use this after Zustand has merged persisted state into the full runtime
   * store, so the controller treats that merged runtime shape as clean.
   */
  onRehydrateStorage: () => (state?: TState, error?: unknown) => void;
  /**
   * Subscribes to a Zustand store and marks changed partialized snapshots dirty.
   *
   * Returns the unsubscribe function from `store.subscribe()`.
   */
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

/**
 * Creates persistence glue for a Zustand-backed room store.
 *
 * Use this helper when an app owns durable storage, such as a DuckDB project
 * table or workspace file, but wants to reuse SQLRooms persistence semantics:
 * explicit hydration, dirty tracking, autosave scheduling, final flushes, and
 * saved-snapshot reconciliation after rehydrate.
 *
 * The helper can be used in two modes:
 *
 * - As custom Zustand persist `storage`, paired with the same `partialize`
 *   function passed to Zustand persist.
 * - As a direct store subscription via `store` or `bindStore()` when the host
 *   wants to observe room-store changes outside Zustand persist.
 *
 * @example
 * ```ts
 * const persistence = createRoomStorePersistence<RoomState>({
 *   partialize: persistHelpers.partialize,
 *   autosaveDelayMs: 300,
 *   load: () => loadWorkspaceState(),
 *   save: (snapshot, metadata) =>
 *     saveWorkspaceState(snapshot, metadata?.reason),
 * });
 *
 * const storeCreator = persistSliceConfigs(
 *   {
 *     name: 'workspace-state',
 *     sliceConfigSchemas,
 *     storage: persistence.storage,
 *     partialize: persistence.partialize,
 *     onRehydrateStorage: persistence.onRehydrateStorage,
 *   },
 *   createState,
 * );
 * ```
 *
 * @typeParam TState - The full room-store state.
 * @typeParam TPersisted - The partial state shape written by Zustand persist.
 * @typeParam TSnapshot - The durable snapshot shape handled by the adapter.
 */
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
