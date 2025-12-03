/**
 * {@include ../README.md}
 * @packageDocumentation
 */

export {
  RoomStateContext,
  RoomStateProvider,
  useBaseRoomStore,
  type RoomStateProviderProps,
} from './RoomStateProvider';

export {
  createBaseRoomSlice,
  createBaseSlice,
  createSlice,
  createRoomSlice,
  createRoomStore,
  createRoomStoreCreator,
  isRoomSliceWithDestroy,
  isRoomSliceWithInitialize,
  type BaseRoomStoreState,
  type CreateBaseRoomSliceProps,
  type BaseRoomStore,
} from './BaseRoomStore';

export {
  createPersistHelpers,
  persistSliceConfigs,
} from './createPersistHelpers';
export type {StateCreator, StoreApi} from 'zustand';

export * from '@sqlrooms/room-config';
