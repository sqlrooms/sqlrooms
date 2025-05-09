import {
  deleteEntry,
  registerEntry,
  requestMapStyles,
  wrapTo,
  ActionTypes as KeplerActionTypes,
  addDataToMap,
} from '@kepler.gl/actions';
import {
  DEFAULT_MAP_STYLES,
  ALL_FIELD_TYPES,
  VectorTileDatasetMetadata,
} from '@kepler.gl/constants';
import {MiddlewareAPI, Middleware, Dispatch, AnyAction, compose} from 'redux';

import {
  keplerGlReducer,
  KeplerGlState,
  INITIAL_UI_STATE,
} from '@kepler.gl/reducers';
import {createId} from '@paralleldrive/cuid2';
import {
  createSlice,
  ProjectBuilderState,
  useBaseProjectBuilderStore,
  type StateCreator,
} from '@sqlrooms/project-builder';
import {BaseProjectConfig} from '@sqlrooms/project-config';
import {castDraft, produce} from 'immer';
import {taskMiddleware} from 'react-palm/tasks';
import {z} from 'zod';
import {createLogger, ReduxLoggerOptions} from 'redux-logger';
import type {Action, Store as ReduxStore} from 'redux';
import KeplerGLSchemaManager from '@kepler.gl/schemas';
import {Datasets, KeplerTable} from '@kepler.gl/table';
import {initApplicationConfig} from '@kepler.gl/utils';
import { ParsedConfig } from '@kepler.gl/types';

class DesktopKeplerTable extends KeplerTable {
  static getInputDataValidator = function () {
    // Default validator accepts only string timestamps
    return (d: any) => d;
  };
}

// TODO: initApplicationConfig should be called from createKeplerSlice
// configure Kepler Desktop application
initApplicationConfig({
  table: DesktopKeplerTable,

  // Raster Tile layer config
  enableRasterTileLayer: true,
  rasterServerUseLatestTitiler: false,
  // TODO: provide a default free server or leave blank
  rasterServerUrls: [
    'https://d1q7gb82o5qayp.cloudfront.net',
    'https://d34k46lorssas.cloudfront.net',
    'https://d2k92ng3gmu32o.cloudfront.net',
  ],
  rasterServerSupportsElevation: true,
});

export const KeplerMapSchema = z.object({
  id: z.string(),
  name: z.string(),
  datasets: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      type: z.string().optional(),
      metadata: z.object({
        tableName: z.string().optional(),
      }),
    }),
  ),
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

export type CreateKeplerSliceOptions = {
  actionLogging?: boolean | ReduxLoggerOptions;
};

export const KeplerSliceConfig = z.object({
  kepler: z.object({
    currentMapId: z.string(),
    maps: z.array(KeplerMapSchema),
  }),
});
export type KeplerSliceConfig = z.infer<typeof KeplerSliceConfig>;

const defaultMapId = 'untitled_map';

export function createDefaultKeplerConfig(
  props?: Partial<KeplerSliceConfig['kepler']>,
): KeplerSliceConfig {
  return {
    kepler: {
      maps: [
        {
          id: defaultMapId,
          name: 'Untitled Map',
          config: undefined,
          datasets: [],
        },
      ],
      currentMapId: defaultMapId,
      ...props,
    },
  };
}

/** Adapted from  applyMiddleware in redux */
function applyMiddleware(
  store: MiddlewareAPI,
  middlewares: Middleware[],
): Dispatch {
  let dispatch: Dispatch = () => {
    throw new Error(
      'Dispatching while constructing your middleware is not allowed. ' +
        'Other middleware would not be applied to this dispatch.',
    );
  };

  const chain = middlewares.map((middleware) => middleware(store));
  dispatch = compose<typeof dispatch>(...chain)(store.dispatch);

  return dispatch;
}
export type KeplerAction = {
  type: string;
  payload: unknown;
};
// support multiple kepler maps
export type KeplerGlReduxState = {[id: string]: KeplerGlState};
export type KeplerSliceState = {
  kepler: {
    map: KeplerGlReduxState;
    initialize: () => Promise<void>;
    addDataToMap: (mapId: string, data: any) => void;
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
    __reduxProviderStore: ReduxStore<KeplerGlReduxState, KeplerAction>;
  };
};

// Auto save will be triggered in middleware on every kepler action
// skip these actions to avoid unnecessary save
const SKIP_AUTO_SAVE_ACTIONS: string[] = [
  KeplerActionTypes.LAYER_HOVER,
  KeplerActionTypes.UPDATE_MAP,
];

const MAPBOX_TOKEN = process.env.MapboxAccessToken;
const DEFAULT_MAP_STYLE = 'positron';

export function createKeplerSlice<
  PC extends BaseProjectConfig & KeplerSliceConfig,
