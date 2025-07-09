import {castDraft, produce} from 'immer';
import {StateCreator, StoreApi, createStore} from 'zustand';
import {useBaseRoomStore} from './RoomStateProvider';

export type RoomStore<PC> = StoreApi<RoomState<PC>>;

export type RoomStateProps<PC> = {
  initialized: boolean;
  lastSavedConfig: PC | undefined;
  tasksProgress: Record<string, TaskProgress>;
  roomError: Error | undefined;
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
  /**
   * Called when the project config is saved. To be overridden by the custom project state.
   * Implementations should call get().room.setLastSavedConfig(config) after a successful
   * save to update the last saved config.
   * @param config - The project config to save.
   */
  onSaveConfig?: (config: PC) => Promise<void> | undefined;

  setTaskProgress: (id: string, taskProgress: TaskProgress | undefined) => void;
  getLoadingProgress: () => TaskProgress | undefined;
  /**
   * Set the error of the project.
   * @param error - The error to set.
   */
  setRoomError: (error: Error) => void;
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
    initialized: false,
    lastSavedConfig: undefined,
    roomError: undefined,
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

        setRoomError(error) {
          set((state) =>
            produce(state, (draft) => {
              draft.room.roomError = error;
            }),
          );
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

export interface Slice {
  initialize?: () => Promise<void>;
}

function isSliceWithInitialize(
  slice: unknown,
): slice is Slice & Required<Pick<Slice, 'initialize'>> {
  return typeof slice === 'object' && slice !== null && 'initialize' in slice;
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
export function createRoomStore<PC, RS extends RoomState<PC>>(
  stateCreator: StateCreator<RS>,
) {
  const roomStore = createStore<RS>((set, get, store) => ({
    ...stateCreator(set, get, store),
  }));

  (async () => {
    if (typeof window !== 'undefined') {
      await roomStore.getState().room.initialize();
      const slices = Object.entries(roomStore.getState());
      for (const [key, slice] of slices) {
        if (isSliceWithInitialize(slice)) {
          console.log('Initializing slice', key);
          await slice.initialize();
        }
      }
      // Subscribe to the project store changes after initialization
      roomStore.subscribe(async (state) => {
        try {
          // Only save the project config if it has an onSaveConfig function and has unsaved changes
          if (state.room.onSaveConfig && state.room.hasUnsavedChanges()) {
            state.room.onSaveConfig(state.config);
          }
        } catch (error) {
          state.room.captureException(error);
          state.room.setRoomError(
            new Error('Error saving room config', {cause: error}),
          );
        }
      });
      roomStore.setState((state) =>
        produce(state, (draft) => {
          draft.room.initialized = true;
        }),
      );
    } else {
      console.warn(
        'Skipping room store initialization. Room store should be only used on client.',
      );
    }
  })();

  function useRoomStore<T>(selector: (state: RS) => T): T {
    // @ts-ignore TODO fix typing
    return useBaseRoomStore(selector as (state: RS) => T);
  }
  return {roomStore, useRoomStore};
}
