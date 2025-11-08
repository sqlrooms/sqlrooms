import React, {createContext, ReactNode, useContext} from 'react';
import {StoreApi, useStore} from 'zustand';
import {BaseRoomSliceState, RoomStore} from './RoomStore';

// See https://docs.pmnd.rs/zustand/guides/initialize-state-with-props

export const RoomStateContext =
  createContext<RoomStore<BaseRoomSliceState> | null>(null);

export type RoomStateProviderProps<RS extends BaseRoomSliceState> =
  React.PropsWithChildren<{
    roomStore?: RoomStore<RS>;
  }>;

export function RoomStateProvider<RS extends BaseRoomSliceState>({
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
  selector: (state: RS & BaseRoomSliceState) => T,
): T {
  const store = useContext(RoomStateContext);
  if (!store) {
    throw new Error('Missing RoomStateProvider in the tree');
  }
  return useStore(
    store as unknown as StoreApi<RS & BaseRoomSliceState>,
    selector,
  );
}
