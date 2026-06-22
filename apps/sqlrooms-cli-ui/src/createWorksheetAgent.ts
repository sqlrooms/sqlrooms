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
import {
  createAddBlockDocumentTextBlockTool,
  createListBlockDocumentBlocksTool,
} from '@sqlrooms/documents';
import {
  createBlockDocumentChartTools,
  createAddMosaicDashboardBlockTool,
  createBlockDocumentDataTableExplorerTool,
} from '@sqlrooms/mosaic/ai';
import {createAddHtmlAppBlockDocumentTool} from './ai/createAddHtmlAppBlockDocumentTool';

// Note: Full agent tool creation would go here with proper tool composition
// For now, keeping the simplified export structure

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

  // TODO: Implement full worksheet agent tool composition here
  // This is a placeholder showing the new structure

  throw new Error(
    'worksheetAgentTool needs full implementation with tool composition',
  );
}
