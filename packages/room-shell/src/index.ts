/**
 * {@include ../README.md}
 * @packageDocumentation
 */

export {FileDataSourceCard} from './data-sources/FileDataSourceCard';
export {FileDataSourcesPanel} from './data-sources/FileDataSourcesPanel';
export {TableCard} from './data-sources/TableCard';
export {TablesListPanel} from './data-sources/TablesListPanel';

export {PanelHeaderButton} from './panels/RoomHeaderButton';
export {RoomPanel} from './panels/RoomPanel';
export {RoomPanelHeader} from './panels/RoomPanelHeader';

export {
  RoomShellSidebarButton,
  RoomShellSidebarButtons,
  SidebarButton,
} from './RoomShellSidebarButtons';

export {type TaskProgress, createRoomStore} from '../../room-store/dist';

export {
  createRoomShellSlice,
  createSlice,
  useBaseRoomShellStore,
  type RoomShellSliceState,
} from './RoomShellStore';

export type {StateCreator, StoreApi} from 'zustand';

export {
  DataSourceStatus,
  type DataSourceState,
  type RoomFileInfo,
  type RoomFileState,
} from './types';

// Re-export all room-config types
export * from '@sqlrooms/room-config';
export {RoomShell} from './RoomShell';
export {type RoomPanelInfo} from '@sqlrooms/layout';
