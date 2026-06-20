import {createOpenAICompatible} from '@ai-sdk/openai-compatible';
import {createDefaultAiTools, streamSubAgent} from '@sqlrooms/ai';
import {createDashboardAgentToolWithDeckMaps} from '@sqlrooms/deck';
import type {CreateDashboardAgentToolOptions} from '@sqlrooms/mosaic/ai';
import type {StoreApi} from 'zustand';
import type {RoomState} from './store-types';
import {createDatabaseAiAdapter} from './createDatabaseAiAdapter';

export function dashboardAgentTool(store: StoreApi<RoomState>) {
  const options: CreateDashboardAgentToolOptions<RoomState> = {
    store,
    databaseAdapter: createDatabaseAiAdapter(store),
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

  return createDashboardAgentToolWithDeckMaps(options);
}
