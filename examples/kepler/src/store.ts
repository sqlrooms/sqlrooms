import {
  createDefaultKeplerConfig,
  createKeplerSlice,
  KeplerSliceConfig,
  KeplerSliceState,
} from '@sqlrooms/kepler';
import {
  createRoomShellSlice,
  BaseRoomConfig,
  LayoutTypes,
  MAIN_VIEW,
  RoomShellSliceState,
  createRoomStore,
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
import {DataSourcesPanel} from './components/DataSourcesPanel';
import {
  KeplerSidePanelBaseMapManager,
  KeplerSidePanelFilterManager,
  KeplerSidePanelInteractionManager,
  KeplerSidePanelLayerManager,
} from './components/KeplerSidePanels';
import {MainView} from './components/MainView';

export const RoomPanelTypes = z.enum([
  'data-sources',
  'kepler-layers',
  'kepler-filters',
  'kepler-interactions',
  'kepler-basemaps',
  MAIN_VIEW,
] as const);
export type RoomPanelTypes = z.infer<typeof RoomPanelTypes>;

/**
 * Room config for saving
 */
export const RoomConfig =
  BaseRoomConfig.merge(KeplerSliceConfig).merge(SqlEditorSliceConfig);
export type RoomConfig = z.infer<typeof RoomConfig>;

/**
 * Room state
 */
type CustomRoomState = {
  // TODO: Add custom state here
};
export type RoomState = RoomShellSliceState<RoomConfig> &
  KeplerSliceState<RoomConfig> &
  SqlEditorSliceState &
  CustomRoomState;

/**
 * Create a customized room store
 */
export const {roomStore, useRoomStore} = createRoomStore<RoomConfig, RoomState>(
  (set, get, store) => {
    // Base room slice
    const roomSlice = createRoomShellSlice<RoomConfig>({
      config: {
        layout: {
          type: LayoutTypes.enum.mosaic,
          nodes: {
            direction: 'row',
            first: RoomPanelTypes.enum['data-sources'],
            second: MAIN_VIEW,
            splitPercentage: 30,
          },
        },
        dataSources: [
          {
            tableName: 'earthquakes',
            type: 'url',
            url: 'https://raw.githubusercontent.com/keplergl/kepler.gl-data/refs/heads/master/earthquakes/data.csv',
          },
        ],
        ...createDefaultKeplerConfig(),
        ...createDefaultSqlEditorConfig(),
      },
      room: {
        panels: {
          [RoomPanelTypes.enum['data-sources']]: {
            title: 'Data Sources',
            icon: DatabaseIcon,
            component: DataSourcesPanel,
            placement: 'sidebar',
          },
          [RoomPanelTypes.enum['kepler-layers']]: {
            title: 'Layers',
            icon: Layers,
            component: KeplerSidePanelLayerManager,
            placement: 'sidebar',
          },
          [RoomPanelTypes.enum['kepler-filters']]: {
            title: 'Filters',
            icon: Filter,
            component: KeplerSidePanelFilterManager,
            placement: 'sidebar',
          },
          [RoomPanelTypes.enum['kepler-interactions']]: {
            title: 'Interactions',
            icon: SlidersHorizontal,
            component: KeplerSidePanelInteractionManager,
            placement: 'sidebar',
          },
          [RoomPanelTypes.enum['kepler-basemaps']]: {
            title: 'Base Maps',
            icon: MapIcon,
            component: KeplerSidePanelBaseMapManager,
            placement: 'sidebar',
          },
          // MapIcon
          main: {
            title: 'Main view',
            icon: () => null,
            component: MainView,
            placement: 'main',
          },
        },
      },
    })(set, get, store);

    const keplerSlice = createKeplerSlice<RoomConfig>({
      actionLogging: true,
    })(set, get, store);

    return {
      ...roomSlice,
      room: {
        ...roomSlice.room,
        addRoomFile: async (file, tName, loadOptions) => {
          const addedTable = await roomSlice.room.addRoomFile(
            file,
            tName,
            loadOptions,
          );
          if (!addedTable) {
            return;
          }
          const currentMapId = get().config.kepler.currentMapId;
          get().kepler.addTableToMap(currentMapId, addedTable.tableName);
          return addedTable;
        },
      },

      ...keplerSlice,
      ...createSqlEditorSlice()(set, get, store),
    };
  },
);
