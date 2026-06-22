import {createOpenAICompatible} from '@ai-sdk/openai-compatible';
import {createDefaultAiTools, streamSubAgent} from '@sqlrooms/ai';
import type {BaseAgentToolOptions} from '@sqlrooms/mosaic/ai';
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
import type {CreateWorksheetAgentToolOptions} from './ai/createWorksheetAgentTool';
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

  // Create worksheet agent tool options
  // Note: blockDocumentId will be determined dynamically in the agent tool itself
  const worksheetAgentOptions: CreateWorksheetAgentToolOptions<RoomState> = {
    ...baseOptions,
    blockDocumentAdapter,
    // Use empty string as placeholder - agent will get actual ID from artifacts at execution
    blockDocumentId: '',
    databaseAdapter,
    dashboardAgentTool,
    // worksheetTools factory - creates tools with the actual blockDocumentId at execution time
    worksheetTools: (blockDocumentId: string) =>
      createWorksheetBlockDocumentTools({
        blockDocumentAdapter,
        blockDocumentId,
        databaseAdapter,
        dashboardAgentTool,
        htmlAppAgentTool: htmlAppAgentTool(store),
        createDashboardBlock: (params) =>
          createDashboardBlockForWorksheet(store, params),
        extraTools: () => ({}),
      }),
    extraTools: () => ({
      embedded_html_app_agent: htmlAppAgentTool(store),
    }),
  };

  return createWorksheetAgentTool(worksheetAgentOptions);
}
