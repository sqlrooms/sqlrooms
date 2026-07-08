import {createOpenAICompatible} from '@ai-sdk/openai-compatible';
import {createDefaultAiTools, streamSubAgent} from '@sqlrooms/ai';
import type {BaseAgentToolOptions} from '@sqlrooms/mosaic/ai';
import {tool, type Tool} from 'ai';
import {createDashboardAgentTool} from '@sqlrooms/mosaic/ai';
import type {StoreApi} from 'zustand';
import type {RoomState} from './store-types';
import {createCliBlockDocumentAiAdapter} from './createCliBlockDocumentAiAdapter';
import {createDatabaseAiAdapter} from './createDatabaseAiAdapter';
import {createDashboardAgentToolWithDeckMaps} from '@sqlrooms/deck';
import {htmlAppAgentTool} from './createHtmlAppAgent';
import {createDefaultBlockDocumentBlockId} from '@sqlrooms/documents';
import {
  createCliBlockDocumentAgentTool,
  type CreateCliBlockDocumentAgentToolOptions,
} from './ai/createCliBlockDocumentAgentTool';
import {
  EXPERIMENTAL_BLOCK_DOCUMENT_AGENT_INSTRUCTIONS,
  KnownBlockDocumentTools,
} from './ai/constants';
import {BlockDocumentMapBlockToolParameters} from './createCliBlockDocumentCommands';

const BlockDocumentMapBlockToolInput = BlockDocumentMapBlockToolParameters.omit(
  {
    blockDocumentId: true,
  },
);