>(options: CreateKeplerSliceOptions = {}): StateCreator<KeplerSliceState> {
  const {actionLogging = false} = options;
  return createSlice<PC, KeplerSliceState>((set, get) => {
    const keplerReducer = keplerGlReducer.initialState({
      mapStyle: {
        styleType: DEFAULT_MAP_STYLE,
        mapboxApiAccessToken: MAPBOX_TOKEN,
        mapStyles: DEFAULT_MAP_STYLES.reduce(
          (accu, curr) => ({
            ...accu,
            // TODO: Note: this has to be done only for Kepler Desktop
            [curr.id]: {
              ...curr,
              icon: `http://localhost:3001/static/basemap/${curr.icon.split('/').pop()}`,
            },
          }),
          {},
        ),
      },
      uiState: {
        // side panel is closed by default
        activeSidePanel: false,
        currentModal: null,
        // hide split map and locale controls by default
        mapControls: {
          ...INITIAL_UI_STATE.mapControls,
          splitMap: {
            ...INITIAL_UI_STATE.mapControls.splitMap,
            show: false,
          },
          mapLocale: {
            ...INITIAL_UI_STATE.mapControls.mapLocale,
            show: false,
          },
        },
      },
    });

    const keplerInitialState: KeplerGlReduxState = keplerReducer(
      undefined,
      registerEntry({id: defaultMapId}),
    );

    const dispatch = (mapId: string, action: Action) => {
      set((state: KeplerSliceState) => ({
        ...state,
        kepler: {
          ...state.kepler,
          map: keplerReducer(state.kepler.map, wrapTo(mapId, action)),
        },
      }));
      return action;
    };

    function saveKeplerConfigMiddleware(
      store: MiddlewareAPI<
        Dispatch<AnyAction> & {mapId: string},
        KeplerSliceState
      >,
    ) {
      return (next: (action: KeplerAction) => void) =>
        (action: KeplerAction) => {
          const dispatch = store.dispatch;
          const mapId = dispatch.mapId;

          const result = next(action);
          if (!SKIP_AUTO_SAVE_ACTIONS.includes(action.type)) {
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
                  // map tables to the datasets in the kepler state
                  const datasetsToSave = Object.entries(
                    state.kepler.map[mapId].visState.datasets as Datasets,
                  ).map(([_key, value]: [string, any]) => ({
                    id: value.id,
                    label: value.label,
                    metadata: {
                      // table name is undefined for tile datasets
                      tableName: value.metadata.tableName,
                    },
                    type: value.type,
                  }));

                  mapToSave.datasets = datasetsToSave;
                }
              }),
            );
          }
          // save kepler config to local storage
          return result;
        };
    }

    function requestInitialMapStyle(mapId: string) {
      const {mapStyle} = get().kepler.map[mapId] || {};
      const style = mapStyle?.mapStyles[mapStyle.styleType];

      if (style) {
        get().kepler.dispatchAction(
          mapId,
          requestMapStyles({[style.id]: style}),
        );
      }
    }
    // forward kepler action to default map
    const middlewares = [taskMiddleware, saveKeplerConfigMiddleware];
    if (actionLogging) {
      const logger = createLogger(
        actionLogging === true ? {collapsed: true} : actionLogging,
      );
      middlewares.push(logger);
    }
    const dispatchWithMiddleware = (mapId: string, action: Action) => {
      const wrapDispatch = (a: Action) => dispatch(mapId, a);
      wrapDispatch.mapId = mapId;

      const middlewareAPI = {
        getState: get,
        dispatch: wrapDispatch,
      };

      // @ts-ignore
      applyMiddleware(middlewareAPI, middlewares)(action);
    };

    const __reduxProviderStore: ReduxStore<KeplerGlReduxState, KeplerAction> = {
      dispatch: ((action: KeplerAction) =>
        dispatchWithMiddleware(defaultMapId, action)) as Dispatch<KeplerAction>,
      getState: () => get().kepler.map,
      subscribe: () => () => {},
      replaceReducer: () => {},
      // @ts-ignore
      [Symbol.observable]: () => {},
    };

    return {
      kepler: {
        map: keplerInitialState,
        dispatchAction: dispatchWithMiddleware,
        __reduxProviderStore,

        async initialize() {
          requestInitialMapStyle(defaultMapId);
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
        createMap: (name) => {
          const mapId = createId();
          set((state) => {
            return produce(state, (draft) => {
              draft.config.kepler.maps.push({
                id: mapId,
                name: name ?? 'Untitled Map',
                datasets: [],
              });
              draft.kepler.map = keplerReducer(
                draft.kepler.map,
                registerEntry({id: mapId}),
              );
            });
          });
          requestInitialMapStyle(mapId);
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
        addDataToMap: (mapId, data) => {
          get().kepler.dispatchAction(mapId, addDataToMap(data));
        },
        addTileSetToMap: (
          mapId,
          tableName,
          tileset,
          tileMetadata,
        ) => {
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
        addConfigToMap: (mapId, config) => {
          const parsedConfig = KeplerGLSchemaManager.parseSavedConfig(config as any);
          if (!parsedConfig) {
            throw new Error('Failed to parse config');
          }
          get().kepler.dispatchAction(
            mapId,
            addDataToMap({config: parsedConfig, datasets: []}),
          );
        },
      },
    };
  });
}

type ProjectConfigWithKepler = BaseProjectConfig & KeplerSliceConfig;
type ProjectStateWithKepler = ProjectBuilderState<ProjectConfigWithKepler> &
  KeplerSliceState;

export function useStoreWithKepler<T>(
  selector: (state: ProjectStateWithKepler) => T,
): T {
  return useBaseProjectBuilderStore<
    BaseProjectConfig & KeplerSliceConfig,
    ProjectBuilderState<ProjectConfigWithKepler>,
    T
  >((state) => selector(state as unknown as ProjectStateWithKepler));
}
