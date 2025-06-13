import {
  BaseRoomConfig,
  createRoomShellSlice,
  createRoomStore,
  LayoutTypes,
  RoomShellSliceState,
  StateCreator,
} from '@sqlrooms/room-shell';
import {
  createDefaultSqlEditorConfig,
  createSqlEditorSlice,
  SqlEditorSliceConfig,
  SqlEditorSliceState,
} from '@sqlrooms/sql-editor';
import {DatabaseIcon} from 'lucide-react';
import {z} from 'zod';
import {persist} from 'zustand/middleware';
import {DataPanel} from './DataPanel';
import {MainView} from './MainView';

export const RoomPanelTypes = z.enum(['data', 'main'] as const);
export type RoomPanelTypes = z.infer<typeof RoomPanelTypes>;

/**
 * Room config for saving
 */
export const AppConfig = BaseRoomConfig.merge(SqlEditorSliceConfig);
export type AppConfig = z.infer<typeof AppConfig>;

/**
 * Room state
 */

export type AppState = RoomShellSliceState<AppConfig> &
  SqlEditorSliceState & {
    // Add your own state here
  };

/**
 * Create a customized room store
 */
export const {roomStore, useRoomStore} = createRoomStore<AppConfig, AppState>(
  persist(
    (set, get, store) => ({
      // Base room slice
      ...createRoomShellSlice<AppConfig>({
        config: {
          layout: {
            type: LayoutTypes.enum.mosaic,
            nodes: {
              first: RoomPanelTypes.enum['data'],
              second: RoomPanelTypes.enum['main'],
              direction: 'row',
              splitPercentage: 30,
            },
          },
          dataSources: [
            // {
            //   tableName: 'earthquakes',
            //   type: 'url',
            //   url: 'https://raw.githubusercontent.com/keplergl/kepler.gl-data/refs/heads/master/earthquakes/data.csv',
            // },
          ],
          ...createDefaultSqlEditorConfig(),
        },
        room: {
          panels: {
            [RoomPanelTypes.enum['main']]: {
              component: MainView,
              placement: 'main',
            },
            [RoomPanelTypes.enum['data']]: {
              title: 'Data',
              component: DataPanel,
              icon: DatabaseIcon,
              placement: 'sidebar',
            },
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
