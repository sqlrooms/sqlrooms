import {
  BaseRoomConfig,
  createRoomShellSlice,
  createRoomShellStore,
  LayoutTypes,
  MAIN_VIEW,
  RoomShellState,
  StateCreator,
} from '@sqlrooms/room-shell';
import {
  createDefaultSqlEditorConfig,
  createSqlEditorSlice,
  SqlEditorSliceConfig,
  SqlEditorSliceState,
} from '@sqlrooms/sql-editor';
import {z} from 'zod';
import {persist} from 'zustand/middleware';

/**
 * Room config for saving
 */
export const AppConfig = BaseRoomConfig.merge(SqlEditorSliceConfig);
export type AppConfig = z.infer<typeof AppConfig>;

/**
 * Room state
 */

export type AppState = RoomShellState<AppConfig> &
  SqlEditorSliceState & {
    // Add your own state here
  };

/**
 * Create a customized room store
 */
export const {roomStore, useRoomStore} = createRoomShellStore<
  AppConfig,
  AppState
>(
  persist(
    (set, get, store) => ({
      // Base room slice
      ...createRoomShellSlice<AppConfig>({
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
        room: {
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
