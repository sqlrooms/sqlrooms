import {
  AiSettingsSliceConfig,
  AiSettingsSliceState,
  AiSliceState,
  createAiSettingsSlice,
  createAiSlice,
  formatTablesForLLM,
} from '@sqlrooms/ai';
import {escapeVal, makeQualifiedTableName} from '@sqlrooms/duckdb';
import {
  createDefaultKeplerConfig,
  createKeplerSlice,
  KeplerSliceState,
} from '@sqlrooms/kepler';
import {
  BaseRoomConfig,
  LayoutTypes,
  LoadFileOptions,
  MAIN_VIEW,
  MosaicLayoutConfig,
} from '@sqlrooms/room-config';
import {
  createRoomShellSlice,
  createRoomStoreCreator,
  RoomShellSliceState,
  StoreApi,
} from '@sqlrooms/room-shell';
import {createS3BrowserSlice, S3BrowserState} from '@sqlrooms/s3-browser';
import {
  createDefaultSqlEditorConfig,
  SqlEditorSliceState,
} from '@sqlrooms/sql-editor';
import {convertToValidColumnOrTableName, splitFilePath} from '@sqlrooms/utils';
import {createVegaChartTool} from '@sqlrooms/vega';
import log from 'electron-log/renderer';

import {
  getDefaultMapStyles,
  INITIAL_UI_STATE,
  KeplerGlState,
} from '@kepler.gl/reducers';
import {produce} from 'immer';
import throttle from 'lodash.throttle';
import {PANELS} from './panels';
import {createPythonDuckDbConnector} from './PythonDuckDbConnector';
import {RoomPanelTypes} from './RoomPanelTypes';

import {AppState, useAppStore} from './appStore';
import {
  createCustomLayoutSlice,
  CustomLayoutSliceState,
} from './room-slices/layoutSlice';
import {
  createRunningQueriesSlice,
  RunningQueriesSliceState,
} from './room-slices/runningQueriesSlice';
import {
  createSubscriptionSlice,
  SubscriptionSliceState,
} from './room-slices/subscriptionSlice';
import {
  createTilesetsSlice,
  TilesetsSliceState,
} from './room-slices/tilesetsSlice';
import {RoomConfig} from './RoomConfig';
import {checkIfDatasetIsLarge} from './utils/checkIfDatasetIsLarge';
import {cleanupConfigRetention} from './utils/configRetention';

import {
  MIXPANEL_AI_EVENTS,
  MIXPANEL_QUERY_EVENTS,
} from '../../../common/constants';
import {getAdministrativeBoundariesAgentTool} from '../components/agents/adminBoundariesAgent';
import {getDynamicTilingAgentTool} from '../components/agents/dynamicTilingAgent';
import {getFsqPlacesAgentTool} from '../components/agents/fsqPlacesAgent';
import {getH3AgentTool} from '../components/agents/h3Agent';
import {getH3HubAgentTool} from '../components/agents/H3HubAgent';
import {getMapAgentTool} from '../components/agents/mapAgent';
import {getSpatialUtilitiesAgentTool} from '../components/agents/spatialUtilitiesAgent';
import {CustomErrorBoundary} from '../components/error/CustomErrorBoundary';
import {confirmDynamicTilingTool} from '../components/tools/DynamicTilingTool';
import {
  confirmH3HubQuery,
  listH3HubDatasets,
  queryH3Hub,
} from '../components/tools/H3HubTool';
import {getQueryTool, getSaveQueryTool} from '../components/tools/QueryTool';
import {
  AI_INSTRUCTIONS,
  CDN_URL,
  LITELLM_BASE_URL,
  LLM_MODEL_TIER_FREE,
  LLM_PROVIDER_TIER_FREE,
} from '../constants';
import {createSqlEditorSlice} from './room-slices/sqlEditorSlice';
import {getCurrentActor, withAgentActor} from '@renderer/utils/actorContext';
import {
  KEPLER_ACTIONS_TO_TRACK,
  KeplerDebounceState,
  trackKeplerAction,
} from './utils/keplerTracking';

const CONFIG_SLICES_TO_SAVE: Exclude<keyof RoomState, 'room'>[] = [
  'kepler',
  'layout',
  'sqlEditor',
  'aiSettings',
];

// Local server to fetch resources - works much faster than S3, especially for raster tile 100+ colormaps,
// but looks like it fails to start sometimes (?)
// const KEPLER_CDN_URL = 'http://localhost:3001/static/keplergl';
const KEPLER_CDN_URL = `${CDN_URL}/app-data/keplergl`;

