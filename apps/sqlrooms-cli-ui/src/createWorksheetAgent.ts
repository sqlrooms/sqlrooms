import {createOpenAICompatible} from '@ai-sdk/openai-compatible';
import {createDefaultAiTools, streamSubAgent} from '@sqlrooms/ai';
import {createWorksheetAgentTool} from '@sqlrooms/mosaic/ai';
import type {CreateWorksheetAgentToolOptions} from '@sqlrooms/mosaic/ai';
import type {StoreApi} from 'zustand';
import type {RoomState} from './store-types';
import {createWorksheetAiAdapter} from './createWorksheetAiAdapter';

export function worksheetAgentTool(store: StoreApi<RoomState>) {
  const adapter = createWorksheetAiAdapter(store);

  const options: CreateWorksheetAgentToolOptions<RoomState> = {
    store,
    adapter,
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
    createQueryTools: () => ({
      query: createDefaultAiTools(store, {query: {}}).query,
    }),
    runSubAgent: ({agent, prompt, parentToolCallId, abortSignal}) =>
      streamSubAgent(agent, prompt, store, parentToolCallId, abortSignal),
  };

  return createWorksheetAgentTool(options);
}
