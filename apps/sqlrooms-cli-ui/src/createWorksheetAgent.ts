import {createOpenAICompatible} from '@ai-sdk/openai-compatible';
import {createDefaultAiTools, streamSubAgent} from '@sqlrooms/ai';
import type {BaseAgentToolOptions} from '@sqlrooms/mosaic/ai';
import {tool} from 'ai';
import {z} from 'zod';
import type {StoreApi} from 'zustand';
import type {RoomState} from './store-types';
import {
  createWorksheetAiAdapter,
  createDashboardBlockForWorksheet,
} from './createWorksheetAiAdapter';
import {createDatabaseAiAdapter} from './createDatabaseAiAdapter';
import {createDashboardAgentToolWithDeckMaps} from '@sqlrooms/deck';
import {htmlAppAgentTool} from './createHtmlAppAgent';
import {createWorksheetBlockDocumentTools} from './ai/createWorksheetBlockDocumentTools';
import {createWorksheetAgentTool} from './ai/createWorksheetAgentTool';

export function worksheetAgentTool(store: StoreApi<RoomState>) {
  const blockDocumentAdapter = createWorksheetAiAdapter(store);
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

  const dashboardAgentTool = createDashboardAgentToolWithDeckMaps({
    ...baseOptions,
    databaseAdapter,
  });

  // Return a tool that lazily gets the current worksheet ID when executed
  return tool({
    description: `Create or update a worksheet with charts, text blocks, and interactive components.
Use this to build data visualization worksheets with multiple chart blocks showing different aspects of the data.`,
    inputSchema: z.object({
      worksheetTitle: z
        .string()
        .optional()
        .describe('Optional worksheet title if creating new worksheet'),
      tableName: z
        .string()
        .optional()
        .describe('Optional primary table/dataset name'),
      intent: z
        .string()
        .min(1, 'intent cannot be empty')
        .describe('The natural-language objective for the agent to satisfy.'),
    }),
    execute: async (params) => {
      // Get current worksheet ID at execution time
      const currentWorksheet = store.getState().artifacts.currentArtifact;
      if (!currentWorksheet || currentWorksheet.type !== 'worksheet') {
        return {
          success: false,
          finalOutput: '',
          worksheetId: '',
          error: 'No current worksheet artifact',
        };
      }

      const blockDocumentId = currentWorksheet.id;

      const worksheetTools = createWorksheetBlockDocumentTools({
        blockDocumentAdapter,
        blockDocumentId,
        databaseAdapter,
        dashboardAgentTool,
        htmlAppAgentTool: htmlAppAgentTool(store),
        createDashboardBlock: (p) => createDashboardBlockForWorksheet(store, p),
        extraTools: () => ({}),
      });

      const agentTool = createWorksheetAgentTool({
        ...baseOptions,
        blockDocumentAdapter,
        blockDocumentId,
        databaseAdapter,
        dashboardAgentTool,
        worksheetTools,
      });

      // Execute the actual agent tool
      return await agentTool.execute(params);
    },
  });
}
