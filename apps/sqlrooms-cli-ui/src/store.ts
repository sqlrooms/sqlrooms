import {
  AiSettingsSliceConfig,
  AiSettingsSliceState,
  AiSliceConfig,
  AiSliceState,
  createAiSettingsSlice,
  createAiSlice,
  createDefaultAiInstructions,
  createDefaultAiToolRenderers,
  createDefaultAiTools,
} from '@sqlrooms/ai';
import {
  CanvasSliceConfig,
  CanvasSliceState,
  createCanvasSlice,
} from '@sqlrooms/canvas';
import {
  CellsSliceConfig,
  CellsSliceState,
  createCellsSlice,
  createDefaultCellRegistry,
} from '@sqlrooms/cells';
import {createWebSocketDuckDbConnector} from '@sqlrooms/duckdb';
import type {MosaicSliceState} from '@sqlrooms/mosaic';
import {createMosaicSlice} from '@sqlrooms/mosaic';
import {
  createNotebookSlice,
  NotebookSliceConfig,
  NotebookSliceState,
} from '@sqlrooms/notebook';
import type {RoomCommand} from '@sqlrooms/room-shell';
import {
  BaseRoomConfig,
  createRoomShellSlice,
  createRoomStore,
  LayoutConfig,
  persistSliceConfigs,
  registerCommandsForOwner,
  RoomShellSliceState,
  unregisterCommandsForOwner,
} from '@sqlrooms/room-shell';
import {
  createSqlEditorSlice,
  SqlEditorSliceConfig,
  SqlEditorSliceState,
} from '@sqlrooms/sql-editor';
import {createVegaChartTool, VegaChartToolResult} from '@sqlrooms/vega';
import {
  createWebContainerSlice,
  WebContainerSliceConfig,
  WebContainerSliceState,
} from '@sqlrooms/webcontainer';
import {tool} from 'ai';
import {produce} from 'immer';
import {z} from 'zod';

import {createHttpDbBridge, DbConnection} from '@sqlrooms/db';
import {getDefaultScaffoldTree} from './helpers';
import {LAYOUT} from './layout';
import {fetchRuntimeConfig} from './runtimeConfig';
import {createDuckDbPersistStorage, uploadFileToServer} from './serverApi';
import {getErrorMessage} from './utils';

export const AppBuilderProjectConfig = z.object({
  appsBySheetId: z
    .record(
      z.string(),
      z.object({
        name: z.string().default('Untitled App'),
        prompt: z.string().default(''),
        template: z.string().default('mosaic-dashboard'),
        files: z.record(z.string(), z.string()).default({}),
        updatedAt: z.number().default(0),
      }),
    )
    .default({}),
});
export type AppBuilderProjectConfig = z.infer<typeof AppBuilderProjectConfig>;

export const DEFAULT_DASHBOARD_VGPLOT_SPEC = JSON.stringify(
  {
    $schema: 'https://idl.uw.edu/mosaic/schema/latest.json',
    meta: {
      title: 'New Dashboard',
      description:
        'Use the assistant to generate a dashboard spec from your current DuckDB tables.',
    },
    data: {
      sample: {
        type: 'table',
        query: `
          SELECT * FROM (
            VALUES
              ('A', 12),
              ('B', 26),
              ('C', 18),
              ('D', 9)
          ) AS t(category, amount)
        `,
      },
    },
    plot: [
      {
        mark: 'barY',
        data: {from: 'sample'},
        x: 'category',
        y: 'amount',
        fill: 'category',
      },
    ],
    xLabel: 'Category',
    yLabel: 'Amount',
    width: 560,
    height: 320,
  },
  null,
  2,
);

export const DashboardProjectConfig = z.object({
  dashboardsBySheetId: z
    .record(
      z.string(),
      z.object({
        vgplot: z.string().default(DEFAULT_DASHBOARD_VGPLOT_SPEC),
        updatedAt: z.number().default(0),
      }),
    )
    .default({}),
});
export type DashboardProjectConfig = z.infer<typeof DashboardProjectConfig>;

const DASHBOARD_COMMAND_OWNER = '@sqlrooms-cli-ui/dashboard';

const DashboardCreateSheetCommandInput = z
  .object({
    title: z.string().optional().describe('Optional dashboard sheet title.'),
  })
  .default({});
type DashboardCreateSheetCommandInput = z.infer<
  typeof DashboardCreateSheetCommandInput
>;

