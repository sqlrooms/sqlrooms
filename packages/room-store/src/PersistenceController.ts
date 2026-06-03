export type PersistenceSaveReason =
  | 'autosave'
  | 'manual'
  | 'flush'
  | 'hydrate'
  | 'setItem'
  | (string & {});

export type PersistenceSaveMetadata = {
  reason: PersistenceSaveReason;
};

export type PersistenceAdapter<TSnapshot> = {
  load: () => Promise<TSnapshot | null>;
  save: (
    snapshot: TSnapshot,
    metadata?: PersistenceSaveMetadata,
  ) => Promise<void>;
  remove?: () => Promise<void>;
  revision?: unknown;
};

export type PersistenceControllerState = {
  /** True while the adapter is loading a snapshot into memory. */
  hydrating: boolean;
  /**
   * True when the controller has a snapshot that differs from the saved
   * snapshot and should be persisted by autosave, `saveNow`, or `flush`.
   */
  dirty: boolean;
  /** True while an adapter `save` call is in flight. */
  saving: boolean;
  /** Last adapter load/save error, or null after a successful save/snapshot mark. */
  error: unknown;
  /** Last reason passed to a save or dirty-marking operation. */
  lastSaveReason: PersistenceSaveReason | null;
  /** Unix timestamp, in milliseconds, of the last successful adapter save. */
  lastSavedAt: number | null;
  /**
   * Monotonic counter for changes to the saved snapshot.
   *
   * This is the snapshot the controller currently considers clean: either the
   * snapshot loaded during hydration, the snapshot passed to `markSnapshotSaved`,
   * or the latest snapshot successfully written by the adapter.
   * Consumers can watch this value to know that the clean saved state changed
   * without reading or comparing the snapshot itself.
   */
  savedSnapshotVersion: number;
  /**
   * True when a save was requested while another save was already in flight.
   * The controller will coalesce those requests and persist the latest snapshot.
   */
  pendingSave: boolean;
};

export type PersistenceControllerListener = (
  state: PersistenceControllerState,
) => void;

export type PersistenceController<TSnapshot> = {
  /**
   * Loads the adapter snapshot and treats it as the saved snapshot.
   *
   * Hydration does not mark the controller dirty. Hosts should merge the loaded
   * snapshot into their runtime store, then call `markSnapshotSaved` if the merged
   * runtime shape differs from the raw loaded snapshot.
   */
  hydrate: () => Promise<TSnapshot | null>;
  /**
   * Marks a snapshot as clean without writing it.
   *
   * Use this after hydration or other trusted reconciliation work once runtime
   * state reflects durable storage and should not be interpreted as a user edit.
   */
  markSnapshotSaved: (snapshot: TSnapshot | null) => void;
  /**
   * Provides the latest snapshot to save and marks it dirty when it differs
   * from the saved snapshot.
   */
  setSnapshot: (snapshot: TSnapshot, reason?: PersistenceSaveReason) => void;
  /** Marks the current `getSnapshot` result dirty without providing it eagerly. */
  markDirty: (reason?: PersistenceSaveReason) => void;
  /** Saves the dirty snapshot immediately, bypassing autosave delay. */
  saveNow: (reason?: PersistenceSaveReason) => Promise<void>;
  /** Flushes pending dirty state before unload, close, or project switch. */
  flush: (reason?: PersistenceSaveReason) => Promise<void>;
  /**
   * Runs work while dirty marking and snapshot updates are ignored.
   *
   * Use this around hydration or programmatic restore flows that should not be
   * treated as user edits.
   */
  pause: <TResult>(fn: () => TResult | Promise<TResult>) => Promise<TResult>;
  /** Returns a copy of the current observable controller state. */
  getState: () => PersistenceControllerState;
  /** Subscribes to observable controller state changes. */
  subscribe: (listener: PersistenceControllerListener) => () => void;
};

export type CreatePersistenceControllerOptions<TSnapshot> = {
  adapter: PersistenceAdapter<TSnapshot>;
  getSnapshot?: () => TSnapshot | Promise<TSnapshot>;
  autosaveDelayMs?: number | null;
  now?: () => number;
};

function cloneState(
  state: PersistenceControllerState,
): PersistenceControllerState {
  return {...state};
}

