import {
  createProjectSlice,
  createProjectStore,
  ProjectState,
} from '@sqlrooms/project-builder';
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
import {DatabaseIcon, InfoIcon, MapIcon} from 'lucide-react';
import {z} from 'zod';
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
>((set, get, store) => ({
  // Base project slice
  ...createProjectSlice<AppConfig>({
    project: {
      initialized: true,
      config: {
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
      panels: {
        [ProjectPanelTypes.enum['project-details']]: {
          title: 'Project Details',
          icon: InfoIcon,
          component: ProjectDetailsPanel,
          placement: 'sidebar',
        },
        [ProjectPanelTypes.enum['data-sources']]: {
          title: 'Data Sources',
          icon: DatabaseIcon,
          component: DataSourcesPanel,
          placement: 'sidebar',
        },
        main: {
          title: 'Main view',
          icon: MapIcon,
          component: MainView,
          placement: 'main',
        },
      },
    },
  })(set, get, store),

  // Sql editor slice
  ...createSqlEditorSlice()(set, get, store),
}));
