/**
 * {@include ../README.md}
 * @packageDocumentation
 */

export {FileDataSourceCard} from './data-sources/FileDataSourceCard';
export {FileDataSourcesPanel} from './data-sources/FileDataSourcesPanel';
export {TableCard} from './data-sources/TableCard';
export {TablesListPanel} from './data-sources/TablesListPanel';

export {
  processDroppedFile,
  processDroppedFiles,
} from './utils/processDroppedFiles';

export {ProjectBuilderPanel} from './panels/ProjectBuilderPanel';
export {ProjectBuilderPanelHeader} from './panels/ProjectBuilderPanelHeader';
export {PanelHeaderButton} from './panels/PanelHeaderButton';

export {
  ProjectBuilderSidebarButton,
  ProjectBuilderSidebarButtons,
  SidebarButton,
} from './ProjectBuilderSidebarButtons';

export {ProjectBuilder} from './ProjectBuilder';

export {
  ProjectStateContext,
  ProjectStateProvider,
  useBaseProjectStore,
  type ProjectStateProviderProps,
} from './ProjectStateProvider';

export {ProjectBuilderProvider} from './ProjectBuilderProvider';

export {
  createSlice,
  createProjectSlice,
  createProjectStore,
  type TaskProgress,
  type ProjectPanelInfo,
  type ProjectState,
  type ProjectStateActions,
  type ProjectStateProps,
  type ProjectStore,
} from './ProjectStore';

export {
  DataSourceStatus,
  type DataSourceState,
  type ProjectFileInfo,
  type ProjectFileState,
} from './types';

export type {StateCreator} from 'zustand';