export function createPersistenceController<TSnapshot>({
  adapter,
  getSnapshot,
  autosaveDelayMs = null,
  now = () => Date.now(),
}: CreatePersistenceControllerOptions<TSnapshot>): PersistenceController<TSnapshot> {
  // Snapshot last known to match durable storage. A new snapshot equal to this
  // value is clean; a different snapshot is dirty and eligible for saving.
  let lastSavedSnapshot: TSnapshot | null = null;
  let pendingSnapshot: TSnapshot | undefined;
  let pauseDepth = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let saveInFlight: Promise<void> | null = null;
  const listeners = new Set<PersistenceControllerListener>();
  const state: PersistenceControllerState = {
    hydrating: false,
    dirty: false,
    saving: false,
    error: null,
    lastSaveReason: null,
    lastSavedAt: null,
    savedSnapshotVersion: 0,
    pendingSave: false,
  };

  const notify = () => {
    const snapshot = cloneState(state);
    listeners.forEach((listener) => listener(snapshot));
  };

  const setState = (patch: Partial<PersistenceControllerState>) => {
    Object.assign(state, patch);
    notify();
  };

  const clearTimer = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const canPersistChange = () => !state.hydrating && pauseDepth === 0;

  const scheduleAutosave = () => {
    if (autosaveDelayMs === null || autosaveDelayMs === undefined) return;
    if (!state.dirty || !canPersistChange()) return;
    clearTimer();
    timer = setTimeout(() => {
      timer = null;
      void controller.saveNow('autosave');
    }, autosaveDelayMs);
  };

  const resolveSnapshot = async (): Promise<TSnapshot | undefined> => {
    if (pendingSnapshot !== undefined) {
      return pendingSnapshot;
    }
    if (getSnapshot) {
      return getSnapshot();
    }
    return undefined;
  };

  const runSaveLoop = async (reason: PersistenceSaveReason) => {
    if (saveInFlight) {
      setState({pendingSave: true});
      return saveInFlight;
    }

    saveInFlight = (async () => {
      setState({saving: true, pendingSave: false});
      try {
        do {
          setState({pendingSave: false});
          const snapshot = await resolveSnapshot();
          if (snapshot === undefined || !state.dirty) {
            continue;
          }
          pendingSnapshot = undefined;
          await adapter.save(snapshot, {reason});
          lastSavedSnapshot = snapshot;
          const hasNewSnapshot = pendingSnapshot !== undefined;
          setState({
            dirty: hasNewSnapshot || state.pendingSave,
            error: null,
            lastSaveReason: reason,
            lastSavedAt: now(),
            savedSnapshotVersion: state.savedSnapshotVersion + 1,
          });
        } while (state.pendingSave || pendingSnapshot !== undefined);
      } catch (error) {
        setState({error});
        throw error;
      } finally {
        setState({saving: false});
        saveInFlight = null;
        if (state.dirty && state.pendingSave) {
          scheduleAutosave();
        }
      }
    })();

    return saveInFlight;
  };

  const controller: PersistenceController<TSnapshot> = {
    hydrate: async () => {
      clearTimer();
      setState({hydrating: true, error: null});
      try {
        const snapshot = await adapter.load();
        lastSavedSnapshot = snapshot;
        pendingSnapshot = undefined;
        setState({
          dirty: false,
          hydrating: false,
          savedSnapshotVersion: state.savedSnapshotVersion + 1,
        });
        return snapshot;
      } catch (error) {
        setState({error, hydrating: false});
        throw error;
      }
    },

    markSnapshotSaved: (snapshot) => {
      clearTimer();
      lastSavedSnapshot = snapshot;
      pendingSnapshot = undefined;
      setState({
        dirty: false,
        pendingSave: false,
        error: null,
        savedSnapshotVersion: state.savedSnapshotVersion + 1,
      });
    },

    setSnapshot: (snapshot, reason = 'setItem') => {
      if (!canPersistChange()) return;
      if (snapshot === lastSavedSnapshot) {
        controller.markSnapshotSaved(snapshot);
        return;
      }
      pendingSnapshot = snapshot;
      setState({
        dirty: true,
        lastSaveReason: reason,
        pendingSave: state.pendingSave || state.saving,
      });
      scheduleAutosave();
    },

    markDirty: (reason = 'manual') => {
      if (!canPersistChange()) return;
      setState({
        dirty: true,
        lastSaveReason: reason,
      });
      scheduleAutosave();
    },

    saveNow: async (reason = 'manual') => {
      clearTimer();
      if (!canPersistChange() || !state.dirty) return;
      await runSaveLoop(reason);
    },

    flush: async (reason = 'flush') => {
      clearTimer();
      if (!state.dirty && !saveInFlight) return;
      if (state.hydrating || pauseDepth > 0) return;
      await runSaveLoop(reason);
    },

    pause: async (fn) => {
      pauseDepth += 1;
      try {
        return await fn();
      } finally {
        pauseDepth -= 1;
      }
    },

    getState: () => cloneState(state),

    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };

  return controller;
}
