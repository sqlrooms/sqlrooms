import {createWebSocketDuckDbConnector} from '@sqlrooms/duckdb';
import {
  BaseRoomConfig,
  createRoomShellSlice,
  createRoomStore,
  LayoutConfig,
  LayoutTypes,
  persistSliceConfigs,
  RoomShellSliceState,
} from '@sqlrooms/room-shell';
import {
  createDefaultSqlEditorConfig,
  createSqlEditorSlice,
  SqlEditorSliceConfig,
  SqlEditorSliceState,
} from '@sqlrooms/sql-editor';
import {DatabaseIcon} from 'lucide-react';
import {z} from 'zod';
import {DataPanel} from './DataPanel';
import {MainView} from './MainView';

// Local DuckDB bundle files for bundler environments
// import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
// import duckdb_wasm_eh from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
// import duckdb_wasm_coi from '@duckdb/duckdb-wasm/dist/duckdb-coi.wasm?url';
// import mvp_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
// import eh_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';
// import coi_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-coi.worker.js?url';
// import coi_pthread_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-coi.pthread.worker.js?url';

// const BUNDLES: DuckDBBundles = {
//   mvp: {
//     mainModule: duckdb_wasm,
//     mainWorker: mvp_worker,
//   },
//   eh: {
//     mainModule: duckdb_wasm_eh,
//     mainWorker: eh_worker,
//   },
//   coi: {
//     mainModule: duckdb_wasm_coi,
//     mainWorker: coi_worker,
//     pthreadWorker: coi_pthread_worker,
//   },
// };

export const RoomPanelTypes = z.enum(['data', 'main'] as const);
export type RoomPanelTypes = z.infer<typeof RoomPanelTypes>;

/**
 * Room state
 */

export type RoomState = RoomShellSliceState & SqlEditorSliceState;

/**
 * Path to the preloaded extensions directory.
 * This is to avoid having to download the extensions from the
 * jsDelivr CDN to support offline work.
 *
 * See also https://github.com/observablehq/framework/pull/1734 for a more
 * comprehensive implementation of self-hosting DuckDB extensions.
 */
// const EXTENSIONS_PATH = `${globalThis.location.origin}/extensions`;

/**
 * Create a customized room store
 */
export const {roomStore, useRoomStore} = createRoomStore<RoomState>(
  persistSliceConfigs(
    {
      name: 'sql-editor-example-app-state-storage',
      sliceConfigSchemas: {
        room: BaseRoomConfig,
        layout: LayoutConfig,
        sqlEditor: SqlEditorSliceConfig,
      },
    },
    (set, get, store) => ({
      // Base room slice
      ...createRoomShellSlice({
        connector: createWebSocketDuckDbConnector({
          authToken: 'secret123',
          wsUrl: 'ws://localhost:4000',
          subscribeChannels: ['table:earthquakes'],
          onNotification: (payload) => {
            console.log('Notification from server:', payload);
          },
        }),
        config: {
          dataSources: [
            {
              type: 'url',
              url: 'https://pub-334685c2155547fab4287d84cae47083.r2.dev/earthquakes.parquet',
              tableName: 'earthquakes',
            },
          ],
          ...createDefaultSqlEditorConfig(),
        },
        layout: {
          config: {
            type: LayoutTypes.enum.mosaic,
            nodes: {
              first: RoomPanelTypes.enum['data'],
              second: RoomPanelTypes.enum['main'],
              direction: 'row',
              splitPercentage: 30,
            },
          },
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
  ),
);