const DashboardSelectSheetCommandInput = z.object({
  sheetId: z.string().describe('Target dashboard sheet ID.'),
});
type DashboardSelectSheetCommandInput = z.infer<
  typeof DashboardSelectSheetCommandInput
>;

const DashboardSetVgplotCommandInput = z.object({
  sheetId: z
    .string()
    .optional()
    .describe('Optional dashboard sheet ID. Defaults to current dashboard.'),
  vgplot: z
    .string()
    .describe('Vgplot JSON string for the dashboard specification.'),
});
type DashboardSetVgplotCommandInput = z.infer<
  typeof DashboardSetVgplotCommandInput
>;

const DashboardGetVgplotCommandInput = z
  .object({
    sheetId: z
      .string()
      .optional()
      .describe('Optional dashboard sheet ID. Defaults to current dashboard.'),
  })
  .default({});
type DashboardGetVgplotCommandInput = z.infer<
  typeof DashboardGetVgplotCommandInput
>;

const DashboardCreateSheetToolParameters = z
  .object({
    title: z.string().optional(),
  })
  .default({});
type DashboardCreateSheetToolParameters = z.infer<
  typeof DashboardCreateSheetToolParameters
>;

const DashboardGetVgplotToolParameters = z
  .object({
    sheetId: z.string().optional(),
  })
  .default({});
type DashboardGetVgplotToolParameters = z.infer<
  typeof DashboardGetVgplotToolParameters
>;

const DashboardSetVgplotToolParameters = z.object({
  sheetId: z
    .string()
    .optional()
    .describe('Optional target dashboard sheet ID.'),
  vgplot: z
    .union([z.string(), z.object({}).passthrough()])
    .describe('Dashboard vgplot specification as JSON string or object.'),
  createSheetIfMissing: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      'If true and no dashboard sheet is selected, create one automatically.',
    ),
});
type DashboardSetVgplotToolParameters = z.infer<
  typeof DashboardSetVgplotToolParameters
>;

const DASHBOARD_AI_INSTRUCTIONS = `
Dashboard authoring:
- Use the dashboard tools to create/update dashboard vgplot specs.
- Prefer \`set_dashboard_vgplot\` with complete JSON.
- Ensure specs are valid JSON objects compatible with https://idl.uw.edu/mosaic/schema/latest.json.
- Use SQL against DuckDB tables when deciding fields, filters, and aggregations in the spec.
`;

function parseVgplotSpecString(vgplot: string): {
  parsed: Record<string, unknown>;
  formatted: string;
} {
  let parsedValue: unknown;
  try {
    parsedValue = JSON.parse(vgplot);
  } catch (error) {
    throw new Error(
      `Vgplot spec must be valid JSON. ${getErrorMessage(error)}`,
    );
  }
  if (
    typeof parsedValue !== 'object' ||
    parsedValue === null ||
    Array.isArray(parsedValue)
  ) {
    throw new Error('Vgplot spec must be a JSON object.');
  }
  return {
    parsed: parsedValue as Record<string, unknown>,
    formatted: JSON.stringify(parsedValue, null, 2),
  };
}

function toVgplotSpecString(vgplot: string | Record<string, unknown>): string {
  return typeof vgplot === 'string' ? vgplot : JSON.stringify(vgplot, null, 2);
}

export type RoomState = RoomShellSliceState &
  MosaicSliceState &
  AiSliceState &
  SqlEditorSliceState &
  AiSettingsSliceState &
  CellsSliceState &
  NotebookSliceState &
  CanvasSliceState &
  WebContainerSliceState & {
    appProject: {
      config: AppBuilderProjectConfig;
      upsertSheetApp: (
        sheetId: string,
        app: Partial<AppBuilderProjectConfig['appsBySheetId'][string]> & {
          name: string;
        },
      ) => void;
      updateSheetAppFiles: (
        sheetId: string,
        files: Record<string, string>,
      ) => void;
      getSheetApp: (
        sheetId: string,
      ) => AppBuilderProjectConfig['appsBySheetId'][string] | undefined;
    };
    dashboard: {
      initialize?: () => Promise<void>;
      destroy?: () => Promise<void>;
      config: DashboardProjectConfig;
      ensureSheetDashboard: (sheetId: string) => void;
      setSheetVgplot: (sheetId: string, vgplot: string) => void;
      getSheetVgplot: (sheetId: string) => string | undefined;
      getCurrentDashboardSheetId: () => string | undefined;
      createDashboardSheet: (title?: string) => string;
      setCurrentSheetVgplot: (vgplot: string) => string;
    };
    isAssistantOpen: boolean;
    setAssistantOpen: (isAssistantOpen: boolean) => void;
  };

