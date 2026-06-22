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

  // Get current worksheet ID from artifacts state
  const currentWorksheet = store.getState().artifacts.currentArtifact;
  if (!currentWorksheet || currentWorksheet.type !== 'worksheet') {
    throw new Error('No current worksheet artifact');
  }

  const blockDocumentId = currentWorksheet.id;

  const worksheetTools = createWorksheetBlockDocumentTools({
    blockDocumentAdapter,
    blockDocumentId,
    databaseAdapter,
    dashboardAgentTool,
    htmlAppAgentTool: htmlAppAgentTool(store),
    createDashboardBlock: (params) =>
      createDashboardBlockForWorksheet(store, params),
    extraTools: () => ({}),
  });

  return createWorksheetAgentTool({
    ...baseOptions,
    blockDocumentAdapter,
    blockDocumentId,
    databaseAdapter,
    dashboardAgentTool,
    worksheetTools,
  });
}
