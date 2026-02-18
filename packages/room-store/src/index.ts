/**
 * {@include ../README.md}
 * @packageDocumentation
 */

export {
  RoomStateContext,
  RoomStateProvider,
  useBaseRoomStore,
  useRoomStoreApi,
} from './RoomStateProvider';
export type {RoomStateProviderProps} from './RoomStateProvider';

export {
  createBaseRoomSlice,
  createBaseSlice,
  createSlice,
  createRoomSlice,
  createRoomStore,
  createRoomStoreCreator,
  isRoomSliceWithDestroy,
  isRoomSliceWithInitialize,
} from './BaseRoomStore';
export type {
  BaseRoomStoreState,
  CreateBaseRoomSliceProps,
  BaseRoomStore,
  UseRoomStore,
} from './BaseRoomStore';

export {
  createPersistHelpers,
  persistSliceConfigs,
} from './createPersistHelpers';
export type {StateCreator, StoreApi} from 'zustand';

// Re-export from @sqlrooms/room-config
// Values also export their corresponding types automatically (Zod pattern)
export {
  BaseRoomConfig,
  DEFAULT_ROOM_TITLE,
  createDefaultBaseRoomConfig,
  DataSourceTypes,
  BaseDataSource,
  FileDataSource,
  UrlDataSource,
  SqlQueryDataSource,
  DataSource,
  isFileDataSource,
  isUrlDataSource,
  isSqlQueryDataSource,
  LoadFile,
  StandardLoadOptions,
  SpatialLoadOptions,
  SpatialLoadFileOptions,
  isSpatialLoadFileOptions,
  StandardLoadFileOptions,
  LoadFileOptions,
  MAIN_VIEW,
  LayoutTypes,
  DEFAULT_MOSAIC_LAYOUT,
  createDefaultMosaicLayout,
  MosaicLayoutDirection,
  MosaicLayoutParent,
  isMosaicLayoutParent,
  MosaicLayoutNodeKey,
  MosaicLayoutNode,
  MosaicLayoutConfig,
  LayoutConfig,
} from '@sqlrooms/room-config';
