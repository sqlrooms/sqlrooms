import {produce} from 'immer';
import {StateCreator, StoreApi, createStore, useStore} from 'zustand';
import {DEV_HMR} from './hmr';

// Re-export for convenience
export type {StateCreator};

export interface SliceFunctions {
  initialize?: () => Promise<void>;
  destroy?: () => Promise<void>;
}

export type BaseRoomStoreState = {
  room: {
    initialized: boolean;
    initialize: () => Promise<void>;
    destroy: () => Promise<void>;
    captureException: (exception: unknown, captureContext?: unknown) => void;
  };
};

export type BaseRoomStore<RS extends BaseRoomStoreState> = StoreApi<RS>;
type RoomStoreApiMethods<RS extends BaseRoomStoreState> = Pick<
  StoreApi<RS>,
  'getState' | 'setState' | 'subscribe' | 'getInitialState'
>;
export type UseRoomStore<RS extends BaseRoomStoreState> = {
  <T>(selector: (state: RS) => T): T;
} & RoomStoreApiMethods<RS>;

export type CreateBaseRoomSliceProps = {
  captureException?: BaseRoomStoreState['room']['captureException'];
};

export type CreateRoomStoreOptions = {
  /**
   * Optional store key used for dev HMR reuse.
   * Provide a project-specific key to force recreation when it changes.
   */
  storeKey?: string;
};

type CreateRoomStoreArgs<TFactory extends (...args: any[]) => any> = [
  ...Parameters<TFactory>,
  CreateRoomStoreOptions?,
];

export function createBaseRoomSlice(
  props?: CreateBaseRoomSliceProps,
): StateCreator<BaseRoomStoreState> {
  return (_set, _get, store) => ({
    room: {
      initialized: false,
      initialize: async () => {
        await Promise.all(
          Object.entries(store.getState())
            .filter(
              ([key, slice]) =>
                key !== 'room' && isRoomSliceWithInitialize(slice),
            )
            .map(async ([_key, slice]) => {
              await slice.initialize();
            }),
        );
      },
      destroy: async () => {
        await Promise.all(
          Object.entries(store.getState())
            .filter(
              ([key, slice]) => key !== 'room' && isRoomSliceWithDestroy(slice),
            )
            .map(async ([_key, slice]) => {
              await slice.destroy();
            }),
        );
      },
      captureException:
        props?.captureException ??
        ((exception: unknown) => console.error(exception)),
    },
  });
}
/** @deprecated Use createBaseRoomSlice instead */
export const createRoomSlice = createBaseRoomSlice;

export function createSlice<
  SliceState,
  StoreState extends SliceState = BaseRoomStoreState & SliceState,
>(
  sliceCreator: (...args: Parameters<StateCreator<StoreState>>) => SliceState,
): StateCreator<SliceState> {
  return (set, get, store) =>
    sliceCreator(set, get as () => StoreState, store as StoreApi<StoreState>);
}

/** @deprecated Use createSlice instead */
export const createBaseSlice = createSlice;

/**
 * Create a room store with custom fields and methods
 * @param initialState - The initial state and config for the room
 * @param sliceCreators - The slices to add to the room store
 * @returns The room store and a hook for accessing the room store
 */
export function createRoomStore<RS extends BaseRoomStoreState>(
  stateCreator: StateCreator<RS>,
) {
  const factory = createRoomStoreCreator<BaseRoomStoreState & RS>();
  const storeCreator = factory(() => stateCreator);
  const roomStore = storeCreator.createRoomStore();

  function useRoomStoreHook<T>(selector: (state: RS) => T): T {
    return storeCreator.useRoomStore(selector);
  }
  const useRoomStore = withRoomStoreApi<RS>(useRoomStoreHook, () => roomStore);

  return {roomStore, useRoomStore};
}

/**
 * Factory to create a room store creator with custom params.
 *
 * @template RS - Room state type
 * @param stateCreatorFactory - A function that takes params and returns a Zustand state creator
 * @returns An object with createRoomStore(params) and useRoomStore(selector)
 *
 * @example
 * const {createRoomStore} = createRoomStoreCreator<MyRoomState>()(
 *   (projectId: string) => createMyRoomState(projectId),
 * );
 * createRoomStore('project-a', {storeKey: 'project-a'});
 */
