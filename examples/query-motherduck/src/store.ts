import {createWasmMotherDuckDbConnector} from '@sqlrooms/duckdb-motherduck';
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

// Local DuckDB bundle files for bundler environments

export const RoomPanelTypes = z.enum(['data', 'main'] as const);
export type RoomPanelTypes = z.infer<typeof RoomPanelTypes>;

/**
 * Room config for saving
 */
export const RoomConfig = BaseRoomConfig.merge(SqlEditorSliceConfig).extend({
  motherDuckToken: z.string().optional(),
});
export type RoomConfig = z.infer<typeof RoomConfig>;

/**
 * Room state
 */

export type RoomState = RoomShellSliceState<RoomConfig> &
  SqlEditorSliceState & {
    motherDuckToken?: string;
    setMotherDuckToken: (token: string) => void;
  };

const {createRoomStore, useRoomStore} = createRoomStoreCreator<
  RoomConfig,
  RoomState
>()(
  (mdToken: string) =>
    // persist(
    (set, get, store) => {
      return {
        ...createRoomShellSlice<RoomConfig>({
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
            motherDuckToken: mdToken,
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
        motherDuckToken: mdToken,
        setMotherDuckToken: (token: string) => {
          set((state) => ({
            motherDuckToken: token,
            config: {...state.config, motherDuckToken: token},
          }));
        },
      };
    },
  //   // Persist settings
  //   {
  //     // Local storage key
  //     name: 'sql-editor-example-app-state-storage',
  //     // Subset of the state to persist
  //     partialize: (state) => ({
  //       config: RoomConfig.parse(state.config),
  //       motherDuckToken: state.motherDuckToken,
  //     }),
  //   },
  // ) as StateCreator<RoomState>,
);

createRoomStore('test-token');

const setMotherDuckToken = useRoomStore((state) => state.setMotherDuckToken);

setMotherDuckToken('test-token');

export {createRoomStore, useRoomStore};
