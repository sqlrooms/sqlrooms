import {DataSource} from '@sqlrooms/room-config';
import {createRoomShellSlice, RoomShellSliceState} from '@sqlrooms/room-shell';
import {produce} from 'immer';
import {createStore, StoreApi} from 'zustand';

export type RoomState = RoomShellSliceState;

export function createRoomStoreForSources(
  dataSources: DataSource[],
): StoreApi<RoomState> {
  const store = createStore<RoomState>((set, get, api) => ({
    ...createRoomShellSlice({
      config: {dataSources},
    })(set, get, api),
  }));

  (async () => {
    try {
      await store.getState().room.initialize();
      store.setState((state) =>
        produce(state, (draft) => {
          draft.room.initialized = true;
        }),
      );
    } catch (error) {
      store.getState().room.captureException(error);
    }
  })();

  return store;
}
