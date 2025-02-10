import {createProjectStore, ProjectState} from '@sqlrooms/project-builder';
import {
  BaseProjectConfig,
  LayoutTypes,
  MAIN_VIEW,
} from '@sqlrooms/project-config';
import {
  createDefaultSqlEditorConfig,
  createSqlEditorSlice,
  SqlEditorSliceConfig,
  SqlEditorSliceState,
} from '@sqlrooms/sql-editor';
import {DatabaseIcon, InfoIcon, MapIcon, TableIcon} from 'lucide-react';
import {z} from 'zod';
import AddDataModal from '../components/add-data/AddDataModal';
import DataSourcesPanel from '../components/DataSourcesPanel';
import {MainView} from '../components/MainView';
import ProjectDetailsPanel from '../components/ProjectDetailsPanel';

export const ProjectPanelTypes = z.enum([
  'project-details',
  'data-sources',
  'data-tables',
  'docs',
  MAIN_VIEW,
] as const);

export type ProjectPanelTypes = z.infer<typeof ProjectPanelTypes>;

/**
 * Project config for saving
 */
export const AppConfig = BaseProjectConfig.merge(SqlEditorSliceConfig);
export type AppConfig = z.infer<typeof AppConfig>;

/**
 * Project state
 */
export type AppState = ProjectState<AppConfig> & SqlEditorSliceState;

/**
 * Create a customized project store
 */
export const {projectStore, useProjectStore} = createProjectStore<
  AppConfig,
  AppState
>(
  {
    initialized: true,
    projectConfig: {
      title: 'Demo App Project',
      layout: {
        type: LayoutTypes.enum.mosaic,
        nodes: {
          direction: 'row',
          first: ProjectPanelTypes.enum['data-sources'],
          second: MAIN_VIEW,
          splitPercentage: 30,
        },
      },
      dataSources: [],
      ...createDefaultSqlEditorConfig(),
    },
    projectPanels: {
      [ProjectPanelTypes.enum['project-details']]: {
        title: 'Project Details',
        icon: InfoIcon,
        component: () => <ProjectDetailsPanel />,
        placement: 'sidebar',
      },
      [ProjectPanelTypes.enum['data-sources']]: {
        title: 'Data Sources',
        icon: DatabaseIcon,
        component: () => <DataSourcesPanel AddDataModal={AddDataModal} />,
        placement: 'sidebar',
      },
      [ProjectPanelTypes.enum['data-tables']]: {
        title: 'Prepared Data Tables',
        icon: TableIcon,
        component: () => <div>Data Tables</div>,
        placement: 'sidebar-bottom',
      },
      main: {
        title: 'Main view',
        icon: MapIcon,
        component: MainView,
        placement: 'main',
      },
    },
  },

  createSqlEditorSlice(),
);
