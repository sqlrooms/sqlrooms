import {createOpenAICompatible} from '@ai-sdk/openai-compatible';
import {createDefaultAiTools, streamSubAgent} from '@sqlrooms/ai';
import {createWorksheetAgentTool} from '@sqlrooms/mosaic/ai';
import type {
  BaseAgentToolOptions,
  CreateWorksheetAgentToolOptions,
} from '@sqlrooms/mosaic/ai';
import type {StoreApi} from 'zustand';
import type {RoomState} from './store-types';
import {createWorksheetAiAdapter} from './createWorksheetAiAdapter';
import {createDatabaseAiAdapter} from './createDatabaseAiAdapter';
import {createDashboardAgentToolWithDeckMaps} from '@sqlrooms/deck';
import {createEmbeddedHtmlAppAgentTool} from './createEmbeddedHtmlAppAgent';

export function worksheetAgentTool(store: StoreApi<RoomState>) {
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

  const dashboardAgentTool = createDashboardAgentToolWithDeckMaps({
    ...baseOptions,
    databaseAdapter,
  });

  const worksheetAgentOptions: CreateWorksheetAgentToolOptions<RoomState> = {
    ...baseOptions,
    databaseAdapter,
    worksheetAdapter,
    dashboardAgentTool,
    extraTools: (params) => ({
      embedded_html_app_agent: createEmbeddedHtmlAppAgentTool(store, params),
    }),
  };

  return createWorksheetAgentTool(worksheetAgentOptions);
}
