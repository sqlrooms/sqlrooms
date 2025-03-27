/**
 * {@include ../README.md}
 * @packageDocumentation
 */

export {FileDataSourceCard} from './data-sources/FileDataSourceCard';
export {FileDataSourcesPanel} from './data-sources/FileDataSourcesPanel';
export {TableCard} from './data-sources/TableCard';
export {TablesListPanel} from './data-sources/TablesListPanel';

export {ProjectBuilderPanel} from './panels/ProjectBuilderPanel';
export {ProjectBuilderPanelHeader} from './panels/ProjectBuilderPanelHeader';
export {PanelHeaderButton} from './panels/PanelHeaderButton';

export {
  ProjectBuilderSidebarButton,
  ProjectBuilderSidebarButtons,
  SidebarButton,
} from './ProjectBuilderSidebarButtons';

export {ProjectBuilder} from './ProjectBuilder';

export {createProjectStore as createProjectBuilderStore} from '@sqlrooms/project';

export {ProjectBuilderProvider} from './ProjectBuilderProvider';

export {
  createSlice,
  createProjectBuilderSlice,
  type ProjectBuilderState,
  type TaskProgress,
  type ProjectPanelInfo,
  useBaseProjectBuilderStore,
} from './ProjectBuilderStore';

export {
  DataSourceStatus,
  type DataSourceState,
  type ProjectFileInfo,
  type ProjectFileState,
} from './types';

export type {StateCreator, StoreApi} from 'zustand';
