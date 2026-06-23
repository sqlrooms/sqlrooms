import {createOpenAICompatible} from '@ai-sdk/openai-compatible';
import {createDefaultAiTools, streamSubAgent} from '@sqlrooms/ai';
import type {BaseAgentToolOptions} from '@sqlrooms/mosaic/ai';
import {tool, type Tool} from 'ai';
import {createDashboardAgentTool} from '@sqlrooms/mosaic/ai';
import type {StoreApi} from 'zustand';
import type {RoomState} from './store-types';
import {createWorksheetAiAdapter} from './createWorksheetAiAdapter';
import {createDatabaseAiAdapter} from './createDatabaseAiAdapter';
import {
  createDashboardAgentToolWithDeckMaps,
  createDeckMapPanelFromNativeConfig,
  DeckMapDashboardToolParameters,
  DECK_MAP_DASHBOARD_PANEL_TYPE,
  type DeckMapDashboardConfigToolConfig,
} from '@sqlrooms/deck';
import {htmlAppAgentTool} from './createHtmlAppAgent';
import {
  BlockDocumentStatefulBlockBlock,
  createDefaultBlockDocumentBlockId,
} from '@sqlrooms/documents';
import {z} from 'zod';
import {
  createWorksheetAgentTool,
  type CreateWorksheetAgentToolOptions,
} from './ai/createWorksheetAgentTool';

const WorksheetMapBlockToolParameters = DeckMapDashboardToolParameters.extend({
  mapId: z
    .string()
    .optional()
    .describe('Existing worksheet map block resource ID to update.'),
  intent: z
    .string()
    .optional()
    .describe('Durable purpose for this worksheet map block.'),
});

function getFirstDatasetSourceTableName(
  config: DeckMapDashboardConfigToolConfig,
): string | undefined {
  if (!config.datasets || typeof config.datasets !== 'object') {
    return undefined;
  }

  return Object.values(config.datasets)
    .map(
      (dataset) =>
        (dataset as Record<string, unknown>).source as
          | {tableName?: string}
          | undefined,
    )
    .find((source) => source?.tableName)?.tableName;
}

function hasSqlOnlyDatasetSource(
  config: DeckMapDashboardConfigToolConfig,
): boolean {
  if (!config.datasets || typeof config.datasets !== 'object') {
    return false;
  }

  return Object.values(config.datasets).some((dataset) => {
    const source = (dataset as Record<string, unknown>).source as
      | {tableName?: string; sqlQuery?: string}
      | undefined;
    return Boolean(source?.sqlQuery && !source.tableName);
  });
}

