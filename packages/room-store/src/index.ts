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
  SliceFunctions,
  UseRoomStore,
} from './BaseRoomStore';

export type {StateCreator, StoreApi} from 'zustand';
export {
  createPersistHelpers,
  persistSliceConfigs,
} from './createPersistHelpers';

export {
  createCommandSlice,
  createRoomCommandExecutionContext,
  doesCommandRequireInput,
  exportCommandInputSchema,
  getCommandKeystrokes,
  getCommandInputComponent,
  getCommandShortcut,
  hasCommandSliceState,
  invokeCommandFromStore,
  listCommandsFromStore,
  registerCommandsForOwner,
  resolveCommandPolicyMetadata,
  unregisterCommandsForOwner,
  validateCommandInput,
} from './CommandSlice';
export type {
  CommandSliceState,
  CreateCommandSliceProps,
  RoomCommandDescriptor,
  RoomCommandExecuteOutput,
  RoomCommandKeystrokes,
  RoomCommandInvocation,
  RoomCommandInvokeFailureEvent,
  RoomCommandInvokeErrorEvent,
  RoomCommandInvocationOptions,
  RoomCommandInvokeStartEvent,
  RoomCommandInvokeSuccessEvent,
  RoomCommandMiddleware,
  RoomCommandMiddlewareNext,
  RegisteredRoomCommand,
  RoomCommand,
  RoomCommandInputComponent,
  RoomCommandInputComponentProps,
  RoomCommandListOptions,
  RoomCommandPolicyMetadata,
  RoomCommandPortableSchema,
  RoomCommandResult,
  RoomCommandRiskLevel,
  RoomCommandSurface,
  RoomCommandUiMetadata,
  RoomCommandExecutionContext,
  RoomCommandPredicate,
} from './CommandSlice';
export {
  createCommandCliAdapter,
  createCommandMcpAdapter,
} from './CommandAdapters';
export type {
  CommandCliAdapter,
  CommandCliAdapterOptions,
  CommandMcpAdapter,
  CommandMcpAdapterOptions,
  CommandMcpToolDescriptor,
} from './CommandAdapters';

// Re-export from @sqlrooms/room-config
// Values also export their corresponding types automatically (Zod pattern)
export {
  BaseDataSource,
  BaseRoomConfig,
  createDefaultBaseRoomConfig,
  DataSource,
  DataSourceTypes,
  DEFAULT_ROOM_TITLE,
  FileDataSource,
  isFileDataSource,
  isSpatialLoadFileOptions,
  isSqlQueryDataSource,
  isUrlDataSource,
  LoadFile,
  LoadFileOptions,
  MAIN_VIEW,
  SpatialLoadFileOptions,
  SpatialLoadOptions,
  SqlQueryDataSource,
  StandardLoadFileOptions,
  StandardLoadOptions,
  UrlDataSource,
  // New layout names
  LayoutDirection,
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
} from '@sqlrooms/room-config';
