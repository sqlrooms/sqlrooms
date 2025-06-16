import React, {createContext, ReactNode, useContext} from 'react';
import {StoreApi, useStore} from 'zustand';
import {RoomState, RoomStore} from './RoomStore';

// See https://docs.pmnd.rs/zustand/guides/initialize-state-with-props

export const RoomStateContext = createContext<RoomStore<unknown> | null>(null);

export type RoomStateProviderProps<PC> = React.PropsWithChildren<{
  roomStore?: RoomStore<PC>;
}>;

export function RoomStateProvider<PC>({
  children,
  roomStore,
}: RoomStateProviderProps<PC>): ReactNode {
  return (
    <RoomStateContext.Provider
      value={roomStore as unknown as RoomStore<unknown>}
    >
      {children}
    </RoomStateContext.Provider>
  );
}

export function useBaseRoomStore<PC, PS extends RoomState<PC>, T>(
  selector: (state: RoomState<PC>) => T,
): T {
  const store = useContext(RoomStateContext);
  if (!store) {
    throw new Error('Missing RoomStateProvider in the tree');
  }
  return useStore(store as unknown as StoreApi<PS>, selector);
}
