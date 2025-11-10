import {produce} from 'immer';
import {StateCreator, StoreApi, createStore, useStore} from 'zustand';

export interface SliceFunctions {
  initialize?: () => Promise<void>;
  destroy?: () => Promise<void>;
}

export type BaseRoomSliceState = {
  room: {
    initialized: boolean;
    initialize: () => Promise<void>;
    destroy: () => Promise<void>;
    captureException: (exception: unknown, captureContext?: unknown) => void;
  };
};
/** @deprecated Use RoomSliceState instead */
export type RoomState = BaseRoomSliceState;

export type RoomStore<RS extends BaseRoomSliceState> = StoreApi<RS>;

export type CreateBaseRoomSliceProps = {
  captureException?: BaseRoomSliceState['room']['captureException'];
};

export function createBaseRoomSlice(
  props?: CreateBaseRoomSliceProps,
): StateCreator<BaseRoomSliceState> {
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

export function createBaseSlice<S extends object>(
  sliceCreator: (
    ...args: Parameters<StateCreator<S & BaseRoomSliceState>>
  ) => S,
): StateCreator<S> {
  return (set, get, store) =>
    sliceCreator(
      set,
      get as () => S & BaseRoomSliceState,
      store as StoreApi<S & BaseRoomSliceState>,
    );
}

/**
 * Create a room store with custom fields and methods
 * @param initialState - The initial state and config for the room
 * @param sliceCreators - The slices to add to the room store
 * @returns The room store and a hook for accessing the room store
 */
export function createRoomStore<RS extends BaseRoomSliceState>(
  stateCreator: StateCreator<RS>,
) {
  const factory = createRoomStoreCreator<BaseRoomSliceState & RS>();
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
export function createRoomStoreCreator<RS extends BaseRoomSliceState>() {
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
