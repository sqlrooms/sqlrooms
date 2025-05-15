import {
  addDataToMap,
  deleteEntry,
  isForwardAction,
  ActionTypes as KeplerActionTypes,
  registerEntry,
  requestMapStyles,
  wrapTo,
} from '@kepler.gl/actions';
import {ALL_FIELD_TYPES, VectorTileDatasetMetadata} from '@kepler.gl/constants';
import {
  constructST_asWKBQuery,
  getDuckDBColumnTypes,
  getDuckDBColumnTypesMap,
  getGeometryColumns,
  restoreGeoarrowMetadata,
  setGeoArrowWKBExtension,
} from '@kepler.gl/duckdb';
import {arrowSchemaToFields} from '@kepler.gl/processors';
import {keplerGlReducer, KeplerGlState, MapStyle} from '@kepler.gl/reducers';
import KeplerGLSchemaManager from '@kepler.gl/schemas';
import {AddDataToMapPayload} from '@kepler.gl/types';
import {createId} from '@paralleldrive/cuid2';
import {
  createSlice,
  ProjectBuilderState,
  useBaseProjectBuilderStore,
  type StateCreator,
} from '@sqlrooms/project-builder';
import {BaseProjectConfig} from '@sqlrooms/project-config';
import {produce} from 'immer';
import {taskMiddleware} from 'react-palm/tasks';
import type {Action, MiddlewareAPI, Store as ReduxStore} from 'redux';
import {compose, Dispatch, Middleware} from 'redux';
import {createLogger, ReduxLoggerOptions} from 'redux-logger';
import {z} from 'zod';
// @ts-ignore
import {KeplerTable} from '@kepler.gl/table';
import {
  DatabaseConnection,
  initApplicationConfig,
  KeplerApplicationConfig,
} from '@kepler.gl/utils';
import * as arrow from 'apache-arrow';

class DesktopKeplerTable extends KeplerTable {
  static getInputDataValidator = function () {
    // Default validator accepts only string timestamps
    return (d: any) => d;
  };
}

export const KeplerMapSchema = z.object({
  id: z.string(),
  name: z.string(),
  config: z
    .object({
      version: z.literal('v1'),
      config: z.object({
        visState: z.object({}).passthrough(),
        mapState: z.object({}).passthrough(),
        mapStyle: z.object({}).passthrough(),
        uiState: z.object({}).passthrough(),
      }),
    })
    .optional(),
});

export type KeplerMapSchema = z.infer<typeof KeplerMapSchema>;
export type KeplerGLBasicProps = {
  mapboxApiAccessToken?: string;
}

export type CreateKeplerSliceOptions = {
  initialKeplerState?: Partial<KeplerGlState>;
  basicKeplerProps?: Partial<KeplerGLBasicProps>;
  actionLogging?: boolean | ReduxLoggerOptions;
  middlewares?: Middleware[];
  applicationConfig?: KeplerApplicationConfig;
};

export const KeplerSliceConfig = z.object({
  kepler: z.object({
    currentMapId: z.string(),
    maps: z.array(KeplerMapSchema),
  }),
});
export type KeplerSliceConfig = z.infer<typeof KeplerSliceConfig>;

export function createDefaultKeplerConfig(
  props?: Partial<KeplerSliceConfig['kepler']>,
): KeplerSliceConfig {
  const mapId = createId();
  return {
    kepler: {
      maps: [
        {
          id: mapId,
          name: 'Untitled Map',
          config: undefined,
        },
      ],
      currentMapId: mapId,
      ...props,
    },
  };
}

export type KeplerAction = {
  type: string;
  payload: unknown;
};
// support multiple kepler maps
export type KeplerGlReduxState = {[id: string]: KeplerGlState};
export type KeplerSliceState<PC extends ProjectConfigWithKepler> = {
  kepler: {
    map: KeplerGlReduxState;
    basicKeplerProps?: Partial<KeplerGLBasicProps>;
    initialize: (config?: PC) => Promise<void>;
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
    dispatchAction: (mapId: string, action: KeplerAction) => void;
    setCurrentMapId: (mapId: string) => void;
    createMap: (name?: string) => void;
    deleteMap: (mapId: string) => void;
    renameMap: (mapId: string, name: string) => void;
    getCurrentMap: () => KeplerMapSchema | undefined;
    /**
     * Override the function to be called when a kepler action is dispatched
     * @param mapId - The map id
     * @param action - The action
     */
    onAction?: (mapId: string, action: Action) => void;
    registerKeplerMapIfNotExists: (mapId: string) => void;
    __reduxProviderStore:
      | ReduxStore<KeplerGlReduxState, KeplerAction>
      | undefined;
  };
};

