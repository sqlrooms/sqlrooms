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
import {DatabaseIcon, MapIcon} from 'lucide-react';
import {z} from 'zod';
import DataSourcesPanel from './components/DataSourcesPanel';
import {MainView} from './components/MainView';
import {
  CosmosSliceConfig,
  createCosmosSlice,
  CosmosSliceState,
  createDefaultCosmosConfig,
} from '@sqlrooms/cosmos';

export const ProjectPanelTypes = z.enum(['data-sources', MAIN_VIEW] as const);

export type ProjectPanelTypes = z.infer<typeof ProjectPanelTypes>;

/**
 * Project config for saving
 */
export const AppConfig =
  BaseProjectConfig.merge(SqlEditorSliceConfig).merge(CosmosSliceConfig);

export type AppConfig = z.infer<typeof AppConfig>;

/**
 * Project state
 */
export type AppState = ProjectState<AppConfig> &
  SqlEditorSliceState &
  CosmosSliceState;

/**
 * Create a customized project store
 */
export const {projectStore, useProjectStore} = createProjectStore<
  AppConfig,
  AppState
>((set, get, store) => ({
  // Base project slice
  ...createProjectSlice<AppConfig>({
    config: {
      layout: {
        type: LayoutTypes.enum.mosaic,
        nodes: MAIN_VIEW,
      },
      dataSources: [
        {
          type: 'url',
          url: 'https://pub-334685c2155547fab4287d84cae47083.r2.dev/Cosmograph/publications/publications-sample-1pct.parquet',
          tableName: 'publications',
        },
      ],
      ...createDefaultSqlEditorConfig(),
      ...createDefaultCosmosConfig(),
    },
    project: {
      panels: {
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

  // Cosmos slice
  ...createCosmosSlice()(set, get, store),
}));
