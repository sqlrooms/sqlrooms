import type {Tool} from 'ai';
import {
  createAddBlockDocumentTextBlockTool,
  createListBlockDocumentBlocksTool,
  type BlockDocumentAiAdapter,
} from '@sqlrooms/documents';
import {
  createBlockDocumentChartTools,
  createAddMosaicDashboardBlockTool,
  createBlockDocumentDataTableExplorerTool,
  type DatabaseAiAdapter,
} from '@sqlrooms/mosaic/ai';
import {resolveChartTypes} from '@sqlrooms/mosaic';
import {createAddHtmlAppBlockDocumentTool} from './createAddHtmlAppBlockDocumentTool';
import type {BlockDocumentStatefulBlockBlock} from '@sqlrooms/documents';

export type CreateWorksheetBlockDocumentToolsOptions = {
  blockDocumentAdapter: BlockDocumentAiAdapter;
  blockDocumentId: string;
  databaseAdapter: DatabaseAiAdapter;
  dashboardAgentTool: Tool;
  htmlAppAgentTool: Tool;
  chartToolsOptions?: {
    chartTypes?: string[];
    chartMaxDataPoints?: number;
  };
  createDashboardBlock: (params: {
    title: string;
    tableName: string;
    intent?: string;
  }) => {dashboardId: string; block: BlockDocumentStatefulBlockBlock};
  extraTools?: () => Record<string, Tool>;
};

/**
 * Creates all tools needed for worksheet block document operations.
 * Composes tools from documents, mosaic, and CLI-specific implementations.
 */
export function createWorksheetBlockDocumentTools(
  options: CreateWorksheetBlockDocumentToolsOptions,
): Record<string, Tool> {
  return {
    // Generic document tools from @sqlrooms/documents
    add_block_document_text_block: createAddBlockDocumentTextBlockTool({
      blockDocumentAdapter: options.blockDocumentAdapter,
      blockDocumentId: options.blockDocumentId,
    }),
    list_block_document_blocks: createListBlockDocumentBlocksTool({
      blockDocumentAdapter: options.blockDocumentAdapter,
      blockDocumentId: options.blockDocumentId,
    }),

    // Mosaic chart tools from @sqlrooms/mosaic
    ...createBlockDocumentChartTools({
      blockDocumentAdapter: options.blockDocumentAdapter,
      blockDocumentId: options.blockDocumentId,
      databaseAdapter: options.databaseAdapter,
      chartToolsOptions: options.chartToolsOptions
        ? {
            chartTypes: resolveChartTypes(options.chartToolsOptions.chartTypes),
            chartMaxDataPoints: options.chartToolsOptions.chartMaxDataPoints,
          }
        : undefined,
    }),

    // Mosaic dashboard block tool
    add_mosaic_dashboard_block: createAddMosaicDashboardBlockTool({
      blockDocumentAdapter: options.blockDocumentAdapter,
      blockDocumentId: options.blockDocumentId,
      createDashboardBlock: options.createDashboardBlock,
    }),

    // Mosaic data table explorer tool
    add_data_table_explorer_block: createBlockDocumentDataTableExplorerTool({
      blockDocumentAdapter: options.blockDocumentAdapter,
      blockDocumentId: options.blockDocumentId,
      databaseAdapter: options.databaseAdapter,
    }),

    // HTML app tool (CLI-specific)
    add_html_app_block: createAddHtmlAppBlockDocumentTool({
      blockDocumentAdapter: options.blockDocumentAdapter,
      blockDocumentId: options.blockDocumentId,
    }),

    // Embedded agents
    embedded_dashboard_agent: options.dashboardAgentTool,
    embedded_html_app_agent: options.htmlAppAgentTool,

    // Extra host tools
    ...(options.extraTools?.() || {}),
  };
}
