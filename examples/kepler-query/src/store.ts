import {createWasmDuckDbConnector} from '@sqlrooms/duckdb';
import {createKeplerSlice, KeplerSliceState} from '@sqlrooms/kepler';
import {
  createRoomShellSlice,
  createRoomStore,
  LayoutTypes,
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
  TerminalIcon,
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
import {SqlEditorPanel} from './components/SqlEditorPanel';

export const RoomPanelTypes = z.enum([
  'data',
  'layers',
  'filters',
  'interactions',
  'basemaps',
  'sql-editor',
  MAIN_VIEW,
] as const);
export type RoomPanelTypes = z.infer<typeof RoomPanelTypes>;

export type RoomState = RoomShellSliceState &
  KeplerSliceState &
  SqlEditorSliceState;

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
              second: {
                direction: 'row',
                first: MAIN_VIEW,
                second: RoomPanelTypes.enum['sql-editor'],
                splitPercentage: 60,
              },
              splitPercentage: 25,
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
            [RoomPanelTypes.enum['sql-editor']]: {
              title: 'SQL Editor',
              icon: TerminalIcon,
              component: SqlEditorPanel,
              placement: 'main',
            },
            main: {
              title: 'Map',
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

      addFile: async (file: File) => {
        const tableName = convertToValidColumnOrTableName(file.name);
        await get().db.connector.loadFile(file, tableName);
        await get().db.refreshTableSchemas();
        return tableName;
      },
    };
  },
);