export enum LoadingStage {
  DEFAULT, // ADD_FILE_TO_DB,
  ADD_TABLE_TO_KEPLER,
}

export type LoadingProgress = {
  isLoading: boolean;
  progress: number;
  stage: LoadingStage;
  title?: string | null;
};

export type ProjectSaveStatus = 'saved' | 'unsaved' | 'saving' | 'error';

/**
 * File loading errors structure.
 *
 * Outer key: filename (e.g., "myfile.geojson")
 * Inner key: processing method that failed (e.g., "read_json", "st_read", "auto", "general")
 * Inner value: error message from that processing method
 *
 * Example:
 * {
 *   "myfile.geojson": {
 *     "read_json": "Invalid JSON: unexpected character at line 5",
 *     "st_read": "GDAL Error: invalid geometry"
 *   },
 *   "data.csv": {
 *     "general": "File not found"
 *   }
 * }
 */
export type FileLoadErrors = Record<string, Record<string, string>>;

type CustomRoomState = {
  projectSaveStatus: ProjectSaveStatus;
  projectSaveError: string | null;
  appStore: StoreApi<AppState>;
  loadingProgress: LoadingProgress;
  saveConfig: () => Promise<void>;
  saveConversation: () => Promise<void>;
  setLoadingProgress: (arg: Partial<LoadingProgress>) => void;
  exportTable: (tableName: string) => Promise<unknown>;
  loadFiles: (filePaths: string[]) => Promise<{
    tables: {
      tableName: string;
      rowCount: number;
    }[];
    errors: FileLoadErrors;
  }>;
  /**
   * Load files and add them to the current map.
   * @param files - Files to load (FileList, File array, or string paths).
   * @returns Errors that occurred during loading or adding to map, and successfully loaded tables.
   */
  loadFilesAndAddToMap: (files: FileList | File[] | string[]) => Promise<{
    errors: FileLoadErrors;
    tables: {tableName: string; rowCount: number}[];
  }>;
  /**
   * Will trigger the large dataset prompt if the table is large and return the decision.
   * @param tableName - The name of the table to check.
   * @returns The decision: 'as-is' | 'dynamic-tileset' | 'cancel'.
   */
  _checkIsLargeDataset: (
    tableName: string,
  ) => Promise<'as-is' | 'dynamic-tileset' | 'cancel'>;
  largeDatasetDialog:
    | {
        tableName: string;
        rowCount: number;
        chooseAsIs: () => void;
        chooseAsTileset: () => void;
        cancelLargeDataset: () => void;
      }
    | undefined;
  updateLiteLLMModels: (
    models: Array<{name: string; models: string[]}>,
  ) => void;
};

/**
 * Room state
 */
