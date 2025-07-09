import {
  createDefaultKeplerConfig,
  createKeplerSlice,
  KeplerSliceConfig,
  KeplerSliceState,
} from '@sqlrooms/kepler';
import {
  BaseRoomConfig,
  createRoomShellSlice,
  createRoomStore,
  LayoutTypes,
  LoadFileOptions,
  MAIN_VIEW,
  RoomShellSliceState,
} from '@sqlrooms/room-shell';
import {
  createDefaultSqlEditorConfig,
  createSqlEditorSlice,
  SqlEditorSliceConfig,
  SqlEditorSliceState,
} from '@sqlrooms/sql-editor';
import {
  DatabaseIcon,
  Filter,
  Layers,
  Map as MapIcon,
  SlidersHorizontal,
} from 'lucide-react';
import {z} from 'zod';
import {
  KeplerSidePanelBaseMapManager,
  KeplerSidePanelFilterManager,
  KeplerSidePanelInteractionManager,
  KeplerSidePanelLayerManager,
} from './components/KeplerSidePanels';
import {KeplerMapsContainer} from './components/KeplerMapsContainer';
import {DataPanel} from './components/DataPanel';
import {convertToValidColumnOrTableName} from '@sqlrooms/utils';

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
export const RoomConfig =
  BaseRoomConfig.merge(KeplerSliceConfig).merge(SqlEditorSliceConfig);
export type RoomConfig = z.infer<typeof RoomConfig>;

export type RoomState = RoomShellSliceState<RoomConfig> &
  KeplerSliceState<RoomConfig> &
  SqlEditorSliceState & {
    addFile: (file: File, loadOptions?: LoadFileOptions) => Promise<string>;
  };
/**
 * Create a customized room store
 */
export const {roomStore, useRoomStore} = createRoomStore<RoomConfig, RoomState>(
  (set, get, store) => {
    return {
      ...createRoomShellSlice<RoomConfig>({
        config: {
          layout: {
            type: LayoutTypes.enum.mosaic,
            nodes: {
              direction: 'row',
              first: RoomPanelTypes.enum['data'],
              second: MAIN_VIEW,
              splitPercentage: 30,
            },
          },
          // dataSources: [
          //   {
          //     tableName: 'earthquakes',
          //     type: 'url',
          //     url: 'https://raw.githubusercontent.com/keplergl/kepler.gl-data/refs/heads/master/earthquakes/data.csv',
          //   },
          // ],
          ...createDefaultKeplerConfig(),
          ...createDefaultSqlEditorConfig(),
        },
        room: {
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

      ...createKeplerSlice<RoomConfig>({
        actionLogging: true,
      })(set, get, store),

      ...createSqlEditorSlice()(set, get, store),

      addFile: async (file, loadOptions) => {
        const tableName = convertToValidColumnOrTableName(file.name);
        await get().db.connector.loadFile(file, tableName, loadOptions);
        await get().db.refreshTableSchemas();
        await get().kepler.syncKeplerDatasets();
        const currentMapId = get().config.kepler.currentMapId;
        await get().kepler.addTableToMap(currentMapId, tableName);
        return tableName;
      },
    };
  },
);