function createBlockDocumentMapBlockTool(
  store: StoreApi<RoomState>,
  blockDocumentId: string,
): Tool {
  return tool({
    description: `Create or update a direct worksheet map block from a native Deck JSON map config.

Use this for map, geospatial, spatial, longitude/latitude, geometry, H3, route, or location visualizations inside a worksheet. This creates a worksheet map block directly; do not create a dashboard block just to show a map.`,
    inputSchema: BlockDocumentMapBlockToolInput,
    execute: async (params) => {
      try {
        const result = await store
          .getState()
          .commands.invokeCommand(
            'block-document.add-map-block',
            {blockDocumentId, ...params},
            {surface: 'ai', actor: 'block-document-agent'},
          );
        if (!result.success) {
          throw new Error(
            result.error ??
              result.message ??
              'Failed to add worksheet map block.',
          );
        }
        const data = result.data as
          | {
              mapId?: string;
              blockId?: string;
              panelId?: string;
            }
          | undefined;

        return {
          success: true,
          mapId: data?.mapId,
          blockId: data?.blockId,
          panelId: data?.panelId,
          message: result.message,
        };
      } catch (error) {
        return {
          success: false,
          errorMessage: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });
}

export function blockDocumentAgentTool(
  store: StoreApi<RoomState>,
  {
    experimentalEnabled = false,
  }: {
    experimentalEnabled?: boolean;
  } = {},
) {
  const blockDocumentAdapter = createCliBlockDocumentAiAdapter(store);
  const databaseAdapter = createDatabaseAiAdapter(store);

  const baseOptions: BaseAgentToolOptions<RoomState> = {
    store,
    getModel: ({state}) => {
      const currentSession = state.ai.getCurrentSession();
      const provider = currentSession?.modelProvider || 'openai';
      const modelId = currentSession?.model || 'gpt-4.1';

      return createOpenAICompatible({
        apiKey: state.ai.getApiKeyFromSettings(),
        name: provider || '',
        baseURL:
          state.ai.getBaseUrlFromSettings() || 'https://api.openai.com/v1',
      }).chatModel(modelId);
    },
    createDataTools: () =>
      createDefaultAiTools(store, {query: {}, tables: true, commands: false}),
    runSubAgent: ({agent, prompt, parentToolCallId, abortSignal}) =>
      streamSubAgent(agent, prompt, store, parentToolCallId, abortSignal),
  };

  const dashboardAgentTool = (
    experimentalEnabled
      ? createDashboardAgentToolWithDeckMaps
      : createDashboardAgentTool
  )({
    ...baseOptions,
    databaseAdapter,
  });

  const blockDocumentAgentOptions: CreateCliBlockDocumentAgentToolOptions = {
    ...baseOptions,
    databaseAdapter,
    blockDocumentAdapter,
    dashboardAgentTool,
    htmlAppBlocksEnabled: experimentalEnabled,
    mapBlocksEnabled: experimentalEnabled,
    addDashboardBlock: async ({blockDocumentId, title, tableName, intent}) => {
      const result = await store
        .getState()
        .commands.invokeCommand(
          'block-document.add-dashboard-block',
          {blockDocumentId, title, tableName, intent},
          {surface: 'ai', actor: 'block-document-agent'},
        );
      if (!result.success) {
        throw new Error(
          result.error ?? result.message ?? 'Failed to add dashboard block.',
        );
      }
      const data = result.data as
        | {dashboardId?: string; blockId?: string}
        | undefined;
      if (!data?.dashboardId || !data.blockId) {
        throw new Error('Dashboard block command did not return IDs.');
      }
      return {dashboardId: data.dashboardId, blockId: data.blockId};
    },
    addDataTableExplorerBlock: async ({
      blockDocumentId,
      title,
      tableName,
      intent,
    }) => {
      const result = await store
        .getState()
        .commands.invokeCommand(
          'block-document.add-data-table-block',
          {blockDocumentId, title, tableName, intent},
          {surface: 'ai', actor: 'block-document-agent'},
        );
      if (!result.success) {
        throw new Error(
          result.error ?? result.message ?? 'Failed to add data table block.',
        );
      }
      return result.data;
    },
    addHtmlAppBlock: async ({blockDocumentId, title, intent}) => {
      const result = await store
        .getState()
        .commands.invokeCommand(
          'block-document.add-html-app-block',
          {blockDocumentId, title, intent},
          {surface: 'ai', actor: 'block-document-agent'},
        );
      if (!result.success) {
        throw new Error(
          result.error ?? result.message ?? 'Failed to add HTML app block.',
        );
      }
      const data = result.data as
        | {appId?: string; blockId?: string}
        | undefined;
      if (!data?.appId || !data.blockId) {
        throw new Error('HTML app block command did not return IDs.');
      }
      return {appId: data.appId, blockId: data.blockId};
    },
    createDashboardBlock: ({title, tableName, intent}) => {
      const state = store.getState();
      const dashboardId = state.mosaicDashboard.createDashboard(title);

      state.mosaicDashboard.setSelectedTable(dashboardId, tableName);

      return {
        dashboardId,
        block: {
          type: 'statefulBlock',
          id: createDefaultBlockDocumentBlockId(),
          blockInstanceId: dashboardId,
          blockType: 'dashboard',
          intent,
          caption: title,
        },
      };
    },
    createDataTableExplorerBlock: ({title, tableName, intent}) => ({
      type: 'statefulBlock',
      id: createDefaultBlockDocumentBlockId(),
      blockInstanceId: createDefaultBlockDocumentBlockId(),
      blockType: 'data-table',
      intent,
      tableName,
      caption: title,
    }),
    additionalInstructions: experimentalEnabled
      ? EXPERIMENTAL_BLOCK_DOCUMENT_AGENT_INSTRUCTIONS
      : undefined,
    extraTools: ({blockDocumentId}) => {
      const tools: Record<string, Tool> = {};
      if (blockDocumentAgentOptions.htmlAppBlocksEnabled) {
        tools[KnownBlockDocumentTools.embedded_html_app_agent] =
          htmlAppAgentTool(store);
      }
      if (blockDocumentAgentOptions.mapBlocksEnabled) {
        tools[KnownBlockDocumentTools.create_block_document_map_block] =
          createBlockDocumentMapBlockTool(store, blockDocumentId);
      }
      return tools;
    },
  };

  return createCliBlockDocumentAgentTool(blockDocumentAgentOptions);
}
