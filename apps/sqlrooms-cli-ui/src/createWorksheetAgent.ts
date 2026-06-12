import {createOpenAICompatible} from '@ai-sdk/openai-compatible';
import {
  createDefaultAiTools,
  streamSubAgent,
  commandsToTools,
} from '@sqlrooms/ai';
import {createBlockDocumentCommands} from '@sqlrooms/documents';
import {createWorksheetAgentTool} from '@sqlrooms/mosaic/ai';
import type {CreateWorksheetAgentToolOptions} from '@sqlrooms/mosaic/ai';
import type {StoreApi} from 'zustand';
import type {RoomState} from './store-types';
import {createWorksheetAiAdapter} from './createWorksheetAdapter';

export function worksheetAgentTool(store: StoreApi<RoomState>) {
  const adapter = createWorksheetAiAdapter(store);

  // Get block document commands for worksheets
  const blockCommands = createBlockDocumentCommands({
    commandNamespace: 'worksheet',
    artifactType: 'worksheet',
    artifactLabel: 'worksheet',
  });

  // Convert specific commands to individual tools
  const commandTools = commandsToTools(
    blockCommands.filter((cmd) => {
      // Only expose commands relevant for worksheet agent
      const allowedSuffixes = [
        'create-chart-block',
        'append-blocks',
        'list',
        'get',
      ];
      return allowedSuffixes.some((suffix) => cmd.id.endsWith(suffix));
    }),
    store,
    {
      defaultOptions: {
        actor: 'worksheet-agent',
      },
    },
  );

  const options: CreateWorksheetAgentToolOptions<RoomState> = {
    store,
    adapter,
    commandTools,
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