function createWorksheetMapBlockTool(
  store: StoreApi<RoomState>,
  worksheetId: string,
): Tool {
  return tool({
    description: `Create or update a direct worksheet map block from a native Deck JSON map config.

Use this for map, geospatial, spatial, longitude/latitude, geometry, H3, route, or location visualizations inside a worksheet. This creates a worksheet map block directly; do not create a dashboard block just to show a map.`,
    inputSchema: WorksheetMapBlockToolParameters,
    execute: async (params) => {
      try {
        const state = store.getState();
        const artifact = state.artifacts.getArtifact(worksheetId);
        if (!artifact || artifact.type !== 'worksheet') {
          throw new Error(`Artifact ${worksheetId} is not a worksheet`);
        }

        const tableName =
          params.tableName ?? getFirstDatasetSourceTableName(params.config);
        if (
          params.mapId &&
          !tableName &&
          hasSqlOnlyDatasetSource(params.config)
        ) {
          throw new Error(
            'tableName is required when updating a worksheet map block with SQL-only dataset sources',
          );
        }
        if (tableName && !state.db.findTable(tableName)) {
          throw new Error(`Table ${tableName} was not found`);
        }

        state.blockDocuments.ensureBlockDocument(worksheetId);

        const mapId = params.mapId ?? createDefaultBlockDocumentBlockId();
        const title = params.title || 'Map';
        const existingMapBlock = params.mapId
          ? state.blockDocuments
              .getBlocks(worksheetId)
              .find(
                (block): block is BlockDocumentStatefulBlockBlock =>
                  block.type === 'statefulBlock' &&
                  block.blockType === 'map' &&
                  block.blockInstanceId === params.mapId,
              )
          : undefined;
        if (params.mapId && !existingMapBlock) {
          throw new Error(
            `Worksheet map block ${params.mapId} was not found in worksheet ${worksheetId}`,
          );
        }

        state.mosaicDashboard.ensureDashboard(mapId, title, 'grid');
        if (tableName) {
          state.mosaicDashboard.setSelectedTable(mapId, tableName);
        }

        const panel = createDeckMapPanelFromNativeConfig({
          title,
          config: params.config,
        });

        const dashboard = state.mosaicDashboard.getDashboard(mapId);
        const existingPanel = params.panelId
          ? dashboard?.panels.find(
              (candidate) =>
                candidate.id === params.panelId &&
                candidate.type === DECK_MAP_DASHBOARD_PANEL_TYPE,
            )
          : dashboard?.panels.find(
              (candidate) => candidate.type === DECK_MAP_DASHBOARD_PANEL_TYPE,
            );

        if (params.panelId && !existingPanel) {
          throw new Error(`Map panel ${params.panelId} was not found`);
        }

        if (existingPanel) {
          state.mosaicDashboard.updatePanel(mapId, existingPanel.id, {
            title: panel.title,
            config: panel.config,
          });
        } else {
          state.mosaicDashboard.addPanel(mapId, panel);
        }

        let blockId: string | undefined;
        if (existingMapBlock) {
          state.blockDocuments.updateBlock(worksheetId, existingMapBlock.id, {
            ...existingMapBlock,
            title,
            caption: title,
          });
          blockId = existingMapBlock.id;
        } else {
          const block: BlockDocumentStatefulBlockBlock = {
            type: 'statefulBlock',
            id: createDefaultBlockDocumentBlockId(),
            blockInstanceId: mapId,
            blockType: 'map',
            intent: params.intent,
            title,
            caption: title,
            height: 560,
          };
          state.blockDocuments.appendBlocks(worksheetId, [block]);
          blockId = block.id;
        }

        return {
          success: true,
          mapId,
          blockId,
          panelId: existingPanel?.id ?? panel.id,
          message: params.mapId
            ? `Updated worksheet map block "${title}".`
            : `Added worksheet map block "${title}".`,
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

export function worksheetAgentTool(
  store: StoreApi<RoomState>,
  {
    experimentalEnabled = false,
  }: {
    experimentalEnabled?: boolean;
  } = {},
) {
  const worksheetAdapter = createWorksheetAiAdapter(store);
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

  const worksheetAgentOptions: CreateWorksheetAgentToolOptions = {
    ...baseOptions,
    databaseAdapter,
    blockDocumentAdapter: worksheetAdapter,
    dashboardAgentTool,
    htmlAppBlocksEnabled: experimentalEnabled,
    mapBlocksEnabled: experimentalEnabled,
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
      title: tableName,
      caption: title,
    }),
    additionalInstructions: experimentalEnabled
      ? [
          'Direct worksheet map blocks are available in this CLI app.',
          'For worksheet map requests, call create_worksheet_map_block. Do not create a dashboard block just to hold a map.',
          'If updating an existing worksheet map, call list_block_document_blocks first and pass its statefulBlock.blockInstanceId as mapId to create_worksheet_map_block.',
        ].join('\n')
      : undefined,
    extraTools: ({worksheetId}) => {
      const extraTools: Record<string, Tool> = {};

      if (experimentalEnabled) {
        extraTools.embedded_html_app_agent = htmlAppAgentTool(store);
        extraTools.create_worksheet_map_block = createWorksheetMapBlockTool(
          store,
          worksheetId,
        );
      }

      return extraTools;
    },
  };

  return createWorksheetAgentTool(worksheetAgentOptions);
}
