import {
  addDataToMap,
  deleteEntry,
  ActionTypes as KeplerActionTypes,
  registerEntry,
  removeDataset,
  requestMapStyles,
  wrapTo,
} from '@kepler.gl/actions';
import {ALL_FIELD_TYPES, VectorTileDatasetMetadata} from '@kepler.gl/constants';
import {
  castDuckDBTypesForKepler,
  getDuckDBColumnTypes,
  getDuckDBColumnTypesMap,
  restoreGeoarrowMetadata,
  setGeoArrowWKBExtension,
} from '@kepler.gl/duckdb';
import {arrowSchemaToFields} from '@kepler.gl/processors';
import {
  INITIAL_UI_STATE,
  keplerGlReducer,
  KeplerGlState,
  MapStyle,
} from '@kepler.gl/reducers';
import KeplerGLSchemaManager from '@kepler.gl/schemas';
import {KeplerTable} from '@kepler.gl/table';
import {AddDataToMapPayload} from '@kepler.gl/types';
import {
  DatabaseConnection,
  initApplicationConfig,
  KeplerApplicationConfig,
} from '@kepler.gl/utils';
import {createId} from '@paralleldrive/cuid2';
import {DuckDbSliceState} from '@sqlrooms/duckdb';
import {KeplerMapSchema, KeplerSliceConfig} from '@sqlrooms/kepler-config';
import {
  BaseRoomStoreState,
  createSlice,
  RoomShellSliceState,
  useBaseRoomShellStore,
  type StateCreator,
} from '@sqlrooms/room-shell';
import * as arrow from 'apache-arrow';
import {produce} from 'immer';
import {taskMiddleware} from 'react-palm/tasks';
import type {
  Action,
  AnyAction,
  MiddlewareAPI,
  Store as ReduxStore,
} from 'redux';
import {compose, Dispatch, Middleware} from 'redux';
import {createLogger, ReduxLoggerOptions} from 'redux-logger';

class DesktopKeplerTable extends KeplerTable {
  static getInputDataValidator = function () {
    // Default validator accepts only string timestamps
    return (d: any) => d;
  };
}

export type KeplerGLBasicProps = {
  mapboxApiAccessToken?: string;
};

export type CreateKeplerSliceOptions = {
  config?: Partial<KeplerSliceConfig>;
  initialKeplerState?: Partial<KeplerGlState>;
  basicKeplerProps?: Partial<KeplerGLBasicProps>;
  actionLogging?: boolean | ReduxLoggerOptions;
  middlewares?: Middleware[];
  applicationConfig?: KeplerApplicationConfig;
  /**
   * Called when a kepler action is dispatched
   * @param mapId - The map id
   * @param action - The action
   */
  onAction?: (mapId: string, action: KeplerAction) => void;
};

export function createDefaultKeplerConfig(
  props?: Partial<KeplerSliceConfig>,
): KeplerSliceConfig {
  const mapId = createId();
  return {
    maps: [
      {
        id: mapId,
        name: 'Untitled Map',
        config: undefined,
      },
    ],
    currentMapId: mapId,
    ...props,
  };
}

export type KeplerAction = {
  type: string;
  payload?: unknown;
};

export function hasMapId(action: KeplerAction): action is KeplerAction & {
  payload: {meta: {_id_: string}};
} {
  return (
    typeof action.payload === 'object' &&
    action.payload !== null &&
    'meta' in action.payload &&
    typeof action.payload.meta === 'object' &&
    action.payload.meta !== null &&
    '_id_' in action.payload.meta
  );
}

// support multiple kepler maps
export type KeplerGlReduxState = {[id: string]: KeplerGlState};
export type KeplerSliceState = {
  kepler: {
    config: KeplerSliceConfig;
    map: KeplerGlReduxState;
    basicKeplerProps?: Partial<KeplerGLBasicProps>;
    forwardDispatch: {
      [mapId: string]: Dispatch;
    };
    initialize: () => Promise<void>;
    setConfig: (config: KeplerSliceConfig) => void;
    /**
     * Update the datasets in all the kepler map so that they correspond to
     * the latest table schemas in the database
     */
    syncKeplerDatasets: () => Promise<void>;
    addTableToMap: (
      mapId: string,
      tableName: string,
      options?: AddDataToMapPayload['options'],
    ) => Promise<void>;
    addTileSetToMap: (
      mapId: string,
      tableName: string,
      tileset: {
        name: string;
        type: string;
        metadata: VectorTileDatasetMetadata;
      },
      tileMetadata: Record<string, any>,
    ) => void;
    addConfigToMap: (mapId: string, config: KeplerMapSchema) => void;
    removeDatasetFromMaps: (datasetId: string) => void;
    dispatchAction: (mapId: string, action: KeplerAction) => void;
    setCurrentMapId: (mapId: string) => void;
    createMap: (name?: string) => void;
    deleteMap: (mapId: string) => void;
    renameMap: (mapId: string, name: string) => void;
    getCurrentMap: () => KeplerMapSchema | undefined;
    registerKeplerMapIfNotExists: (mapId: string) => void;
    __reduxProviderStore: ReduxStore<KeplerGlReduxState, AnyAction> | undefined;
  };
};

