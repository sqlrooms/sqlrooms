import {createPyodideDuckDbConnector} from '@sqlrooms/pyodide';
import {
  BaseRoomConfig,
  createRoomShellSlice,
  LayoutTypes,
  RoomShellSliceState,
  StateCreator,
} from '@sqlrooms/room-shell';
import {createRoomStoreCreator} from '@sqlrooms/room-store';
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
export const RoomConfig = BaseRoomConfig.merge(SqlEditorSliceConfig);
export type RoomConfig = z.infer<typeof RoomConfig>;

/**
 * Room state
 */
export type RoomState = RoomShellSliceState<RoomConfig> & SqlEditorSliceState;

const {createRoomStore, useRoomStore} = createRoomStoreCreator<RoomState>()(
  () =>
    persist(
      (set, get, store) => ({
        ...createRoomShellSlice<RoomConfig>({
          connector: createPyodideDuckDbConnector({}),
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
        name: 'pyodide-sql-editor-example-app-state-storage',
        // Subset of the state to persist
        partialize: (state) => ({
          config: RoomConfig.parse(state.config),
        }),
      },
    ) as StateCreator<RoomState>,
);

export {createRoomStore, useRoomStore};

