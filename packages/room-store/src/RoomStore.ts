import {produce} from 'immer';
import {StateCreator, StoreApi, createStore, useStore} from 'zustand';

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

export type RoomStore<RS extends BaseRoomStoreState> = StoreApi<RS>;

export type CreateBaseRoomSliceProps = {
  captureException?: BaseRoomStoreState['room']['captureException'];
};

export function createBaseRoomSlice(
  props?: CreateBaseRoomSliceProps,
): StateCreator<BaseRoomStoreState> {
  return (_set, _get, store) => ({
    room: {
      initialized: false,
      initialize: async () => {
        await Promise.all(
          Object.values(store.getState())
            .filter(isRoomSliceWithInitialize)
            .map((slice) => slice.initialize),
        );
      },
      destroy: async () => {
        await Promise.all(
          Object.values(store.getState())
            .filter(isRoomSliceWithDestroy)
            .map((slice) => slice.destroy),
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

  function useRoomStore<T>(selector: (state: RS) => T): T {
    return storeCreator.useRoomStore(selector);
  }

  return {roomStore, useRoomStore};
}

/**
 * Factory to create a room store creator with custom params.
 *
 * @template RS - Room state type
 * @param stateCreatorFactory - A function that takes params and returns a Zustand state creator
 * @returns An object with createRoomStore(params) and useRoomStore(selector)
 *
 */
export function createRoomStoreCreator<RS extends BaseRoomStoreState>() {
  return function <TFactory extends (...args: any[]) => StateCreator<RS>>(
    stateCreatorFactory: TFactory,
  ): {
    createRoomStore: (...args: Parameters<TFactory>) => StoreApi<RS>;
    useRoomStore: <T>(selector: (state: RS) => T) => T;
  } {
    let store: StoreApi<RS> | undefined;

    function createRoomStore(...args: Parameters<TFactory>): StoreApi<RS> {
      store = createStore(stateCreatorFactory(...args));
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

    function useRoomStore<T>(selector: (state: RS) => T): T {
      if (!store)
        throw new Error(
          'Room store not initialized. Call createRoomStore first.',
        );
      return useStore(store, selector);
    }

    return {createRoomStore, useRoomStore};
  };
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
