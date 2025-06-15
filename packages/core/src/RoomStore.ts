import {castDraft, produce} from 'immer';
import {StateCreator, StoreApi, createStore} from 'zustand';
import {useBaseRoomStore} from './RoomStateProvider';

export type RoomStore<PC> = StoreApi<RoomState<PC>>;

export type RoomStateProps<PC> = {
  lastSavedConfig: PC | undefined;
  tasksProgress: Record<string, TaskProgress>;
  captureException: (exception: unknown, captureContext?: unknown) => void;
};

export type TaskProgress = {
  progress?: number | undefined;
  message: string;
};

export type RoomStateActions<PC> = {
  initialize: () => Promise<void>;

  /**
   * Set the room config.
   * @param config - The room config to set.
   */
  setRoomConfig: (config: PC) => void;
  /**
   * Set the last saved room config. This can be used to check if the room has unsaved changes.
   * @param config - The room config to set.
   */
  setLastSavedConfig: (config: PC) => void;
  /**
   * Check if the room has unsaved changes.
   * @returns True if the room has unsaved changes, false otherwise.
   */
  hasUnsavedChanges(): boolean; // since last save

  setTaskProgress: (id: string, taskProgress: TaskProgress | undefined) => void;
  getLoadingProgress: () => TaskProgress | undefined;
};

export type RoomState<PC> = {
  config: PC;
  room: RoomStateProps<PC> & RoomStateActions<PC>;
};

export function createRoomSlice<PC>(props: {
  config: PC;
  room: Partial<Omit<RoomStateProps<PC>, 'config'>>;
}): StateCreator<RoomState<PC>> {
  const {config: initialConfig, room: roomStateProps, ...restState} = props;
  const initialRoomState: RoomStateProps<PC> = {
    ...roomStateProps,
    lastSavedConfig: undefined,
    tasksProgress: {},
    captureException: (exception: unknown) => {
      console.error(exception);
    },
  };
  const slice: StateCreator<RoomState<PC>> = (set, get) => {
    const roomState: RoomState<PC> = {
      config: initialConfig,
      room: {
        ...initialRoomState,
        initialize: async () => {
          // To be overridden by the room shell
        },

        setRoomConfig: (config) =>
          set((state) =>
            produce(state, (draft) => {
              draft.config = castDraft(config);
            }),
          ),
        setLastSavedConfig: (config) =>
          set((state) =>
            produce(state, (draft) => {
              draft.room.lastSavedConfig = castDraft(config);
            }),
          ),

        hasUnsavedChanges: () => {
          const {lastSavedConfig} = get().room;
          const {config} = get();
          return config !== lastSavedConfig;
        },

        /** Returns the progress of the last task */
        getLoadingProgress() {
          const {tasksProgress} = get().room;
          const keys = Object.keys(tasksProgress);
          const lastKey = keys[keys.length - 1];
          if (lastKey) {
            return tasksProgress[lastKey];
          }
          return undefined;
        },

        setTaskProgress(id, taskProgress) {
          set((state) =>
            produce(state, (draft) => {
              if (taskProgress) {
                draft.room.tasksProgress[id] = taskProgress;
              } else {
                delete draft.room.tasksProgress[id];
              }
            }),
          );
        },
      },
      ...restState,
    };

    return roomState;
  };

  return slice;
}

export function createBaseSlice<PC, S>(
  sliceCreator: (...args: Parameters<StateCreator<S & RoomState<PC>>>) => S,
): StateCreator<S> {
  return (set, get, store) =>
    sliceCreator(
      set,
      get as () => S & RoomState<PC>,
      store as StoreApi<S & RoomState<PC>>,
    );
}

/**
 * Create a room store with custom fields and methods
 * @param initialState - The initial state and config for the room
 * @param sliceCreators - The slices to add to the room store
 * @returns The room store and a hook for accessing the room store
 */
export function createRoomStore<PC, RoomState extends RoomState<PC>>(
  stateCreator: StateCreator<RoomState>,
) {
  const roomStore = createStore<RoomState>((set, get, store) => ({
    ...stateCreator(set, get, store),
  }));

  if (typeof window !== 'undefined') {
    roomStore.getState().room.initialize();
  } else {
    console.warn(
      'Skipping room store initialization. Room store should be only used on client.',
    );
  }

  function useRoomStore<T>(selector: (state: RoomState) => T): T {
    // @ts-ignore TODO fix typing
    return useBaseRoomStore(selector as (state: RoomState) => T);
  }
  return {roomStore, useRoomStore};
}
