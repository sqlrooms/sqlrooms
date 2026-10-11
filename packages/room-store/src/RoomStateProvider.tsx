import React, {createContext, ReactNode, useContext} from 'react';
import {StoreApi, useStore} from 'zustand';
import {BaseRoomStore, BaseRoomStoreState} from './BaseRoomStore';

// See https://docs.pmnd.rs/zustand/guides/initialize-state-with-props

export const RoomStateContext =
  createContext<BaseRoomStore<BaseRoomStoreState> | null>(null);

export type RoomStateProviderProps<RS extends BaseRoomStoreState> =
  React.PropsWithChildren<{
    roomStore?: BaseRoomStore<RS>;
  }>;

export function RoomStateProvider<RS extends BaseRoomStoreState>({
  children,
  roomStore,
}: RoomStateProviderProps<RS>): ReactNode {
  return (
    <RoomStateContext.Provider value={roomStore ?? null}>
      {children}
    </RoomStateContext.Provider>
  );
}

/**
 * Returns the raw Zustand store API from room context for imperative usage.
 *
 * This hook is non-reactive: it does not subscribe to store updates and does not
 * trigger rerenders for normal state changes. For reactive UI reads, prefer
 * `useBaseRoomStore` / `useRoomStore` selectors.
 */
export function useRoomStoreApi<RS extends BaseRoomStoreState>(): StoreApi<RS> {
  const store = useContext(RoomStateContext);
  if (!store) {
    throw new Error('Missing RoomStateProvider in the tree');
  }
  return store as unknown as StoreApi<RS>;
}

export function useBaseRoomStore<RS extends object, T>(
  selector: (state: RS & BaseRoomStoreState) => T,
): T {
  const store = useRoomStoreApi<RS & BaseRoomStoreState>();
  return useStore(store, selector);
}
