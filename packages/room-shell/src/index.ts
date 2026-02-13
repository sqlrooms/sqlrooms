/**
 * {@include ../README.md}
 * @packageDocumentation
 */

export {RoomShell} from './RoomShell';

export {FileDataSourceCard} from './data-sources/FileDataSourceCard';
export {FileDataSourcesPanel} from './data-sources/FileDataSourcesPanel';
export {TableCard} from './data-sources/TableCard';
export type {TableAction} from './data-sources/TableCard';
export {TablesListPanel} from './data-sources/TablesListPanel';

export {PanelHeaderButton} from './panels/RoomHeaderButton';
export {RoomPanel} from './panels/RoomPanel';
export {RoomPanelHeader} from './panels/RoomPanelHeader';

export {
  RoomShellSidebarButton,
  RoomShellSidebarButtons,
  SidebarButton,
} from './RoomShellSidebarButtons';

export {createRoomShellSlice, useBaseRoomShellStore} from './RoomShellSlice';
export type {RoomShellSliceState} from './RoomShellSlice';

export type {StateCreator, StoreApi} from 'zustand';

export {DataSourceStatus} from './types';
export type {DataSourceState, RoomFileInfo, RoomFileState} from './types';

export type {RoomPanelInfo} from '@sqlrooms/layout';

// Re-export from @sqlrooms/room-store
export {
  createBaseRoomSlice,
  createBaseSlice,
  createPersistHelpers,
  createRoomSlice,
  createRoomStore,
  createRoomStoreCreator,
  createSlice,
  isRoomSliceWithDestroy,
  isRoomSliceWithInitialize,
  persistSliceConfigs,
  RoomStateContext,
  RoomStateProvider,
  useBaseRoomStore,
  useRoomStoreApi,
} from '@sqlrooms/room-store';
export type {
  BaseRoomStore,
  BaseRoomStoreState,
  CreateBaseRoomSliceProps,
  RoomStateProviderProps,
  UseRoomStore,
} from '@sqlrooms/room-store';

export {useShallow} from 'zustand/react/shallow';

// Re-export from @sqlrooms/room-config (via room-store)
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
} from '@sqlrooms/room-store';
