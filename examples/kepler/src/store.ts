import {
  createDefaultKeplerConfig,
  createKeplerSlice,
  KeplerSliceConfig,
  KeplerSliceState,
} from '@sqlrooms/kepler';
import {
  createProjectBuilderSlice,
  createProjectBuilderStore,
  ProjectBuilderState,
  StateCreator,
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
import {DatabaseIcon} from 'lucide-react';
import {z} from 'zod';
import {persist} from 'zustand/middleware';
import {DataSourcesPanel} from './components/DataSourcesPanel';
import {MainView} from './components/MainView';

export const ProjectPanelTypes = z.enum(['data-sources', MAIN_VIEW] as const);
export type ProjectPanelTypes = z.infer<typeof ProjectPanelTypes>;

/**
 * Project config for saving
 */
export const AppConfig =
  BaseProjectConfig.merge(KeplerSliceConfig).merge(SqlEditorSliceConfig);
export type AppConfig = z.infer<typeof AppConfig>;

/**
 * Project state
 */
type CustomAppState = {
  // TODO: Add custom state here
};
export type AppState = ProjectBuilderState<AppConfig> &
  KeplerSliceState &
  SqlEditorSliceState &
  CustomAppState;

/**
 * Create a customized project store
 */
export const {projectStore, useProjectStore} = createProjectBuilderStore<
  AppConfig,
  AppState
>(
  persist(
    (set, get, store) => ({
      // Base project slice
      ...createProjectBuilderSlice<AppConfig>({
        config: {
          layout: {
            type: LayoutTypes.enum.mosaic,
            nodes: {
              direction: 'row',
              first: ProjectPanelTypes.enum['data-sources'],
              second: MAIN_VIEW,
              splitPercentage: 30,
            },
          },
          dataSources: [
            {
              tableName: 'earthquakes',
              type: 'url',
              url: 'https://raw.githubusercontent.com/keplergl/kepler.gl-data/refs/heads/master/earthquakes/data.csv',
            },
          ],
          ...createDefaultKeplerConfig(),
          ...createDefaultSqlEditorConfig(),
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
              icon: () => null,
              component: MainView,
              placement: 'main',
            },
          },
        },
      })(set, get, store),

      ...createKeplerSlice({
        actionLogging: true,
      })(set, get, store),

      ...createSqlEditorSlice()(set, get, store),
    }),
    // Persist settings
    {
      // Local storage key
      name: 'sqlrooms-kepler-app-state-storage',
      // Subset of the state to persist
      partialize: (state) => ({
        config: AppConfig.parse(state.config),
      }),
    },
  ) as StateCreator<AppState>,
);