function createDashboardCommands(): RoomCommand<RoomState>[] {
  return [
    {
      id: 'dashboard.create-sheet',
      name: 'Create dashboard sheet',
      description: 'Create a new dashboard sheet and select it',
      group: 'Dashboard',
      keywords: ['dashboard', 'sheet', 'create', 'new'],
      inputSchema: DashboardCreateSheetCommandInput,
      inputDescription: 'Optional title for the dashboard sheet.',
      metadata: {
        readOnly: false,
        idempotent: false,
        riskLevel: 'low',
      },
      execute: ({getState}, input) => {
        const {title} =
          (input as DashboardCreateSheetCommandInput | undefined) ?? {};
        const sheetId = getState().dashboard.createDashboardSheet(title);
        return {
          success: true,
          commandId: 'dashboard.create-sheet',
          message: `Created dashboard sheet "${sheetId}".`,
          data: {sheetId},
        };
      },
    },
    {
      id: 'dashboard.select-sheet',
      name: 'Select dashboard sheet',
      description: 'Switch current sheet to a dashboard sheet',
      group: 'Dashboard',
      keywords: ['dashboard', 'sheet', 'select', 'switch'],
      inputSchema: DashboardSelectSheetCommandInput,
      inputDescription: 'Provide the dashboard sheet ID.',
      metadata: {
        readOnly: false,
        idempotent: true,
        riskLevel: 'low',
      },
      validateInput: (input, {getState}) => {
        const {sheetId} = input as DashboardSelectSheetCommandInput;
        const sheet = getState().cells.config.sheets[sheetId];
        if (!sheet) {
          throw new Error(`Unknown sheet "${sheetId}".`);
        }
        if (sheet.type !== 'dashboard') {
          throw new Error(`Sheet "${sheetId}" is not a dashboard sheet.`);
        }
      },
      execute: ({getState}, input) => {
        const {sheetId} = input as DashboardSelectSheetCommandInput;
        getState().cells.setCurrentSheet(sheetId);
        getState().dashboard.ensureSheetDashboard(sheetId);
        return {
          success: true,
          commandId: 'dashboard.select-sheet',
          message: `Selected dashboard sheet "${sheetId}".`,
        };
      },
    },
    {
      id: 'dashboard.set-vgplot',
      name: 'Set dashboard vgplot',
      description: 'Set the vgplot JSON spec for a dashboard sheet',
      group: 'Dashboard',
      keywords: ['dashboard', 'vgplot', 'spec', 'json', 'update'],
      inputSchema: DashboardSetVgplotCommandInput,
      inputDescription: 'Provide vgplot JSON and optional dashboard sheet ID.',
      metadata: {
        readOnly: false,
        idempotent: false,
        riskLevel: 'medium',
      },
      validateInput: (input, {getState}) => {
        const {sheetId, vgplot} = input as DashboardSetVgplotCommandInput;
        parseVgplotSpecString(vgplot);
        if (!sheetId) return;
        const sheet = getState().cells.config.sheets[sheetId];
        if (!sheet) {
          throw new Error(`Unknown sheet "${sheetId}".`);
        }
        if (sheet.type !== 'dashboard') {
          throw new Error(`Sheet "${sheetId}" is not a dashboard sheet.`);
        }
      },
      execute: ({getState}, input) => {
        const {sheetId, vgplot} = input as DashboardSetVgplotCommandInput;
        const state = getState();
        const targetSheetId =
          sheetId ??
          state.dashboard.getCurrentDashboardSheetId() ??
          state.dashboard.createDashboardSheet();
        state.dashboard.setSheetVgplot(targetSheetId, vgplot);
        state.cells.setCurrentSheet(targetSheetId);
        return {
          success: true,
          commandId: 'dashboard.set-vgplot',
          message: `Updated dashboard spec for "${targetSheetId}".`,
          data: {sheetId: targetSheetId},
        };
      },
    },
    {
      id: 'dashboard.get-vgplot',
      name: 'Get dashboard vgplot',
      description: 'Read the current vgplot JSON spec for a dashboard sheet',
      group: 'Dashboard',
      keywords: ['dashboard', 'vgplot', 'spec', 'json', 'read'],
      inputSchema: DashboardGetVgplotCommandInput,
      inputDescription: 'Optional dashboard sheet ID.',
      metadata: {
        readOnly: true,
        idempotent: true,
        riskLevel: 'low',
      },
      execute: ({getState}, input) => {
        const {sheetId} =
          (input as DashboardGetVgplotCommandInput | undefined) ?? {};
        const state = getState();
        const targetSheetId =
          sheetId ?? state.dashboard.getCurrentDashboardSheetId();
        if (!targetSheetId) {
          return {
            success: false,
            commandId: 'dashboard.get-vgplot',
            error: 'No dashboard sheet is available.',
          };
        }
        const sheet = state.cells.config.sheets[targetSheetId];
        if (!sheet || sheet.type !== 'dashboard') {
          return {
            success: false,
            commandId: 'dashboard.get-vgplot',
            error: `Sheet "${targetSheetId}" is not a dashboard sheet.`,
          };
        }
        state.dashboard.ensureSheetDashboard(targetSheetId);
        const vgplot = state.dashboard.getSheetVgplot(targetSheetId);
        return {
          success: true,
          commandId: 'dashboard.get-vgplot',
          data: {
            sheetId: targetSheetId,
            vgplot,
          },
        };
      },
    },
  ];
}