// Auto save will be triggered in middleware on every kepler action
// skip these actions to avoid unnecessary save
const SKIP_AUTO_SAVE_ACTIONS: string[] = [
  KeplerActionTypes.LAYER_HOVER,
  KeplerActionTypes.UPDATE_MAP,
];

export function createKeplerSlice({
  basicKeplerProps = {},
  config: initialConfigProps,
  initialKeplerState = {
    mapStyle: {styleType: 'positron'} as MapStyle,
    uiState: {
      ...INITIAL_UI_STATE,
      currentModal: null,
      mapControls: {
        visibleLayers: INITIAL_UI_STATE.mapControls.visibleLayers,
        mapLegend: {
          show: true,
          active: false,
        },
        toggle3d: {
          show: true,
          active: false,
        },
      },
    },
  },
  actionLogging = false,
  middlewares: additionalMiddlewares = [],
  applicationConfig,
  onAction,
}: CreateKeplerSliceOptions = {}): StateCreator<KeplerSliceState> {
  const initialConfig = createDefaultKeplerConfig(initialConfigProps);
  initApplicationConfig({
    table: DesktopKeplerTable,
    ...applicationConfig,
  });
  return createSlice<KeplerSliceState, BaseRoomStoreState & KeplerSliceState & DuckDbSliceState>((set, get) => {
    const keplerReducer = keplerGlReducer.initialState(initialKeplerState);
    const middlewares: Middleware[] = [
      taskMiddleware,
      saveKeplerConfigMiddleware,
      ...additionalMiddlewares,
    ];

    if (actionLogging) {
      const logger = createLogger(
        actionLogging === true ? {collapsed: true} : actionLogging,
      ) as Middleware;
      middlewares.push(logger);
    }

    const storeDispatch: Dispatch<KeplerAction> = (action) => {
      set((state: KeplerSliceState) => ({
        ...state,
        kepler: {
          ...state.kepler,
          map: keplerReducer(state.kepler.map, action),
        },
      }));

      // Call onAction if it's defined
      const mapId = hasMapId(action) ? action.payload.meta._id_ : undefined;
      if (!mapId) throw new Error('Map ID not found in action payload');
      onAction?.(mapId, action);
      return action;
    };
    // const forwardDispatch: {[id: string]: Dispatch} = {};
    return {
      kepler: {
        config: initialConfig,
        basicKeplerProps,
        map: {},
        dispatchAction: () => {},
        __reduxProviderStore: undefined,
        forwardDispatch: {},

        setConfig: (config: KeplerSliceConfig) => {
          set((state) =>
            produce(state, (draft) => {
              draft.kepler.config = config;
            }),
          );
          updateForwardDispatch();
          updateMapConfigs();
        },

        async initialize() {
          const config = get().kepler.config;
          const currentMapId = config.currentMapId;
          const keplerInitialState: KeplerGlReduxState = keplerReducer(
            undefined,
            registerEntry({id: currentMapId}),
          );
          set({
            kepler: {
              ...get().kepler,
              map: keplerInitialState,              
              dispatchAction: (mid, action) => {
                // wrapDispatch(wrapTo(mapId)(action));
                const dispatchToMap = get().kepler.forwardDispatch[mid];
                if (dispatchToMap) {
                  dispatchToMap(wrapTo(mid, action));
                } else {
                  console.error('dispatchAction: mapId not found', mid);
                }
              },
              __reduxProviderStore: {
                dispatch: storeDispatch,
                getState: () => get().kepler.map || {},
                subscribe: () => () => {},
                replaceReducer: () => {},
                // @ts-ignore
                [Symbol.observable]: () => {},
              },
            },
          });
          updateForwardDispatch();
          updateMapConfigs();
          await get().kepler.syncKeplerDatasets();
          requestMapStyle(config.currentMapId);
        },

        addTableToMap: async (mapId, tableName, options = {}) => {
          const connector = await get().db.getConnector();
          const duckDbColumns = await getDuckDBColumnTypes(
            {
              query: (query: string) => connector.query(query).result,
            } as DatabaseConnection,
            tableName,
          );
          const tableDuckDBTypes = getDuckDBColumnTypesMap(duckDbColumns);
          const adjustedQuery = castDuckDBTypesForKepler(
            tableName,
            duckDbColumns,
          );
          const arrowResult = await connector.query(adjustedQuery).result;
          setGeoArrowWKBExtension(arrowResult, duckDbColumns);
          // TODO remove once DuckDB doesn't drop geoarrow metadata
          restoreGeoarrowMetadata(arrowResult, {});
          const fields = arrowSchemaToFields(arrowResult, tableDuckDBTypes);
          const cols = Array.from({length: arrowResult.numCols}, (_, i) =>
            arrowResult.getChildAt(i),
          ).filter((col) => col) as arrow.Vector[];

          if (fields && cols) {
            const datasets: AddDataToMapPayload['datasets'] = {
              data: {fields, cols, rows: []},
              info: {label: tableName, id: tableName},
              metadata: {tableName},
            };
            get().kepler.dispatchAction(
              mapId,
              addDataToMap({datasets, options}),
            );
          }
        },

        getCurrentMap: () => {
          return get().kepler.config.maps.find(
            (map) => map.id === get().kepler.config.currentMapId,
          );
        },

        setCurrentMapId: (mapId) => {
          return set((state) =>
            produce(state, (draft) => {
              draft.kepler.config.currentMapId = mapId;
            }),
          );
        },

        createMap: async (name) => {
          const mapId = createId();
          set((state) =>
            produce(state, (draft) => {
              draft.kepler.config.maps.push({
                id: mapId,
                name: name ?? 'Untitled Map',
              });
              draft.kepler.map = keplerReducer(
                draft.kepler.map,
                registerEntry({id: mapId}),
              );
              draft.kepler.forwardDispatch[mapId] = getForwardDispatch(mapId);
            }),
          );
          requestMapStyle(mapId);
          await get().kepler.syncKeplerDatasets();
        },

        async syncKeplerDatasets() {
          for (const mapId of Object.keys(get().kepler.map)) {
            const keplerDatasets = get().kepler.map[mapId]?.visState.datasets;
            for (const {table} of get().db.tables) {
              // TODO: remove this once getDuckDBColumnTypesMap can handle qualified table names
              // const qualifiedTable = table.toString();
              if (
                // !table.schema?.startsWith('__') && // skip internal schemas
                // !keplerDatasets?.[qualifiedTable]
                table.schema === 'main' &&
                !keplerDatasets?.[table.table]
              ) {
                await get().kepler.addTableToMap(mapId, table.table, {
                  autoCreateLayers: false,
                  centerMap: false,
                });
              }
            }
          }
        },

        deleteMap: (mapId) => {
          set((state) =>
            produce(state, (draft) => {
              draft.kepler.config.maps = draft.kepler.config.maps.filter(
                (map) => map.id !== mapId,
              );
              draft.kepler.map = keplerReducer(
                draft.kepler.map,
                deleteEntry(mapId),
              );

              delete draft.kepler.forwardDispatch[mapId];
            }),
          );
        },

        renameMap: (mapId, name) => {
          set((state) =>
            produce(state, (draft) => {
              const map = draft.kepler.config.maps.find(
                (map) => map.id === mapId,
              );
              if (map) {
                map.name = name;
              }
            }),
          );
        },

        addDataToMap: (mapId: string, data: any) => {
          get().kepler.registerKeplerMapIfNotExists(mapId);
          get().kepler.dispatchAction(mapId, addDataToMap(data));
        },

        addTileSetToMap: (mapId, tableName, tileset, tileMetadata) => {
          get().kepler.registerKeplerMapIfNotExists(mapId);
          const dataset = {
            info: {
              label: tileset.name,
              type: tileset.type,
              format: 'rows',
              // important for kepler to reload this tileset
              id: tableName,
            },
            data: {
              fields: tileMetadata?.fields || [],
              rows: [],
            },
            metadata: {
              // duckdb table name
              tableName,
              ...tileMetadata,
              ...tileset.metadata,
            },
            // vector tile layer only supports gpu filtering for now
            supportedFilterTypes: [
              ALL_FIELD_TYPES.real,
              ALL_FIELD_TYPES.integer,
            ],
            disableDataOperation: true,
          };
          get().kepler.dispatchAction(
            mapId,
            addDataToMap({
              datasets: dataset,
              options: {
                autoCreateLayers: true,
                centerMap: true,
              },
            }),
          );
        },

        addConfigToMap: (mapId: string, config: any) => {
          // if map not registered, register it
          get().kepler.registerKeplerMapIfNotExists(mapId);
          const parsedConfig = KeplerGLSchemaManager.parseSavedConfig(config);
          if (!parsedConfig) {
            throw new Error('Failed to parse config');
          }
          get().kepler.dispatchAction(
            mapId,
            addDataToMap({config: parsedConfig, datasets: []}),
          );
        },

        registerKeplerMapIfNotExists(mapId: string) {
          if (!get().kepler.map[mapId]) {
            set({
              kepler: {
                ...get().kepler,
                map: keplerReducer(
                  get().kepler.map,
                  registerEntry({id: mapId}),
                ),
                forwardDispatch: {
                  ...get().kepler.forwardDispatch,
                  [mapId]: getForwardDispatch(mapId),
                },
              },
            });
            requestMapStyle(mapId);
          }
        },

        removeDatasetFromMaps: (datasetId: string) => {
          for (const mapId of Object.keys(get().kepler.map)) {
            const map = get().kepler.map[mapId];
            if (map) {
              get().kepler.dispatchAction(mapId, removeDataset(datasetId));
            }
          }
        },
      },
    };

    function requestMapStyle(mapId: string) {
      const {mapStyle} = get().kepler.map[mapId] || {};
      const style = mapStyle?.mapStyles[mapStyle.styleType];
      if (style) {
        get().kepler.dispatchAction(
          mapId,
          requestMapStyles({[style.id]: style}),
        );
      }
    }

    function saveKeplerConfigMiddleware() {
      return (next: (action: KeplerAction) => void) =>
        (action: KeplerAction) => {
          // get id from kepler action payload meta
          const mapId = hasMapId(action) ? action.payload.meta._id_ : undefined;
          if (!mapId) throw new Error('Map ID not found in action payload');
          const result = next(action);
          if (!SKIP_AUTO_SAVE_ACTIONS.includes(action.type) && mapId) {
            // save kepler config to store
            set((state) =>
              produce(state, (draft) => {
                const mapToSave = draft.kepler.config.maps.find(
                  (map) => map.id === mapId,
                );
                if (mapToSave && state.kepler.map?.[mapId]) {
                  mapToSave.config = KeplerGLSchemaManager.getConfigToSave(
                    state.kepler.map[mapId],
                  ) as any;
                }
              }),
            );
          }
          // save kepler config to local storage
          return result;
        };
    }

    function updateMapConfigs() {
      const config = get().kepler.config;
      const keplerMaps = config.maps;
      for (const {id, config} of keplerMaps) {
        if (config) {
          get().kepler.addConfigToMap(
            id,
            config as unknown as KeplerMapSchema,
          );
        }
      }
    }

    function updateForwardDispatch() {
      const config = get().kepler.config;
      const currentMapId = config.currentMapId;
      const forwardDispatch = {
        [currentMapId]: getForwardDispatch(currentMapId),
      };
      if (config) {
        for (const {id} of config.maps) {
          forwardDispatch[id] = getForwardDispatch(id);
        }
      }
      set((state) =>
        produce(state, (draft) => {
          draft.kepler.forwardDispatch = forwardDispatch;
        }),
      );
    }


    function getForwardDispatch(mapId: string): Dispatch<KeplerAction> {
      /** Adapted from  applyMiddleware in redux */
      let wrapDispatch: (
        action: KeplerAction,
        ...args: any
      ) => KeplerAction = () => {
        throw new Error(
          'Dispatching while constructing your middleware is not allowed. ' +
            'Other middleware would not be applied to this dispatch.',
        );
      };
      const wrapToMap = wrapTo(mapId);
      const middlewareAPI: MiddlewareAPI<any, any> = {
        getState: get,
        dispatch: (action: Action, ...args: any) => {
          // need to forward here as well
          return wrapDispatch(wrapToMap(action), ...args);
        },
      };

      const chain = middlewares.map((middleware) => middleware(middlewareAPI));
      wrapDispatch = compose<Dispatch>(...chain)(storeDispatch);
      return wrapDispatch as Dispatch<KeplerAction>;
    }
  });
}

type RoomStateWithDiscuss = RoomShellSliceState & KeplerSliceState;

export function useStoreWithKepler<T>(
  selector: (state: RoomStateWithDiscuss) => T,
): T {
  return useBaseRoomShellStore<RoomStateWithDiscuss, T>((state) =>
    selector(state as RoomStateWithDiscuss),
  );
}
