/**
 * {@include ../README.md}
 * @packageDocumentation
 */

export {
  RoomStateContext,
  RoomStateProvider,
  useBaseRoomStore,
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
} from './BaseRoomStore';

export type {StateCreator, StoreApi} from 'zustand';
export {
  PersistMergeInputSymbol,
  createPersistHelpers,
  persistSliceConfigs,
} from './createPersistHelpers';

// Re-export from @sqlrooms/room-config
// Values also export their corresponding types automatically (Zod pattern)
export {
  BaseDataSource,
  BaseRoomConfig,
  DEFAULT_MOSAIC_LAYOUT,
  DEFAULT_ROOM_TITLE,
  DataSource,
  DataSourceTypes,
  FileDataSource,
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
  createDefaultBaseRoomConfig,
  createDefaultMosaicLayout,
  isFileDataSource,
  isMosaicLayoutParent,
  isSpatialLoadFileOptions,
  isSqlQueryDataSource,
  isUrlDataSource,
} from '@sqlrooms/room-config';