function createDashboardAiTools(store: {getState: () => RoomState}) {
  return {
    create_dashboard_sheet: tool({
      description:
        'Create a new dashboard sheet and make it the active sheet. Use when no dashboard sheet exists yet.',
      inputSchema: DashboardCreateSheetToolParameters,
      execute: async (params: DashboardCreateSheetToolParameters) => {
        const {title} = params;
        const sheetId = store.getState().dashboard.createDashboardSheet(title);
        return {
          llmResult: {
            success: true,
            details: `Created dashboard sheet "${sheetId}".`,
            data: {sheetId},
          },
        };
      },
    }),
    get_dashboard_vgplot: tool({
      description:
        'Get the current vgplot JSON spec for a dashboard sheet. If sheetId is omitted, uses the current dashboard sheet.',
      inputSchema: DashboardGetVgplotToolParameters,
      execute: async (params: DashboardGetVgplotToolParameters) => {
        const state = store.getState();
        const targetSheetId =
          params.sheetId ?? state.dashboard.getCurrentDashboardSheetId();
        if (!targetSheetId) {
          return {
            llmResult: {
              success: false,
              errorMessage:
                'No dashboard sheet found. Create one with create_dashboard_sheet first.',
            },
          };
        }
        const sheet = state.cells.config.sheets[targetSheetId];
        if (!sheet || sheet.type !== 'dashboard') {
          return {
            llmResult: {
              success: false,
              errorMessage: `Sheet "${targetSheetId}" is not a dashboard sheet.`,
            },
          };
        }
        state.dashboard.ensureSheetDashboard(targetSheetId);
        const vgplot = state.dashboard.getSheetVgplot(targetSheetId);
        return {
          llmResult: {
            success: true,
            details: `Loaded dashboard spec from "${targetSheetId}".`,
            data: {
              sheetId: targetSheetId,
              vgplot,
            },
          },
        };
      },
    }),
    set_dashboard_vgplot: tool({
      description:
        'Set the vgplot JSON spec for a dashboard sheet. If sheetId is omitted, updates the current dashboard sheet (or creates one when allowed).',
      inputSchema: DashboardSetVgplotToolParameters,
      execute: async (params: DashboardSetVgplotToolParameters) => {
        const state = store.getState();
        let targetSheetId =
          params.sheetId ?? state.dashboard.getCurrentDashboardSheetId();
        if (!targetSheetId && params.createSheetIfMissing) {
          targetSheetId = state.dashboard.createDashboardSheet();
        }
        if (!targetSheetId) {
          return {
            llmResult: {
              success: false,
              errorMessage:
                'No dashboard sheet available. Set createSheetIfMissing=true or provide a sheetId.',
            },
          };
        }

        try {
          const vgplotString = toVgplotSpecString(params.vgplot);
          state.dashboard.setSheetVgplot(targetSheetId, vgplotString);
          state.cells.setCurrentSheet(targetSheetId);
          return {
            llmResult: {
              success: true,
              details: `Updated dashboard spec for "${targetSheetId}".`,
              data: {
                sheetId: targetSheetId,
                vgplot: state.dashboard.getSheetVgplot(targetSheetId),
              },
            },
          };
        } catch (error) {
          return {
            llmResult: {
              success: false,
              errorMessage: getErrorMessage(error),
            },
          };
        }
      },
    }),
  };
}

export const runtimeConfig = await fetchRuntimeConfig();
const runtimeAiProviders =
  (runtimeConfig.aiProviders as AiSettingsSliceConfig['providers']) || {};