export function createRoomStoreCreator<RS extends BaseRoomStoreState>() {
  return function <TFactory extends (...args: any[]) => StateCreator<RS>>(
    stateCreatorFactory: TFactory,
  ): {
    createRoomStore: (...args: CreateRoomStoreArgs<TFactory>) => StoreApi<RS>;
    useRoomStore: UseRoomStore<RS>;
  } {
    const defaultStoreKey = DEV_HMR?.nextId();
    let store: StoreApi<RS> | undefined;
    let currentStoreKey: string | undefined = defaultStoreKey;

    function isCreateRoomStoreOptions(
      value: unknown,
    ): value is CreateRoomStoreOptions {
      return typeof value === 'object' && value !== null && 'storeKey' in value;
    }

    function createRoomStore(
      ...args: CreateRoomStoreArgs<TFactory>
    ): StoreApi<RS> {
      const lastArg = args[args.length - 1];
      const options = isCreateRoomStoreOptions(lastArg) ? lastArg : undefined;
      const factoryArgs = (
        options ? args.slice(0, -1) : args
      ) as Parameters<TFactory>;
      const storeKey = DEV_HMR
        ? (options?.storeKey ?? defaultStoreKey)
        : undefined;

      // Dev-only: Check for existing store from previous hot reload
      if (DEV_HMR && storeKey) {
        if (currentStoreKey && currentStoreKey !== storeKey) {
          const previousStore = DEV_HMR.get(currentStoreKey);
          if (previousStore) {
            const state = previousStore.getState();
            if (isRoomSliceWithDestroy(state.room)) {
              state.room.destroy().catch((error: unknown) => {
                state.room.captureException(error);
              });
            }
          }
          DEV_HMR.delete(currentStoreKey);
        }
        currentStoreKey = storeKey;

        const existingStore = DEV_HMR.get(storeKey);
        if (existingStore) {
          store = existingStore;
          return existingStore;
        }
      }

      store = createStore(stateCreatorFactory(...factoryArgs));

      // Dev-only: Register store for HMR preservation
      if (DEV_HMR && currentStoreKey) {
        DEV_HMR.set(currentStoreKey, store);
      }

      if (typeof window !== 'undefined') {
        (async () => {
          try {
            // Initialize the room
            await store.getState().room.initialize();
            // Set initialized to true after initialization
            store.setState((state) =>
              produce(state, (draft) => {
                draft.room.initialized = true;
              }),
            );
          } catch (error) {
            store.getState().room.captureException(error);
          }
        })();
      } else {
        console.warn(
          'Skipping room store initialization. The room store should only be used on the client.',
        );
      }
      return store;
    }

    function useRoomStoreHook<T>(selector: (state: RS) => T): T {
      if (!store)
        throw new Error(
          'Room store not initialized. Call createRoomStore first.',
        );
      return useStore(store, selector);
    }
    const useRoomStore = withRoomStoreApi<RS>(useRoomStoreHook, () => store);

    return {createRoomStore, useRoomStore};
  };
}

function withRoomStoreApi<RS extends BaseRoomStoreState>(
  useRoomStore: <T>(selector: (state: RS) => T) => T,
  getStore: () => StoreApi<RS> | undefined,
): UseRoomStore<RS> {
  const getState: StoreApi<RS>['getState'] = () =>
    getStoreOrThrow(getStore).getState();
  const setState = ((...args: unknown[]) =>
    (getStoreOrThrow(getStore).setState as (...args: unknown[]) => void)(
      ...args,
    )) as StoreApi<RS>['setState'];
  const subscribe = ((...args: unknown[]) =>
    (getStoreOrThrow(getStore).subscribe as (...args: unknown[]) => unknown)(
      ...args,
    )) as StoreApi<RS>['subscribe'];
  const getInitialState: StoreApi<RS>['getInitialState'] = () =>
    getStoreOrThrow(getStore).getInitialState();

  return Object.assign(useRoomStore, {
    getState,
    setState,
    subscribe,
    getInitialState,
  });
}

function getStoreOrThrow<RS extends BaseRoomStoreState>(
  getStore: () => StoreApi<RS> | undefined,
): StoreApi<RS> {
  const store = getStore();
  if (!store) {
    throw new Error('Room store not initialized. Call createRoomStore first.');
  }
  return store;
}

export function isRoomSliceWithInitialize(
  slice: unknown,
): slice is Required<Pick<SliceFunctions, 'initialize'>> {
  return (
    typeof slice === 'object' &&
    slice !== null &&
    'initialize' in slice &&
    typeof slice.initialize === 'function'
  );
}

export function isRoomSliceWithDestroy(
  slice: unknown,
): slice is Required<Pick<SliceFunctions, 'destroy'>> {
  return (
    typeof slice === 'object' &&
    slice !== null &&
    'destroy' in slice &&
    typeof slice.destroy === 'function'
  );
}
