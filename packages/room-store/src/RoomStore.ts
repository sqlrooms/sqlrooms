import {castDraft, produce} from 'immer';
import {StateCreator, StoreApi, createStore, useStore} from 'zustand';
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
 * Factory to create a room store creator with custom params.
 *
 * @template PC - Room config type
 * @template RS - Room state type
 * @param stateCreatorFactory - A function that takes params and returns a Zustand state creator
 * @returns An object with createRoomStore(params) and useRoomStore(selector)
 *
 */
export function createRoomStoreCreator<TState extends RoomState<any>>() {
  return function <TFactory extends (...args: any[]) => StateCreator<TState>>(
    stateCreatorFactory: TFactory,
  ): {
    createRoomStore: (...args: Parameters<TFactory>) => StoreApi<TState>;
    useRoomStore: <T>(selector: (state: TState) => T) => T;
  } {
    let store: StoreApi<TState> | undefined;

    function createRoomStore(...args: Parameters<TFactory>): StoreApi<TState> {
      store = createStore(stateCreatorFactory(...args));
      if (typeof window !== 'undefined') {
        store.getState().room.initialize();
      } else {
        console.warn(
          'Skipping room store initialization. Room store should be only used on client.',
        );
      }
      return store;
    }

    function useRoomStore<T>(selector: (state: TState) => T): T {
      if (!store)
        throw new Error(
          'Room store not initialized. Call createRoomStore first.',
        );
      return useStore(store, selector);
    }

    return {createRoomStore, useRoomStore};
  };
}
