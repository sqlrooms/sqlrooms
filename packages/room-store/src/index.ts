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
  createRoomSlice,
  createRoomStore,
  createRoomStoreCreator,
  createSlice,
  isRoomSliceWithDestroy,
  isRoomSliceWithInitialize,
} from './BaseRoomStore';
export type {
  BaseRoomStore,
  BaseRoomStoreState,
  CreateBaseRoomSliceProps,
  UseRoomStore,
} from './BaseRoomStore';

export type {StateCreator, StoreApi} from 'zustand';
export {
  createPersistHelpers,
  PersistMergeInputSymbol,
  persistSliceConfigs,
} from './createPersistHelpers';

// Re-export from @sqlrooms/room-config
// Values also export their corresponding types automatically (Zod pattern)
export {
  BaseDataSource,
  BaseRoomConfig,
  createDefaultBaseRoomConfig,
  createDefaultMosaicLayout,
  DataSource,
  DataSourceTypes,
  DEFAULT_MOSAIC_LAYOUT,
  DEFAULT_ROOM_TITLE,
  FileDataSource,
  isFileDataSource,
  isMosaicLayoutParent,
  isSpatialLoadFileOptions,
  isSqlQueryDataSource,
  isUrlDataSource,
  LayoutConfig,
  LayoutTypes,
  LoadFile,
  LoadFileOptions,
  MAIN_VIEW,
  MosaicLayoutConfig,
  MosaicLayoutDirection,
  MosaicLayoutNode,
  MosaicLayoutNodeKey,
  MosaicLayoutParent,
  SpatialLoadFileOptions,
  SpatialLoadOptions,
  SqlQueryDataSource,
  StandardLoadFileOptions,
  StandardLoadOptions,
  UrlDataSource,
} from '@sqlrooms/room-config';