const defaultProviderFromConfig =
  runtimeConfig.llmProvider || Object.keys(runtimeAiProviders)[0] || 'openai';
const defaultModelFromProvider =
  runtimeAiProviders[defaultProviderFromConfig]?.models?.[0]?.modelName;
const defaultModelFromConfig =
  runtimeConfig.llmModel || defaultModelFromProvider || 'gpt-4o-mini';

const connector = createWebSocketDuckDbConnector({
  wsUrl: runtimeConfig.wsUrl || 'ws://localhost:4000',
});

const baseLoadFile = connector.loadFile.bind(connector);
connector.loadFile = async (file, desiredTableName, options) => {
  if (file instanceof File) {
    const serverPath = await uploadFileToServer(file, runtimeConfig);
    const renamedFile = new File([file], serverPath, {type: file.type});
    return baseLoadFile(renamedFile, desiredTableName, options);
  }
  return baseLoadFile(file, desiredTableName, options);
};

function getRuntimeBridgeConfig():
  | {
      id: string;
      connections: Array<{
        id: string;
        engineId: string;
        title: string;
        runtimeSupport?: 'browser' | 'server' | 'both';
        requiresBridge?: boolean;
        bridgeId?: string;
        isCore?: boolean;
      }>;
    }
  | undefined {
  if (runtimeConfig.dbBridge?.connections?.length) {
    return runtimeConfig.dbBridge;
  }
  return undefined;
}