export type RoomState = CustomRoomState &
  Omit<RoomShellSliceState, 'layout'> &
  CustomLayoutSliceState &
  KeplerSliceState &
  SqlEditorSliceState &
  S3BrowserState &
  TilesetsSliceState &
  RunningQueriesSliceState &
  SubscriptionSliceState &
  AiSettingsSliceState &
  AiSliceState;

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_API_ACCESS_TOKEN;
const DEFAULT_MAP_STYLE = 'positron';
const INITIAL_KEPLER_STATE = {
  mapStyle: {
    styleType: DEFAULT_MAP_STYLE,
    mapboxApiAccessToken: MAPBOX_TOKEN,
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
} as unknown as Partial<KeplerGlState>;

const DEFAULT_LAYOUT = {
  type: LayoutTypes.enum.mosaic,
  nodes: {
    direction: 'row',
    first: RoomPanelTypes.enum['data-sources'],
    second: {
      direction: 'row',
      first: MAIN_VIEW,
      second: RoomPanelTypes.enum['assistant'],
      splitPercentage: 60,
    },
    splitPercentage: 25,
  },
} as unknown as MosaicLayoutConfig;

/**
 * Create a customized project store
 */
export const {createRoomStore, useRoomStore} =
  createRoomStoreCreator<RoomState>()(
    ({
      appStore,
      captureException,
      trackEvent,
    }: {
      appStore: StoreApi<AppState>;
      captureException: RoomState['room']['captureException'];
      trackEvent: (name: string, payload?: Record<string, unknown>) => void;
    }) =>
      (set, get, store) => {
        // Track if initialization failed to prevent saving a broken config
        let initializationFailed = false;

        // Skip Mixpanel tracking of Kepler actions during initialization to avoid
        // spurious events (e.g. multiple ADD_DATA_TO_MAP when restoring saved state)
        let isInitializing = true;

        const connector = createPythonDuckDbConnector({
          initializationQuery: `
       -- Prevent DuckDB from throwing when parquet's metadata doesn't match specification
       SET enable_geoparquet_conversion = false;

       CREATE SCHEMA IF NOT EXISTS fsq_spatial;
       CREATE TABLE IF NOT EXISTS fsq_spatial.config (
         config JSON,
         timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
       );

       CREATE TABLE IF NOT EXISTS fsq_spatial.conversation (
         conversation JSON,
         timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
       );

       CREATE TABLE IF NOT EXISTS fsq_spatial.tilesets (
         id VARCHAR, name VARCHAR, type VARCHAR, tileset JSON, metadata JSON,
         dynamic_config JSON -- not null for dynamic tilesets
       );
       `,
        });

        // Base project slice
        const baseRoomSlice = createRoomShellSlice({
          connector,
          captureException,
          CustomErrorBoundary,
          config: {
            layout: DEFAULT_LAYOUT,
            ...createDefaultKeplerConfig(),
            ...createDefaultSqlEditorConfig(),
          },
          room: {},
        })(set, get, store);

        const {kepler: baseKeplerSlice} = createKeplerSlice({
          actionLogging: import.meta.env.DEV,
          onAction: (() => {
            // Per-room debounce state so timestamps don't leak across
            // project lifecycles within the same renderer process.
            const debounceState: KeplerDebounceState = {};
            return (_mapId: string, action: {type: string}) => {
              if (isInitializing) return;
              if (KEPLER_ACTIONS_TO_TRACK.has(action.type)) {
                trackKeplerAction(
                  action as {type: string} & Record<string, unknown>,
                  getCurrentActor(),
                  trackEvent,
                  debounceState,
                );
              }
            };
          })(),
          initialKeplerState: {
            ...INITIAL_KEPLER_STATE,
            basicKeplerProps: {
              mapboxApiAccessToken: MAPBOX_TOKEN,
            },
            // @ts-expect-error Type should be partial
            mapStyle: {
              ...INITIAL_KEPLER_STATE.mapStyle,
              // at this point application config isn't initialized (no valid getApplicationConfig)
              mapStyles: getDefaultMapStyles(KEPLER_CDN_URL),
            },
          },
          applicationConfig: {
            // Raster Tile layer config
            enableRasterTileLayer: true,
            rasterServerUseLatestTitiler: false,
            rasterServerShowServerInput: false,
            // TODO: provide a default free server or leave blank
            rasterServerUrls: [
              'https://d1q7gb82o5qayp.cloudfront.net',
              'https://d34k46lorssas.cloudfront.net',
              'https://d2k92ng3gmu32o.cloudfront.net',
            ],
            rasterServerSupportsElevation: true,
            cdnUrl: KEPLER_CDN_URL,

            enableWMSLayer: true,
          },
        })(set, get, store);

        const aiSlice = createAiSlice({
          defaultProvider: LLM_PROVIDER_TIER_FREE,
          defaultModel: LLM_MODEL_TIER_FREE,
          getApiKey: () => {
            const virtualKey = useAppStore.getState().liteLlm.getVirtualKey();
            return virtualKey || '';
          },
          getBaseUrl: () => {
            return LITELLM_BASE_URL;
          },
          tools: {
            query: getQueryTool(store),
            saveQuery: getSaveQueryTool(store),
            chart: createVegaChartTool(),
            confirmH3HubQuery: confirmH3HubQuery(),
            'agent-h3hub': getH3HubAgentTool(store),
            listH3HubDatasets: listH3HubDatasets(store),
            queryH3Hub: queryH3Hub(store),
            'agent-h3': getH3AgentTool(store),
            'agent-map': getMapAgentTool(store),
            'agent-spatial-utilities': getSpatialUtilitiesAgentTool(store),
            'agent-admin-boundaries':
              getAdministrativeBoundariesAgentTool(store),
            confirmDynamicTiling: confirmDynamicTilingTool(),
            'agent-dynamic-tiling': getDynamicTilingAgentTool(store),
            'agent-fsq-places': getFsqPlacesAgentTool(store),
          },
          getProviderOptions: (args: {provider: string; modelId: string}) => {
            if (args.provider === 'bedrock' && args.modelId.includes('nova')) {
              return {
                reasoningConfig: {
                  maxReasoningEffort: 'high',
                },
              };
            }
            return null;
          },
          getInstructions: () => {
            let instructions = AI_INSTRUCTIONS;

            // Add available tables to instructions
            const tables = store.getState().db.tables;
            const currentDatabase = store.getState().db.currentDatabase;
            if (tables.length > 0) {
              instructions = `${instructions}
Available tables in the local databases (format: tableName [rowCount] followed by indented columns):
${formatTablesForLLM(tables, currentDatabase)}`;
            }

            // Add available tilesets to instructions
            const tilesets = store.getState().tilesets;
            if (tilesets.length > 0) {
              const tilesetsList = tilesets
                .map((t) => `- ${t.name} (id: ${t.id})`)
                .join('\n');
              instructions = `${instructions}

Note: the tilesetName could start with "Tileset " prefix, please do not remove the prefix.
Available tilesets (format: - tilesetName (id: tilesetId)):
${tilesetsList}`;
            }

            // Add custom instructions from AI settings
            const customInstructions =
              get().aiSettings.config.modelParameters.additionalInstruction;
            if (customInstructions) {
              instructions = `${instructions}
Additional Instructions:
${customInstructions}`;
            }

            return instructions;
          },
        })(set, get, store);

        const roomState: RoomState = {
          appStore,
          largeDatasetDialog: undefined,
          projectSaveStatus: 'saved',
          projectSaveError: null,

          loadingProgress: {
            isLoading: false,
            progress: 0, // 0 -> 1
            stage: LoadingStage.DEFAULT,
          },

          ...baseRoomSlice,

          room: {
            ...baseRoomSlice.room,

            addOrUpdateSqlQueryDataSource: async (
              tableName,
              query,
              oldTableName,
              abortSignal,
            ) => {
              // overide project store add table to call add table to map
              await baseRoomSlice.room.addOrUpdateSqlQueryDataSource(
                tableName,
                query,
                oldTableName,
                abortSignal,
              );
              await get().kepler.syncKeplerDatasets();
            },
          },

          initialize: async () => {
            log.log('Initializing room');
            // load latest config
            try {
              // Migrate all config tables from legacy __kepler_desktop schema to fsq_spatial
              if (
                await get().db.checkTableExists({
                  schema: '__kepler_desktop',
                  table: 'config',
                })
              ) {
                for (const table of await get().db.getTables(
                  '__kepler_desktop',
                )) {
                  await connector.execute(
                    `CREATE TABLE IF NOT EXISTS fsq_spatial.${table} AS SELECT * FROM __kepler_desktop.${table}`,
                  );
                }
                await connector.execute(`DROP SCHEMA __kepler_desktop CASCADE`);
              }

              // Migrate from tileset_* tables to single tilesets table
              try {
                const tilesetTables = (
                  await connector.query(
                    `FROM duckdb_tables() SELECT table_name
                 WHERE schema_name='fsq_spatial' AND table_name SIMILAR TO '^tileset_.*'`,
                  )
                ).toArray();
                if (tilesetTables.length > 0) {
                  for (const {table_name} of tilesetTables) {
                    await connector.execute(
                      `INSERT INTO fsq_spatial.tilesets (id, name, type, tileset, metadata)
                   SELECT id, name, type, tileset, metadata FROM fsq_spatial.${table_name}`,
                    );
                    await connector.execute(
                      `DROP TABLE IF EXISTS fsq_spatial.${table_name}`,
                    );
                  }
                }
              } catch (error) {
                get().room.captureException(error, {
                  title: 'Error migrating tileset tables',
                });
              }

              const result = await connector.query(
                `FROM fsq_spatial.config SELECT * ORDER BY timestamp DESC LIMIT 1 `,
              );
              const configJson = result.getChildAt(0)?.get(0);
              const savedConfig = configJson
                ? RoomConfig.parse(JSON.parse(configJson))
                : undefined;

              if (savedConfig) {
                const roomSlice = get().room;
                if (hasSetConfig(roomSlice)) {
                  // RoomConfig stores base room fields at the top level
                  // (title/description/dataSources), not under `room`.
                  roomSlice.setConfig(BaseRoomConfig.parse(savedConfig));
                }

                CONFIG_SLICES_TO_SAVE.forEach((sliceKey) => {
                  const slice = get()[sliceKey];
                  if (hasSetConfig(slice)) {
                    slice.setConfig(savedConfig[sliceKey]);
                  }
                });

                // Migration: if legacy config stored AI conversations in fsq_spatial.config,
                // and the new conversation table is still empty, move the latest AI config there.
                try {
                  if (savedConfig.ai) {
                    const convCountResult = await connector.query(
                      `SELECT COUNT(*) AS cnt FROM fsq_spatial.conversation`,
                    );
                    const convCount = Number(
                      convCountResult.getChildAt(0)?.get(0) ?? 0,
                    );
                    if (convCount === 0) {
                      await connector.execute(
                        `INSERT INTO fsq_spatial.conversation (conversation) VALUES (${escapeVal(
                          JSON.stringify(savedConfig.ai),
                        )})`,
                      );
                      await connector.execute(`CHECKPOINT`);
                    }
                  }
                } catch (error) {
                  get().room.captureException(error, {
                    title: 'Error migrating AI config to conversation table',
                  });
                }

                // Load latest AI conversation config from separate table, if available
                try {
                  const convResult = await connector.query(
                    `FROM fsq_spatial.conversation SELECT * ORDER BY timestamp DESC LIMIT 1 `,
                  );
                  const convJson = convResult.getChildAt(0)?.get(0);
                  if (convJson) {
                    const aiConfig = JSON.parse(convJson as string);
                    // Clean up sessions: reset isRunning to false since running state
                    // cannot survive app restart (chat transports are not persisted)
                    if (aiConfig.sessions && Array.isArray(aiConfig.sessions)) {
                      aiConfig.sessions = aiConfig.sessions.map(
                        (session: {isRunning?: boolean}) => ({
                          ...session,
                          isRunning: false,
                        }),
                      );
                    }
                    if (hasSetConfig(get().ai)) {
                      get().ai.setConfig(aiConfig);
                    }
                  }
                } catch (error) {
                  get().room.captureException(error, {
                    title: 'Error loading AI conversation config',
                  });
                }
              } else {
                // No saved config - ensure default layout is set for new projects
                const defaultLayout = DEFAULT_LAYOUT;
                get().layout.setLayout(defaultLayout);
              }

              // Initialize LiteLLM provider config once using loaded models
              const models = useAppStore.getState().liteLlm.models;
              if (models.length > 0) {
                get().updateLiteLLMModels(models);
              }

              await get().initializeAiModelFromSubscriptionPlan();

              // Load tilesets from database and sync them to Kepler maps
              await get()._refreshTilesets();

              // Start monitoring query-start events and lazy polling for running queries.
              get().initializeRunningQueriesMonitoring();

              // Initialization complete — start tracking Kepler actions to Mixpanel
              isInitializing = false;
            } catch (error) {
              log.error('Error initializing room', error);
              initializationFailed = true;
              get().room.captureException(error, {
                title: 'Room initialization error',
              });
              set((state) =>
                produce(state, (draft) => {
                  draft.room.initialized = false;
                }),
              );
            }
          },

          updateLiteLLMModels: (
            models: Array<{name: string; models: string[]}>,
          ) => {
            set((state) =>
              produce(state, (draft) => {
                const newProviders: AiSettingsSliceConfig['providers'] =
                  models.reduce((acc, provider) => {
                    acc[provider.name] = {
                      baseUrl: LITELLM_BASE_URL,
                      apiKey: '',
                      models: provider.models.map((m) => ({modelName: m})),
                    };
                    return acc;
                  }, {});

                draft.aiSettings.config.providers = newProviders;
              }),
            );
          },

          ...createAiSettingsSlice({})(set, get, store),

          ...aiSlice,
          ai: {
            ...aiSlice.ai,
            promptSuggestionsVisible: true,
            startAnalysis: async (sessionId: string) => {
              // Track prompt submission before starting analysis
              const session = get().ai.config.sessions.find(
                (s) => s.id === sessionId,
              );
              trackEvent(MIXPANEL_AI_EVENTS.PROMPT_SUBMITTED, {
                sessionId,
                sessionName: session?.name ?? '',
              });
              return aiSlice.ai.startAnalysis(sessionId);
            },
            onChatToolCall: async (args) =>
              await withAgentActor(() => aiSlice.ai.onChatToolCall(args)),
          },
          saveConfig: throttle(async () => {
            if (!get().room.initialized || initializationFailed) {
              return;
            }
            try {
              set({projectSaveStatus: 'saving', projectSaveError: null});
              const parsedConfig = getConfigToSave();
              const connector = await get().db.getConnector();
              await connector.execute(
                `INSERT INTO fsq_spatial.config (config) VALUES (${escapeVal(JSON.stringify(parsedConfig))})`,
              );
              await cleanupConfigRetention(connector);
              // Make sure the config is saved to disk
              await connector.execute(`CHECKPOINT`);
              set({projectSaveStatus: 'saved'});
            } catch (error) {
              log.error('Error saving config', error);
              set({
                projectSaveStatus: 'error',
                projectSaveError:
                  error instanceof Error ? error.message : String(error),
              });
            }
            // get().room.setLastSavedConfig(config);
          }, 2000),

          saveConversation: throttle(async () => {
            if (!get().room.initialized) {
              return;
            }
            const aiSlice = get().ai;
            if (!hasConfig(aiSlice)) {
              return;
            }
            const connector = await get().db.getConnector();
            await connector.execute(
              `INSERT INTO fsq_spatial.conversation (conversation) VALUES (${escapeVal(
                JSON.stringify(aiSlice.config),
              )})`,
            );
            await connector.execute(`CHECKPOINT`);
          }, 2000),

          ...createTilesetsSlice({trackEvent})(set, get, store),
          ...createRunningQueriesSlice()(set, get, store),
          ...createSubscriptionSlice()(set, get, store),
          ...createCustomLayoutSlice({panels: PANELS})(set, get, store),
          ...createS3BrowserSlice()(set, get, store),
          ...createSqlEditorSlice({trackEvent})(set, get, store),

          kepler: {
            ...baseKeplerSlice,

            syncKeplerDatasets: async () => {
              // Add normal tables saved as tables in DuckDB to maps
              for (const mapId of Object.keys(get().kepler.map)) {
                const keplerDatasets =
                  get().kepler.map[mapId]?.visState.datasets;
                for (const {table, isView} of get().db.tables) {
                  if (
                    table.database !== 'fsq_rag' &&
                    table.schema === 'main' &&
                    !keplerDatasets?.[table.table]
                  ) {
                    // Skip views during auto-sync because they may reference
                    // external data sources (e.g. S3 parquet files) whose
                    // full scan would hang the backend.
                    if (isView) {
                      log.info(
                        `Skipping view "${table.table}" during auto-sync to Kepler.`,
                      );
                      continue;
                    }
                    try {
                      await get().kepler.addTableToMap(mapId, table.table, {
                        autoCreateLayers: false,
                        centerMap: false,
                      });
                    } catch (error) {
                      console.error(
                        'Error adding table to map',
                        table.table,
                        error,
                      );
                    }
                  }
                }
              }

              // Add tileset tables saved as special tables in DuckDB to maps
              get()._syncKeplerTilesets(get().kepler.map);
            },

            /** Override to show large dataset prompt */
            addTableToMap: async (mapId, tableName, options) => {
              const skipLargeDatasetCheck = (
                options as {skipLargeDatasetCheck: boolean}
              )?.skipLargeDatasetCheck;

              if (!options?.autoCreateLayers || skipLargeDatasetCheck) {
                // No auto-create layers, so we don't need to show the large dataset prompt
                return baseKeplerSlice.addTableToMap(mapId, tableName, options);
              }
              try {
                const decision = await get()._checkIsLargeDataset(tableName);
                if (decision === 'dynamic-tileset') {
                  // Add the table as a dynamic tileset
                  get().setDynamicTilesetDialog(
                    makeQualifiedTableName({table: tableName}),
                  );
                  return;
                }
                if (decision === 'cancel') {
                  // Cancel the add table to map operation
                  return;
                }

                // Add the table as a normal Kepler dataset
                set((state) => ({
                  loadingProgress: {
                    ...state.loadingProgress,
                    isLoading: true,
                    title: 'Adding table to map',
                    stage: LoadingStage.ADD_TABLE_TO_KEPLER,
                  },
                }));
                await baseKeplerSlice.addTableToMap(mapId, tableName);
              } finally {
                set((state) => ({
                  loadingProgress: {
                    ...state.loadingProgress,
                    isLoading: false,
                    title: null,
                    stage: LoadingStage.DEFAULT,
                  },
                }));
              }
            },
          },

          _checkIsLargeDataset: async (tableName: string) => {
            const rowCount = await get().db.loadTableRowCount(tableName);

            // Use a sophisticated algorithm to determine if the dataset is large
            const isLarge = await checkIfDatasetIsLarge(
              get().db.connector,
              tableName,
              rowCount,
            );

            if (isLarge) {
              // Resolver for large dataset prompt decision
              let resolveLargeDataset:
                | ((decision: 'as-is' | 'dynamic-tileset' | 'cancel') => void)
                | null = null;
              set({
                largeDatasetDialog: {
                  tableName,
                  rowCount,
                  chooseAsIs: () => {
                    resolveLargeDataset?.('as-is');
                    resolveLargeDataset = null;
                  },
                  chooseAsTileset: () => {
                    resolveLargeDataset?.('dynamic-tileset');
                    resolveLargeDataset = null;
                  },
                  cancelLargeDataset: () => {
                    resolveLargeDataset?.('cancel');
                    resolveLargeDataset = null;
                    set({largeDatasetDialog: undefined});
                  },
                },
              });
              const decision = await new Promise<
                'as-is' | 'dynamic-tileset' | 'cancel'
              >((resolve) => {
                resolveLargeDataset = resolve;
              });
              set({largeDatasetDialog: undefined});
              return decision;
            } else {
              return 'as-is';
            }
          },

          setLoadingProgress: (loadingProgress: Partial<LoadingProgress>) => {
            return set((state) => ({
              ...state,
              loadingProgress: {
                ...state.loadingProgress,
                ...loadingProgress,
              },
            }));
          },

          exportTable: async (tableName: string) => {
            const result = await window.api.db.exportTable(tableName);

            if (result?.status === 'error' && result?.error) {
              throw new Error(result.error);
            }
            trackEvent(MIXPANEL_QUERY_EVENTS.TABLE_EXPORTED, {
              tableName,
              actor: getCurrentActor(),
            });
            return result;
          },

          loadFiles: async (filePaths: string[]) => {
            const stepProgress =
              filePaths.length > 0 ? 1 / filePaths.length : 1;
            let currentProgress = 0;

            set((state) => ({
              ...state,
              loadingProgress: {
                ...state.loadingProgress,
                isLoading: true,
                progress: currentProgress,
              },
            }));

            const tablesToAdd: {tableName: string; rowCount: number}[] = [];
            const errors: FileLoadErrors = {};

            for (const filePath of filePaths) {
              let hasError = false;
              const methodErrors: Record<string, string> = {};
              try {
                const {name, ext} = splitFilePath(filePath);
                let methods: LoadFileOptions['method'][] = [];
                let extraLoadOptions: Record<string, string | string[]> = {};
                switch (ext.toLowerCase()) {
                  case 'csv':
                  case 'tsv':
                    methods = ['read_csv', 'auto'];
                    extraLoadOptions = {
                      auto_type_candidates: [
                        'BOOLEAN',
                        'INTEGER',
                        'DOUBLE',
                        'TIME',
                        'DATE',
                        'TIMESTAMP',
                        'VARCHAR',
                      ],
                    };
                    break;
                  case 'parquet':
                    methods = ['read_parquet', 'auto'];
                    break;
                  case 'arrow':
                    methods = ['auto'];
                    break;
                  case 'json':
                  case 'geojson':
                    methods = ['st_read', 'read_json', 'auto'];
                    break;
                  case 'shp':
                  case 'kml':
                  default:
                    methods = ['st_read', 'read_json', 'auto'];
                }

                for (const method of methods) {
                  try {
                    const loadOptions: LoadFileOptions = {
                      method,
                      replace: true,
                      ...extraLoadOptions,
                    };
                    const tableName = convertToValidColumnOrTableName(name);
                    await connector.loadFile(filePath, tableName, loadOptions);

                    const rowCount = await get().db.getTableRowCount(tableName);
                    await get().db.setTableRowCount(tableName, rowCount);
                    tablesToAdd.push({tableName, rowCount});
                    hasError = false;
                  } catch (error) {
                    hasError = true;
                    methodErrors[method] = String(error);
                    log.error('Error loading file', filePath, error);
                  }
                  if (!hasError) {
                    break;
                  }
                }

                if (hasError) {
                  const {name, ext} = splitFilePath(filePath);
                  const fileName = `${name}${ext}`;
                  errors[fileName] = methodErrors;
                }
              } catch (error) {
                const {name, ext} = splitFilePath(filePath);
                const fileName = `${name}${ext}`;
                errors[fileName] = {general: String(error)};
              }

              currentProgress += stepProgress;
              set((state) => ({
                ...state,
                loadingProgress: {
                  ...state.loadingProgress,
                  progress: currentProgress,
                },
              }));
            }

            set((state) => ({
              ...state,
              loadingProgress: {
                ...state.loadingProgress,
                isLoading: false,
              },
            }));
            await get().db.refreshTableSchemas();

            return {tables: tablesToAdd, errors};
          },

          loadFilesAndAddToMap: async (files: FileList | File[] | string[]) => {
            const normalized: (File | string)[] = Array.isArray(files)
              ? (files as (File | string)[])
              : Array.from(files as FileList);
            const filePaths: string[] = normalized.map((f) =>
              f instanceof File ? window.api.extractFilePath(f) : (f as string),
            );

            const errors: FileLoadErrors = {};
            const {tables, errors: loadErrors} =
              await get().loadFiles(filePaths);
            Object.assign(errors, loadErrors);

            const currentMapId = get().kepler.config.currentMapId;
            for (const {tableName} of tables) {
              try {
                await get().kepler.addTableToMap(currentMapId, tableName, {
                  autoCreateLayers: true,
                  centerMap: true,
                });
              } catch (error) {
                errors[`addToMap-${tableName}`] = {addToMap: String(error)};
                log.error('Error adding table to map', tableName, error);
              }
            }

            return {errors, tables: []};
          },

          db: {
            ...baseRoomSlice.db,
            loadTableSchemas: async (filter) => {
              const tables = await baseRoomSlice.db.loadTableSchemas(filter);
              // Filter out the tables and databases that are not intended for the user to see
              return tables.filter(
                ({table}) =>
                  table.schema !== 'fsq_spatial' &&
                  table.database !== 'fsq_rag' &&
                  table.database !== 'md_information_schema',
              );
            },
            refreshTableSchemas: async () => {
              const tables = await baseRoomSlice.db.refreshTableSchemas();
              get()._refreshTilesets();
              return tables;
            },
          },
        } satisfies RoomState;

        store.subscribe((state, prevState) => {
          const roomConfigChanged = state.room.config !== prevState.room.config;
          const otherConfigChanged = CONFIG_SLICES_TO_SAVE.some((sliceKey) => {
            const slice = state[sliceKey];
            const prevSlice = prevState[sliceKey];
            const config = hasConfig(slice) ? slice.config : undefined;
            const prevConfig = hasConfig(prevSlice)
              ? prevSlice.config
              : undefined;
            return config !== prevConfig;
          });
          if (roomConfigChanged || otherConfigChanged) {
            // Mark as unsaved immediately when config changes
            set({projectSaveStatus: 'unsaved'});
            get().saveConfig();
          }

          // Persist AI conversation separately whenever the AI slice config changes
          const aiSlice = state.ai;
          const prevAiSlice = prevState.ai;
          const aiConfig = hasConfig(aiSlice) ? aiSlice.config : undefined;
          const prevAiConfig = hasConfig(prevAiSlice)
            ? prevAiSlice.config
            : undefined;
          if (aiConfig !== prevAiConfig) {
            get().saveConversation();
          }
          //   if (state.db.tables !== prevState.db.tables) {
          //     // Update tilesets whenever table schemas are refreshed
          //     const tilesets = state.db.tables.filter(
          //       table => table.schema === 'fsq_spatial' && table.tableName.startsWith('tileset_')
          //     );
          //     set({tilesets});
          //   }
        });

        return roomState;

        function getConfigToSave() {
          const roomConfig = get().room.config;
          return RoomConfig.parse(
            CONFIG_SLICES_TO_SAVE.reduce(
              (acc, sliceKey) => {
                const slice = get()[sliceKey];
                if (!hasConfig(slice)) {
                  return acc;
                }
                acc[sliceKey] = slice.config;
                return acc;
              },
              // Keep room fields at top-level to match RoomConfig schema.
              BaseRoomConfig.parse(roomConfig),
            ),
          );
        }
      },
  );

function hasConfig(slice: unknown): slice is {config: Record<string, unknown>} {
  return Boolean(
    typeof slice === 'object' &&
    slice !== null &&
    'config' in slice &&
    typeof slice.config === 'object',
  );
}

function hasSetConfig(
  slice: unknown,
): slice is {setConfig: (config: unknown) => void} {
  return Boolean(
    typeof slice === 'object' &&
    slice !== null &&
    'setConfig' in slice &&
    typeof slice.setConfig === 'function',
  );
}
