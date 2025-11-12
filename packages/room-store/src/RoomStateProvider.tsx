import React, {createContext, ReactNode, useContext} from 'react';
import {StoreApi, useStore} from 'zustand';
import {BaseRoomStoreState, BaseRoomStore} from './BaseRoomStore';

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

export function useBaseRoomStore<RS extends object, T>(
  selector: (state: RS & BaseRoomStoreState) => T,
): T {
  const store = useContext(RoomStateContext);
  if (!store) {
    throw new Error('Missing RoomStateProvider in the tree');
  }
  return useStore(
    store as unknown as StoreApi<RS & BaseRoomStoreState>,
    selector,
  );
}
