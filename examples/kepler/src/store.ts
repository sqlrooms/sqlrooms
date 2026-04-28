import {
  createArtifactPanelDefinition,
  createArtifactsSlice,
  defineArtifactTypes,
  type ArtifactsSliceState,
  type ArtifactTypeDefinition,
} from '@sqlrooms/artifacts';
import {createWasmDuckDbConnector} from '@sqlrooms/duckdb';
import {createKeplerSlice, KeplerSliceState} from '@sqlrooms/kepler';
import {
  createRoomShellSlice,
  createRoomStore,
  LayoutConfig,
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
import {KeplerMapArtifactPanel} from './components/KeplerMapArtifactPanel';
import {KeplerMapsContainer} from './components/KeplerMapsContainer';
import {
  KeplerSidePanelBaseMapManager,
  KeplerSidePanelFilterManager,
  KeplerSidePanelInteractionManager,
  KeplerSidePanelLayerManager,
} from './components/KeplerSidePanels';

export const RoomPanelTypes = z.enum([
  'left',
  'data',
  'layers',
  'filters',
  'interactions',
  'basemaps',
  MAIN_VIEW,
] as const);
export type RoomPanelTypes = z.infer<typeof RoomPanelTypes>;

const DEFAULT_KEPLER_MAP_ID = 'default-kepler-map';

/**
 * Room config for saving
 */
export type RoomState = RoomShellSliceState &
  KeplerSliceState &
  ArtifactsSliceState &
  SqlEditorSliceState & {
    addFile: (file: File, loadOptions?: LoadFileOptions) => Promise<string>;
  };

export const KEPLER_ARTIFACT_TYPES = defineArtifactTypes({
  'kepler-map': {
    label: 'Map',
    defaultTitle: 'Untitled Map',
    icon: MapIcon,
    component: KeplerMapArtifactPanel,
    onCreate: ({artifactId, artifact, store}) => {
      store.getState().kepler.ensureMap(artifactId, artifact.title);
    },
    onEnsure: ({artifactId, artifact, store}) => {
      store.getState().kepler.ensureMap(artifactId, artifact.title);
    },
    onRename: ({artifactId, artifact, store}) => {
      store.getState().kepler.renameMap(artifactId, artifact.title);
    },
    onDelete: ({artifactId, store}) => {
      store.getState().kepler.deleteMap(artifactId);
    },
  },
} satisfies Record<'kepler-map', ArtifactTypeDefinition<RoomState>>);

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
            id: 'root',
            type: 'split',
            direction: 'row',
            children: [
              {
                type: 'tabs',
                id: RoomPanelTypes.enum['left'],
                children: [RoomPanelTypes.enum['data']],
                defaultSize: '30%',
                maxSize: '50%',
                minSize: '300px',
                activeTabIndex: 0,
                collapsible: true,
                collapsed: true,
                collapsedSize: 0,
                hideTabStrip: true,
              },
              {
                type: 'tabs',
                id: RoomPanelTypes.enum['main'],
                panel: RoomPanelTypes.enum['main'],
                children: [],
                activeTabIndex: 0,
                defaultSize: '70%',
              },
            ],
          } satisfies LayoutConfig,
          panels: {
            [RoomPanelTypes.enum['data']]: {
              title: 'Data',
              icon: DatabaseIcon,
              component: DataPanel,
            },
            [RoomPanelTypes.enum['layers']]: {
              title: 'Layers',
              icon: Layers,
              component: KeplerSidePanelLayerManager,
            },
            [RoomPanelTypes.enum['filters']]: {
              title: 'Filters',
              icon: Filter,
              component: KeplerSidePanelFilterManager,
            },
            [RoomPanelTypes.enum['interactions']]: {
              title: 'Interactions',
              icon: SlidersHorizontal,
              component: KeplerSidePanelInteractionManager,
            },
            [RoomPanelTypes.enum['basemaps']]: {
              title: 'Base Maps',
              icon: MapIcon,
              component: KeplerSidePanelBaseMapManager,
            },
            // MapIcon
            [RoomPanelTypes.enum['main']]: {
              title: 'Main view',
              icon: () => null,
              component: KeplerMapsContainer,
            },
            artifact: createArtifactPanelDefinition(
              KEPLER_ARTIFACT_TYPES,
              store,
            ),
          },
        },
      })(set, get, store),

      initialize: async () => {
        const mapId = get().kepler.getCurrentMap()?.id;
        const datasetId = 'earthquakes';
        const layerId = 'earthquakes';
        if (mapId) {
          await get().kepler.addTableToMap(
            mapId,
            'earthquakes',
            {autoCreateLayers: false, centerMap: true},
            {
              version: 'v1',
              config: {
                visState: {
                  layers: [
                    {
                      id: layerId,
                      type: 'point',
                      config: {
                        dataId: datasetId,
                        columnMode: 'points',
                        label: 'Earthquakes',
                        columns: {lat: 'Latitude', lng: 'Longitude'},
                      },
                      visualChannels: {
                        colorField: {name: 'Depth', type: 'real'},
                        colorScale: 'quantile',
                        sizeField: {name: 'Magnitude', type: 'real'},
                        sizeScale: 'sqrt',
                      },
                    },
                  ],
                },
                mapStyle: {topLayerGroups: {label: true}},
              },
            },
          );
        }
      },

      ...createKeplerSlice({
        actionLogging: false,
        config: {
          maps: [
            {
              id: DEFAULT_KEPLER_MAP_ID,
              name: 'Untitled Map',
              lastOpenedAt: Date.now(),
            },
          ],
          currentMapId: DEFAULT_KEPLER_MAP_ID,
        },
      })(set, get, store),

      ...createArtifactsSlice<RoomState>({
        artifactTypes: KEPLER_ARTIFACT_TYPES,
        config: {
          artifactsById: {
            [DEFAULT_KEPLER_MAP_ID]: {
              id: DEFAULT_KEPLER_MAP_ID,
              type: 'kepler-map',
              title: 'Untitled Map',
            },
          },
          artifactOrder: [DEFAULT_KEPLER_MAP_ID],
          currentArtifactId: DEFAULT_KEPLER_MAP_ID,
        },
      })(set, get, store),

      ...createSqlEditorSlice()(set, get, store),

      addFile: async (file, loadOptions) => {
        const tableName = convertToValidColumnOrTableName(file.name);
        await get().db.connector.loadFile(file, tableName, loadOptions);
        await get().db.refreshTableSchemas();
        await get().kepler.syncKeplerDatasets();
        const currentMapId = get().kepler.getCurrentMap()?.id;
        if (currentMapId) {
          await get().kepler.addTableToMap(currentMapId, tableName);
        }
        return tableName;
      },
    };
  },
);
