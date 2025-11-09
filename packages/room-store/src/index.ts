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
  createRoomSlice,
  createRoomStore,
  createRoomStoreCreator,
  isRoomSliceWithDestroy,
  isRoomSliceWithInitialize,
  type BaseRoomSliceState,
  type CreateBaseRoomSliceProps,
  type RoomState,
  type RoomStore,
} from './RoomStore';

export {createPersistHelpers} from './createPersistHelpers';
export type {StateCreator, StoreApi} from 'zustand';

export * from '@sqlrooms/room-config';
