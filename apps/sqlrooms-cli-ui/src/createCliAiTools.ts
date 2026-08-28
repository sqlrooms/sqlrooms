import {createDefaultAiTools} from '@sqlrooms/ai';
import type {LanguageModel, Tool} from 'ai';
import type {StoreApi} from 'zustand';
import {blockDocumentAgentTool} from './createBlockDocumentAgent';
import {createArtifactContextAiTools} from './context/createArtifactContextAiTools';
import type {CliCapabilityProfile} from './profiles';
import type {RoomState} from './store-types';
import {CLI_BLOCK_DOCUMENT_AGENT_TOOL_NAME} from './ai/constants';

/** Inputs that let production and headless targets share CLI tool composition. */
export type CreateCliAiToolsOptions = {
  store: StoreApi<RoomState>;
  profile: CliCapabilityProfile;
  webContainerTools?: Record<string, Tool>;
  nestedAgentModel?: LanguageModel;
  createDashboardAgentTool?: (
    store: StoreApi<RoomState>,
    options: {deckMapsEnabled: boolean},
  ) => Tool;
  createHtmlAppAgentTool?: (store: StoreApi<RoomState>) => Tool;
  createStandaloneChartTool?: () => Tool;
  createChartImageTool?: (store: StoreApi<RoomState>) => Tool;
  renderedSurfaceImageToolsEnabled?: boolean;
  createRenderedSurfaceImageTools?: () => Record<string, Tool>;
};

/** Creates exactly the top-level AI tool groups enabled by a CLI profile. */
export function createCliAiTools({
  store,
  profile,
  webContainerTools = {},
  nestedAgentModel,
  createDashboardAgentTool,
  createHtmlAppAgentTool,
  createStandaloneChartTool,
  createChartImageTool,
  renderedSurfaceImageToolsEnabled = false,
  createRenderedSurfaceImageTools,
}: CreateCliAiToolsOptions): Record<string, Tool> {
  const enabledTools = new Set(profile.ai.topLevelToolGroups);
  const tools: Record<string, Tool> = {};
  if (enabledTools.has('default-data-analysis')) {
    Object.assign(tools, createDefaultAiTools(store, {query: {}}));
  }
  if (enabledTools.has('artifact-context')) {
    Object.assign(tools, createArtifactContextAiTools(store, profile));
  }
  if (enabledTools.has('dashboard-agent')) {
    if (!createDashboardAgentTool) {
      throw new Error('Dashboard agent factory is required by this profile.');
    }
    tools.dashboard_agent = createDashboardAgentTool(store, {
      deckMapsEnabled: profile.dashboard.deckMaps,
    });
  }
  if (enabledTools.has('html-app-agent')) {
    if (!createHtmlAppAgentTool) {
      throw new Error('HTML app agent factory is required by this profile.');
    }
    tools.html_app_agent = createHtmlAppAgentTool(store);
  }
  if (enabledTools.has('document-agent')) {
    tools[CLI_BLOCK_DOCUMENT_AGENT_TOOL_NAME] = blockDocumentAgentTool(store, {
      profile,
      ...(nestedAgentModel ? {getModel: () => nestedAgentModel} : {}),
    });
  }
  if (enabledTools.has('webcontainer')) {
    Object.assign(tools, webContainerTools);
  }
  if (enabledTools.has('chart') && createStandaloneChartTool) {
    tools.chart = createStandaloneChartTool();
  }
  if (enabledTools.has('chart-image-for-markdown') && createChartImageTool) {
    tools.chart_image_for_markdown = createChartImageTool(store);
  }
  if (renderedSurfaceImageToolsEnabled) {
    if (!createRenderedSurfaceImageTools) {
      throw new Error(
        'Rendered surface image tool factory is required when the tools are enabled.',
      );
    }
    Object.assign(tools, createRenderedSurfaceImageTools());
  }
  return tools;
}
