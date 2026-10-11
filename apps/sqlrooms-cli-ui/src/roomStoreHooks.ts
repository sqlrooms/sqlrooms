import {useBaseRoomStore, useRoomStoreApi} from '@sqlrooms/room-shell';
import type {StoreApi} from 'zustand';

import type {RoomState} from './store-types';

/** Selects reactive state from the room store provided by RoomShell. */
export function useRoomStore<T>(selector: (state: RoomState) => T): T {
  return useBaseRoomStore<RoomState, T>(selector);
}

/** Returns the room store provided by RoomShell for imperative access. */
export function useCliRoomStoreApi(): StoreApi<RoomState> {
  return useRoomStoreApi<RoomState>();
}
