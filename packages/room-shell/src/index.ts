/**
 * {@include ../README.md}
 * @packageDocumentation
 */

export {RoomShell} from './RoomShell';
export {RoomShellCommandPalette} from './RoomShellCommandPalette';
export type {
  RoomShellCommandPaletteButtonProps,
  RoomShellCommandPaletteProps,
} from './RoomShellCommandPalette';

export {FileDataSourceCard} from './data-sources/FileDataSourceCard';
export {FileDataSourcesPanel} from './data-sources/FileDataSourcesPanel';
export {TableCard} from './data-sources/TableCard';
export type {TableAction} from './data-sources/TableCard';
export {TablesListPanel} from './data-sources/TablesListPanel';

export {PanelHeaderButton} from './panels/RoomHeaderButton';
export {RoomPanel} from './panels/RoomPanel';
export {RoomPanelHeader} from './panels/RoomPanelHeader';

export {
  AreaPanelButtons,
  RoomShellSidebarButton,
  RoomShellSidebarButtons,
  SidebarButton,
  TabButtons,
} from './RoomShellSidebarButtons';

export {createRoomShellSlice, useBaseRoomShellStore} from './RoomShellSlice';
export type {RoomShellSliceState} from './RoomShellSlice';

export type {StateCreator, StoreApi} from 'zustand';

export {DataSourceStatus} from './types';
export type {DataSourceState, RoomFileInfo, RoomFileState} from './types';

export {LayoutRenderer} from '@sqlrooms/layout';
export type {
  LayoutPath,
  LayoutRendererProps,
  RoomPanelInfo,
  RoomPanelComponent,
} from '@sqlrooms/layout';

// Re-export from @sqlrooms/room-store
export {
  createBaseRoomSlice,
  createBaseSlice,
  createCommandCliAdapter,
  createCommandMcpAdapter,
  createCommandSlice,
  createPersistHelpers,
  createRoomCommandExecutionContext,
  createRoomSlice,
  createRoomStore,
  createRoomStoreCreator,
  createSlice,
  doesCommandRequireInput,
  exportCommandInputSchema,
  getCommandInputComponent,
  getCommandKeystrokes,
  getCommandShortcut,
  hasCommandSliceState,
  invokeCommandFromStore,
  isRoomSliceWithDestroy,
  isRoomSliceWithInitialize,
  listCommandsFromStore,
  persistSliceConfigs,
  registerCommandsForOwner,
  resolveCommandPolicyMetadata,
  RoomStateContext,
  RoomStateProvider,
  unregisterCommandsForOwner,
  useBaseRoomStore,
  useRoomStoreApi,
  validateCommandInput,
} from '@sqlrooms/room-store';
export type {
  BaseRoomStore,
  BaseRoomStoreState,
  CommandCliAdapter,
  CommandCliAdapterOptions,
  CommandMcpAdapter,
  CommandMcpAdapterOptions,
  CommandMcpToolDescriptor,
  CommandSliceState,
  CreateBaseRoomSliceProps,
  CreateCommandSliceProps,
  RegisteredRoomCommand,
  RoomCommand,
  RoomCommandDescriptor,
  RoomCommandExecuteOutput,
  RoomCommandExecutionContext,
  RoomCommandInputComponent,
  RoomCommandInputComponentProps,
  RoomCommandInvocation,
  RoomCommandInvocationOptions,
  RoomCommandInvokeErrorEvent,
  RoomCommandInvokeFailureEvent,
  RoomCommandInvokeStartEvent,
  RoomCommandInvokeSuccessEvent,
  RoomCommandKeystrokes,
  RoomCommandListOptions,
  RoomCommandMiddleware,
  RoomCommandMiddlewareNext,
  RoomCommandPolicyMetadata,
  RoomCommandPortableSchema,
  RoomCommandPredicate,
  RoomCommandResult,
  RoomCommandRiskLevel,
  RoomCommandSurface,
  RoomCommandUiMetadata,
  RoomStateProviderProps,
  UseRoomStore,
} from '@sqlrooms/room-store';

export {useShallow} from 'zustand/react/shallow';

// Re-export from @sqlrooms/db
export {createDbSlice} from '@sqlrooms/db';
export type {DbSliceState} from '@sqlrooms/db';

// Re-export from @sqlrooms/room-store — room-config types
export {
  BaseDataSource,
  BaseRoomConfig,
  DataSource,
  DataSourceTypes,
  DEFAULT_ROOM_TITLE,
  FileDataSource,
  LoadFile,
  LoadFileOptions,
  MAIN_VIEW,
  SpatialLoadFileOptions,
  SpatialLoadOptions,
  SqlQueryDataSource,
  StandardLoadFileOptions,
  StandardLoadOptions,
  UrlDataSource,
  createDefaultBaseRoomConfig,
  isFileDataSource,
  isSpatialLoadFileOptions,
  isSqlQueryDataSource,
  isUrlDataSource,
  LayoutNodeKey,
  LayoutPanelNode,
  LayoutSplitNode,
  LayoutTabsNode,
  LayoutNode,
  LayoutConfig,
  isLayoutPanelNode,
  isLayoutSplitNode,
  isLayoutTabsNode,
  createDefaultLayout,
} from '@sqlrooms/room-store';

export type {LayoutDirection} from '@sqlrooms/room-store';
