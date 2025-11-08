/**
 * {@include ../README.md}
 * @packageDocumentation
 */

export {RoomShell} from './RoomShell';

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

export {
  createRoomShellSlice,
  createSlice,
  useBaseRoomShellStore,
  type RoomShellSliceState,
} from './RoomShellSlice';

export type {StateCreator, StoreApi} from 'zustand';

export {
  DataSourceStatus,
  type DataSourceState,
  type RoomFileInfo,
  type RoomFileState,
} from './types';

export * from '@sqlrooms/room-store';

export {type RoomPanelInfo} from '@sqlrooms/layout';