export const {roomStore, useRoomStore} = createRoomStore<RoomState>(
  persistSliceConfigs<RoomState>(
    {
      name: 'sqlrooms-cli-app-state',
      sliceConfigSchemas: {
        room: BaseRoomConfig,
        layout: LayoutConfig,
        ai: AiSliceConfig,
        // aiSettings: AiSettingsSliceConfig,
        sqlEditor: SqlEditorSliceConfig,
        cells: CellsSliceConfig,
        notebook: NotebookSliceConfig,
        canvas: CanvasSliceConfig,
        webContainer: WebContainerSliceConfig,
        appProject: AppBuilderProjectConfig,
        dashboard: DashboardProjectConfig,
      },
      storage: createDuckDbPersistStorage(connector, {
        namespace: runtimeConfig.metaNamespace || '__sqlrooms',
      }),
    },
    (set, get, store) => {
      const getFirstDashboardSheetId = () =>
        Object.values(get().cells.config.sheets).find(
          (sheet) => sheet.type === 'dashboard',
        )?.id;

      const dashboardSlice: RoomState['dashboard'] = {
        initialize: async () => {
          registerCommandsForOwner(
            store,
            DASHBOARD_COMMAND_OWNER,
            createDashboardCommands(),
          );
        },
        destroy: async () => {
          unregisterCommandsForOwner(store, DASHBOARD_COMMAND_OWNER);
        },
        config: DashboardProjectConfig.parse({}),
        ensureSheetDashboard: (sheetId) => {
          const sheet = get().cells.config.sheets[sheetId];
          if (!sheet || sheet.type !== 'dashboard') {
            return;
          }
          set((state) =>
            produce(state, (draft) => {
              if (draft.dashboard.config.dashboardsBySheetId[sheetId]) {
                return;
              }
              draft.dashboard.config.dashboardsBySheetId[sheetId] = {
                vgplot: DEFAULT_DASHBOARD_VGPLOT_SPEC,
                updatedAt: Date.now(),
              };
            }),
          );
        },
        setSheetVgplot: (sheetId, vgplot) => {
          const sheet = get().cells.config.sheets[sheetId];
          if (!sheet) {
            throw new Error(`Unknown sheet "${sheetId}".`);
          }
          if (sheet.type !== 'dashboard') {
            throw new Error(`Sheet "${sheetId}" is not a dashboard sheet.`);
          }
          const {formatted} = parseVgplotSpecString(vgplot);
          set((state) =>
            produce(state, (draft) => {
              draft.dashboard.config.dashboardsBySheetId[sheetId] = {
                vgplot: formatted,
                updatedAt: Date.now(),
              };
            }),
          );
        },
        getSheetVgplot: (sheetId) =>
          get().dashboard.config.dashboardsBySheetId[sheetId]?.vgplot,
        getCurrentDashboardSheetId: () => {
          const currentSheetId = get().cells.config.currentSheetId;
          const currentSheet = currentSheetId
            ? get().cells.config.sheets[currentSheetId]
            : undefined;
          if (currentSheet?.type === 'dashboard') {
            return currentSheetId;
          }
          return getFirstDashboardSheetId();
        },
        createDashboardSheet: (title) => {
          const sheetId = get().cells.addSheet(title, 'dashboard');
          get().dashboard.ensureSheetDashboard(sheetId);
          return sheetId;
        },
        setCurrentSheetVgplot: (vgplot) => {
          const state = get();
          const targetSheetId =
            state.dashboard.getCurrentDashboardSheetId() ??
            state.dashboard.createDashboardSheet();
          state.dashboard.setSheetVgplot(targetSheetId, vgplot);
          state.cells.setCurrentSheet(targetSheetId);
          return targetSheetId;
        },
      };

      return {
        appProject: {
          config: AppBuilderProjectConfig.parse({}),
          upsertSheetApp: (sheetId, app) => {
            set(
              produce((draft: RoomState) => {
                const current = draft.appProject.config.appsBySheetId[
                  sheetId
                ] ?? {
                  name: app.name,
                  prompt: '',
                  template: 'mosaic-dashboard',
                  files: {},
                  updatedAt: 0,
                };
                draft.appProject.config.appsBySheetId[sheetId] = {
                  ...current,
                  ...app,
                  updatedAt: Date.now(),
                };
              }),
            );
          },
          updateSheetAppFiles: (sheetId, files) => {
            set((state) =>
              produce(state, (draft) => {
                const current = draft.appProject.config.appsBySheetId[sheetId];
                if (!current) return;
                draft.appProject.config.appsBySheetId[sheetId] = {
                  ...current,
                  files,
                  updatedAt: Date.now(),
                };
              }),
            );
          },
          getSheetApp: (sheetId) =>
            get().appProject.config.appsBySheetId[sheetId],
        },
        dashboard: dashboardSlice,
        isAssistantOpen: false,
        setAssistantOpen: (isAssistantOpen: boolean) => {
          set({isAssistantOpen});
        },

        ...createRoomShellSlice({
          connector,
          config: {dataSources: []},
          layout: LAYOUT,
        })(set, get, store),

        ...createMosaicSlice()(set, get, store),

        ...createSqlEditorSlice()(set, get, store),

        ...createCellsSlice({
          cellRegistry: createDefaultCellRegistry(),
          supportedSheetTypes: ['notebook', 'canvas', 'app', 'dashboard'],
        })(set, get, store),

        ...createNotebookSlice()(set, get, store),

        ...createCanvasSlice()(set, get, store),

        ...createWebContainerSlice({
          autoInitialize: false,
          config: {
            filesTree: getDefaultScaffoldTree(),
            activeFilePath: '/src/App.jsx',
          },
        })(set, get, store),

        ...createAiSettingsSlice({
          config: {providers: runtimeAiProviders},
        })(set, get, store),

        ...createAiSlice({
          config: AiSliceConfig.parse({sessions: []}),
          defaultProvider: defaultProviderFromConfig as any,
          defaultModel: defaultModelFromConfig,
          getApiKey: (provider) =>
            runtimeAiProviders[provider]?.apiKey || runtimeConfig.apiKey || '',
          getBaseUrl: () => runtimeConfig.apiBaseUrl || '',
          getInstructions: () =>
            `${createDefaultAiInstructions(store)}\n\n${DASHBOARD_AI_INSTRUCTIONS}`,
          tools: {
            ...createDefaultAiTools(store, {query: {}}),
            ...createDashboardAiTools(store),
            chart: createVegaChartTool(),
          },
          toolRenderers: {
            ...createDefaultAiToolRenderers(),
            chart: VegaChartToolResult,
          },
        })(set, get, store),
      };
    },
  ),
);

const bridgeConfig = getRuntimeBridgeConfig();
if (bridgeConfig?.connections.length) {
  const bridge = createHttpDbBridge({
    id: bridgeConfig.id,
    baseUrl: runtimeConfig.apiBaseUrl || '',
  });
  const state = roomStore.getState();
  state.db.connectors.registerBridge(bridge);
  for (const connection of bridgeConfig.connections) {
    const normalizedConnection: DbConnection = {
      id: connection.id,
      engineId: connection.engineId,
      title: connection.title || connection.id,
      runtimeSupport: connection.runtimeSupport || 'server',
      requiresBridge: connection.requiresBridge ?? true,
      bridgeId: connection.bridgeId || bridgeConfig.id,
      isCore: connection.isCore ?? false,
    };
    state.db.connectors.registerConnection(normalizedConnection);
  }
}
