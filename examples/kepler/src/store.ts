import {createWasmDuckDbConnector} from '@sqlrooms/duckdb';
import {createKeplerSlice, KeplerSliceState} from '@sqlrooms/kepler';
import {
  createRoomShellSlice,
  createRoomStore,
  LayoutTypes,
  LoadFileOptions,
  MAIN_VIEW,
  RoomShellSliceState,
} from '@sqlrooms/room-shell';
import {createSqlEditorSlice, SqlEditorSliceState} from '@sqlrooms/sql-editor';
import {convertToValidColumnOrTableName} from '@sqlrooms/utils';
import {
  DatabaseIcon,
  Filter,
  Layers,
  Map as MapIcon,
  SlidersHorizontal,
} from 'lucide-react';
import {z} from 'zod';
import {DataPanel} from './components/DataPanel';
import {KeplerMapsContainer} from './components/KeplerMapsContainer';
import {
  KeplerSidePanelBaseMapManager,
  KeplerSidePanelFilterManager,
  KeplerSidePanelInteractionManager,
  KeplerSidePanelLayerManager,
} from './components/KeplerSidePanels';

export const RoomPanelTypes = z.enum([
  'data',
  'layers',
  'filters',
  'interactions',
  'basemaps',
  MAIN_VIEW,
] as const);
export type RoomPanelTypes = z.infer<typeof RoomPanelTypes>;

/**
 * Room config for saving
 */
export type RoomState = RoomShellSliceState &
  KeplerSliceState &
  SqlEditorSliceState & {
    addFile: (file: File, loadOptions?: LoadFileOptions) => Promise<string>;
  };
/**
 * Create a customized room store
 */
export const {roomStore, useRoomStore} = createRoomStore<RoomState>(
  (set, get, store) => {
    return {
      ...createRoomShellSlice({
        config: {
          dataSources: [
            {
              tableName: 'earthquakes',
              type: 'url',
              url: 'https://huggingface.co/datasets/sqlrooms/earthquakes/resolve/main/earthquakes.parquet',
            },
          ],
        },
        connector: createWasmDuckDbConnector({
          query: {
            // Prevents bigint errors in Kepler
            castTimestampToDate: true,
            castBigIntToDouble: true,
          },
        }),
        layout: {
          config: {
            type: LayoutTypes.enum.mosaic,
            nodes: {
              direction: 'row',
              first: RoomPanelTypes.enum['data'],
              second: MAIN_VIEW,
              splitPercentage: 30,
            },
          },
          panels: {
            [RoomPanelTypes.enum['data']]: {
              title: 'Data Sources',
              icon: DatabaseIcon,
              component: DataPanel,
              placement: 'sidebar',
            },
            [RoomPanelTypes.enum['layers']]: {
              title: 'Layers',
              icon: Layers,
              component: KeplerSidePanelLayerManager,
              placement: 'sidebar',
            },
            [RoomPanelTypes.enum['filters']]: {
              title: 'Filters',
              icon: Filter,
              component: KeplerSidePanelFilterManager,
              placement: 'sidebar',
            },
            [RoomPanelTypes.enum['interactions']]: {
              title: 'Interactions',
              icon: SlidersHorizontal,
              component: KeplerSidePanelInteractionManager,
              placement: 'sidebar',
            },
            [RoomPanelTypes.enum['basemaps']]: {
              title: 'Base Maps',
              icon: MapIcon,
              component: KeplerSidePanelBaseMapManager,
              placement: 'sidebar',
            },
            // MapIcon
            main: {
              title: 'Main view',
              icon: () => null,
              component: KeplerMapsContainer,
              placement: 'main',
            },
          },
        },
      })(set, get, store),

      initialize: async () => {
        const id = get().kepler.getCurrentMap()?.id;
        if (id) {
          await get().kepler.addTableToMap(id, 'earthquakes', {
            autoCreateLayers: true,
            centerMap: true,
          });
        }
      },

      ...createKeplerSlice({
        actionLogging: false,
      })(set, get, store),

      ...createSqlEditorSlice()(set, get, store),

      addFile: async (file, loadOptions) => {
        const tableName = convertToValidColumnOrTableName(file.name);
        await get().db.connector.loadFile(file, tableName, loadOptions);
        await get().db.refreshTableSchemas();
        await get().kepler.syncKeplerDatasets();
        const currentMapId = get().kepler.config.currentMapId;
        await get().kepler.addTableToMap(currentMapId, tableName);
        return tableName;
      },
    };
  },
);
