/**
 * {@include ../README.md}
 * @packageDocumentation
 */

export {FileDataSourceCard} from './data-sources/FileDataSourceCard';
export {FileDataSourcesPanel} from './data-sources/FileDataSourcesPanel';
export {TableCard} from './data-sources/TableCard';
export {TablesListPanel} from './data-sources/TablesListPanel';

export {PanelHeaderButton} from './panels/PanelHeaderButton';
export {ProjectBuilderPanel} from './panels/ProjectBuilderPanel';
export {ProjectBuilderPanelHeader} from './panels/ProjectBuilderPanelHeader';

export {
  ProjectBuilderSidebarButton,
  ProjectBuilderSidebarButtons,
  SidebarButton,
} from './ProjectBuilderSidebarButtons';

export {ProjectBuilder} from './ProjectBuilder';

export {
  type TaskProgress,
  createProjectStore as createProjectBuilderStore,
} from '@sqlrooms/project';

export {ProjectBuilderProvider} from './ProjectBuilderProvider';

export {
  createProjectBuilderSlice,
  createSlice,
  useBaseProjectBuilderStore,
  type ProjectBuilderState,
  type ProjectPanelInfo,
} from './ProjectBuilderStore';

export type {StateCreator, StoreApi} from 'zustand';

export {
  DataSourceStatus,
  type DataSourceState,
  type ProjectFileInfo,
  type ProjectFileState,
} from './types';

// Re-export all project-config types
export * from '@sqlrooms/project-config';