// Auto save will be triggered in middleware on every kepler action
// skip these actions to avoid unnecessary save
const SKIP_AUTO_SAVE_ACTIONS: string[] = [
  KeplerActionTypes.LAYER_HOVER,
  KeplerActionTypes.UPDATE_MAP,
];

export function createKeplerSlice<
  PC extends BaseProjectConfig & KeplerSliceConfig,
>({
  basicKeplerProps = {},
  initialKeplerState = {
    mapStyle: {styleType: 'positron'} as MapStyle,
  },
  actionLogging = false,
  middlewares: additionalMiddlewares = [],
  applicationConfig,
}: CreateKeplerSliceOptions = {}): StateCreator<KeplerSliceState<PC>> {
  initApplicationConfig({
    table: DesktopKeplerTable,
    ...applicationConfig,
  });
  return createSlice<PC, KeplerSliceState<PC>>((set, get) => {
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

    const storeDispatch = (action: Action) => {
      console.log('store dispatch action', action);
      set((state: KeplerSliceState<PC>) => ({
        ...state,
        kepler: {
          ...state.kepler,
          map: keplerReducer(state.kepler.map, action),
        },
      }));

      // Call onAction if it's defined
      get().kepler.onAction?.(mapId, action);

      return action;
    };
    const forwardDispatch = {
      // [currentMapId]: getForwardDispatch(
      //   currentMapId,
      //   storeDispatch,
      //   middlewares,
      // ),
    };
    return {
      kepler: {
        basicKeplerProps,
        map: {},
        dispatchAction: () => {},
        __reduxProviderStore: undefined,
        forwardDispatch,

        async initialize(config?: PC) {
          const currentMapId =
            config?.kepler.currentMapId || get().config.kepler.currentMapId;
          const keplerInitialState: KeplerGlReduxState = keplerReducer(
            undefined,
            registerEntry({id: currentMapId}),
          );
          forwardDispatch[currentMapId] = getForwardDispatch(
            currentMapId,
            storeDispatch,
            middlewares,
          );
          if (config) {
            for (const {id} of config.kepler.maps) {
              forwardDispatch[id] = getForwardDispatch(
                id,
                storeDispatch,
                middlewares,
              );
            }
          }
          set({
            kepler: {
              ...get().kepler,
              map: keplerInitialState,
              forwardDispatch,
              dispatchAction: (mid, action) => {
                console.log('dispatchAction', mid, action);
                // wrapDispatch(wrapTo(mapId)(action));
                const dispatch = get().kepler.forwardDispatch[mid];
                if (dispatch) {
                  dispatch(action);
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
          if (config) {
            get().project.setProjectConfig(config);
            const keplerMaps = config.kepler.maps;
            for (const {id, config} of keplerMaps) {
              if (config) {
                get().kepler.addConfigToMap(
                  id,
                  config as unknown as KeplerMapSchema,
                );
              }
            }
          }
          await get().kepler.syncKeplerDatasets();
          requestMapStyle(get().config.kepler.currentMapId);
        },

        addTableToMap: async (mapId, tableName, options = {}) => {
          const connector = await get().db.getConnector();
          const duckDbColumns = await getDuckDBColumnTypes(
            connector as unknown as DatabaseConnection,
            tableName,
          );
          const tableDuckDBTypes = getDuckDBColumnTypesMap(duckDbColumns);
          const columnsToConvertToWKB = getGeometryColumns(duckDbColumns);
          const adjustedQuery = constructST_asWKBQuery(
            tableName,
            columnsToConvertToWKB,
          );
          const arrowResult = await connector.query(adjustedQuery);
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
            console.log('Adding table to map', {mapId});
            get().kepler.dispatchAction(
              mapId,
              addDataToMap({datasets, options}),
            );
          }
        },

        getCurrentMap: () => {
          return get().config.kepler.maps.find(
            (map) => map.id === get().config.kepler.currentMapId,
          );
        },

        setCurrentMapId: (mapId) => {
          return set((state) =>
            produce(state, (draft) => {
              draft.config.kepler.currentMapId = mapId;
            }),
          );
        },

        createMap: async (name) => {
          const mapId = createId();
          set((state) =>
            produce(state, (draft) => {
              draft.config.kepler.maps.push({
                id: mapId,
                name: name ?? 'Untitled Map',
              });
              draft.kepler.map = keplerReducer(
                draft.kepler.map,
                registerEntry({id: mapId}),
              );
              draft.kepler.forwardDispatch[mapId] = getForwardDispatch(
                mapId,
                storeDispatch,
                middlewares,
              );
            }),
          );
          requestMapStyle(mapId);
          await get().kepler.syncKeplerDatasets();
        },

        async syncKeplerDatasets() {
          const {currentMapId} = get().config.kepler;
          for (const mapId of Object.keys(get().kepler.map)) {
            const keplerDatasets = get().kepler.map[mapId]?.visState.datasets;
            for (const {
              // @ts-ignore Added in next published version of @sqlrooms/duckdb
              schema,
              tableName,
            } of get().db.tables) {
              if (schema === 'main' && !keplerDatasets[tableName]) {
                await get().kepler.addTableToMap(
                  mapId,
                  tableName,
                  {
                    autoCreateLayers: false,
                    centerMap: false,
                  },
                  // mapId === currentMapId
                  //   ? {
                  //       autoCreateLayers: mapId === currentMapId,
                  //       centerMap: true,
                  //     }
                  //   : {},
                );
              }
            }
          }
        },

        deleteMap: (mapId) => {
          set((state) =>
            produce(state, (draft) => {
              draft.config.kepler.maps = draft.config.kepler.maps.filter(
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
              const map = draft.config.kepler.maps.find(
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
          console.log('addConfigToMap', mapId, config);
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
              },
            });
            requestMapStyle(mapId);
          }
        },
      },
    };

    function requestMapStyle(mapId: string) {
      const {mapStyle} = get().kepler.map[mapId] || {};
      const style = mapStyle?.mapStyles[mapStyle.styleType];
      console.log('requestMapStyle', mapId);
      if (style) {
        get().kepler.dispatchAction(
          mapId,
          requestMapStyles({[style.id]: style}),
        );
      }
    }

    function saveKeplerConfigMiddleware(store) {
      return (next: (action: KeplerAction) => void) =>
        (action: KeplerAction) => {
          console.log('saveKeplerConfigMiddleware', action);
          // get id from kepler action payload meta
          const mapId = action.payload?.meta?._id_;
          const result = next(action);
          if (!SKIP_AUTO_SAVE_ACTIONS.includes(action.type) && mapId) {
            // save kepler config to store
            set((state) =>
              produce(state, (draft) => {
                const mapToSave = draft.config.kepler.maps.find(
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

    function getForwardDispatch(mapId, storeDispatch, middlewares) {
      /** Adapted from  applyMiddleware in redux */
      let wrapDispatch: Dispatch = () => {
        throw new Error(
          'Dispatching while constructing your middleware is not allowed. ' +
            'Other middleware would not be applied to this dispatch.',
        );
      };
      const wrapToMap = wrapTo(mapId);
      const middlewareAPI: MiddlewareAPI = {
        getState: get,
        dispatch: (action, ...args): Action => {
          console.log('middleware dispatch action', wrapToMap(action), args);
          // need to forward here as well

          return wrapDispatch(wrapToMap(action), ...args);
        },
      };

      const chain = middlewares.map((middleware) => middleware(middlewareAPI));
      wrapDispatch = compose<Dispatch>(...chain)(storeDispatch);
      return wrapDispatch;
    }
  });
}

type ProjectConfigWithKepler = BaseProjectConfig & KeplerSliceConfig;
type ProjectStateWithKepler = ProjectBuilderState<ProjectConfigWithKepler> &
  KeplerSliceState<ProjectConfigWithKepler>;

export function useStoreWithKepler<T>(
  selector: (state: ProjectStateWithKepler) => T,
): T {
  return useBaseProjectBuilderStore<
    BaseProjectConfig & KeplerSliceConfig,
    ProjectBuilderState<ProjectConfigWithKepler>,
    T
  >((state) => selector(state as unknown as ProjectStateWithKepler));
}
