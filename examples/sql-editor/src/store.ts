import {
  BaseProjectConfig,
  createProjectBuilderSlice,
  createProjectBuilderStore,
  LayoutTypes,
  MAIN_VIEW,
  ProjectBuilderState,
  StateCreator,
} from '@sqlrooms/project-builder';
import {
  createDefaultSqlEditorConfig,
  createSqlEditorSlice,
  SqlEditorSliceConfig,
  SqlEditorSliceState,
} from '@sqlrooms/sql-editor';
import {z} from 'zod';
import {persist} from 'zustand/middleware';

/**
 * Project config for saving
 */
export const AppConfig = BaseProjectConfig.merge(SqlEditorSliceConfig);
export type AppConfig = z.infer<typeof AppConfig>;

/**
 * Project state
 */

export type AppState = ProjectBuilderState<AppConfig> &
  SqlEditorSliceState & {
    // Add your own state here
  };

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
            nodes: MAIN_VIEW,
          },
          dataSources: [
            {
              tableName: 'earthquakes',
              type: 'url',
              url: 'https://raw.githubusercontent.com/keplergl/kepler.gl-data/refs/heads/master/earthquakes/data.csv',
            },
          ],
          ...createDefaultSqlEditorConfig(),
        },
        project: {
          panels: {
            // main: {
            //   component: MainView,
            //   placement: 'main',
            // },
          },
        },
      })(set, get, store),

      // Sql editor slice
      ...createSqlEditorSlice()(set, get, store),
    }),

    // Persist settings
    {
      // Local storage key
      name: 'sql-editor-example-app-state-storage',
      // Subset of the state to persist
      partialize: (state) => ({
        config: AppConfig.parse(state.config),
      }),
    },
  ) as StateCreator<AppState>,
);
