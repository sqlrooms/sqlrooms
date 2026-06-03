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
  hydrating: boolean;
  dirty: boolean;
  saving: boolean;
  error: unknown;
  lastSaveReason: PersistenceSaveReason | null;
  lastSavedAt: number | null;
  baselineVersion: number;
  pendingSave: boolean;
};

export type PersistenceControllerListener = (
  state: PersistenceControllerState,
) => void;

export type PersistenceController<TSnapshot> = {
  hydrate: () => Promise<TSnapshot | null>;
  setBaseline: (snapshot: TSnapshot | null) => void;
  setSnapshot: (snapshot: TSnapshot, reason?: PersistenceSaveReason) => void;
  markDirty: (reason?: PersistenceSaveReason) => void;
  saveNow: (reason?: PersistenceSaveReason) => Promise<void>;
  flush: (reason?: PersistenceSaveReason) => Promise<void>;
  pause: <TResult>(fn: () => TResult | Promise<TResult>) => Promise<TResult>;
  getState: () => PersistenceControllerState;
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
  let baselineSnapshot: TSnapshot | null = null;
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
    baselineVersion: 0,
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
          baselineSnapshot = snapshot;
          const hasNewSnapshot = pendingSnapshot !== undefined;
          setState({
            dirty: hasNewSnapshot || state.pendingSave,
            error: null,
            lastSaveReason: reason,
            lastSavedAt: now(),
            baselineVersion: state.baselineVersion + 1,
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
        baselineSnapshot = snapshot;
        pendingSnapshot = undefined;
        setState({
          dirty: false,
          hydrating: false,
          baselineVersion: state.baselineVersion + 1,
        });
        return snapshot;
      } catch (error) {
        setState({error, hydrating: false});
        throw error;
      }
    },

    setBaseline: (snapshot) => {
      clearTimer();
      baselineSnapshot = snapshot;
      pendingSnapshot = undefined;
      setState({
        dirty: false,
        pendingSave: false,
        error: null,
        baselineVersion: state.baselineVersion + 1,
      });
    },

    setSnapshot: (snapshot, reason = 'setItem') => {
      if (!canPersistChange()) return;
      if (snapshot === baselineSnapshot) {
        controller.setBaseline(snapshot);
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
