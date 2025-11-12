import {createWasmMotherDuckDbConnector} from '@sqlrooms/motherduck';
import {
  createRoomShellSlice,
  LayoutTypes,
  RoomShellSliceState,
  StateCreator,
} from '@sqlrooms/room-shell';
import {
  BaseRoomConfig,
  createPersistHelpers,
  createRoomStoreCreator,
  LayoutConfig,
} from '@sqlrooms/room-store';
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
 * Room state
 */
export type RoomState = RoomShellSliceState & SqlEditorSliceState;

const {createRoomStore, useRoomStore} = createRoomStoreCreator<RoomState>()(
  (mdToken: string) =>
    persist(
      (set, get, store) => ({
        ...createRoomShellSlice({
          connector: createWasmMotherDuckDbConnector({
            mdToken,
          }),
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
        name: 'md-sql-editor-example-app-state-storage',
        // Helper to extract and merge slice configs
        ...createPersistHelpers({
          room: BaseRoomConfig,
          layout: LayoutConfig,
          sqlEditor: SqlEditorSliceConfig,
        }),
      },
    ) as StateCreator<RoomState>,
);

export {createRoomStore, useRoomStore};
