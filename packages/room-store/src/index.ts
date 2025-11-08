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
  createRoomStore,
  createRoomStoreCreator,
  createBaseSlice,
  createRoomSlice,
  createBaseRoomSlice,
  type CreateBaseRoomSliceProps,
  type BaseRoomSliceState,
  type RoomState,
  type RoomStore,
  type SliceState,
  isRoomSliceWithInitialize,
  isRoomSliceWithDestroy,
} from './RoomStore';

export type {StateCreator, StoreApi} from 'zustand';

export * from '@sqlrooms/room-config';
