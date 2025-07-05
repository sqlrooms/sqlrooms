import {createWasmMotherDuckDbConnector} from '@sqlrooms/duckdb-motherduck';
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

// Local DuckDB bundle files for bundler environments

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

export type RoomState = RoomShellSliceState<RoomConfig> &
  SqlEditorSliceState & {
    // Add your own state here
  };

/**
 * Path to the preloaded extensions directory.
 * This is to avoid having to download the extensions from the
 * jsDelivr CDN to support offline work.
 *
 * See also https://github.com/observablehq/framework/pull/1734 for a more
 * comprehensive implementation of self-hosting DuckDB extensions.
 */

/**
 * Create a customized room store
 */
export const {roomStore, useRoomStore} = createRoomStore<RoomConfig, RoomState>(
  persist(
    (set, get, store) => ({
      // Base room slice
      ...createRoomShellSlice<RoomConfig>({
        connector: createWasmMotherDuckDbConnector({
          mdToken: '',
          initializationQuery: '',
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
      name: 'sql-editor-example-app-state-storage',
      // Subset of the state to persist
      partialize: (state) => ({
        config: RoomConfig.parse(state.config),
      }),
    },
  ) as StateCreator<RoomState>,
);
