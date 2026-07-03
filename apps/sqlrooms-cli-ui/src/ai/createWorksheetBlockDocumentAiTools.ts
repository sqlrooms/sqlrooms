import type {Tool} from 'ai';
import {
  createAddBlockDocumentTextBlockTool,
  createCopyBlockDocumentBlocksTool,
  createListBlockDocumentBlocksTool,
  type BlockDocumentAiAdapter,
  type BlockDocumentStatefulBlockBlock,
} from '@sqlrooms/documents';
import {
  createAddMosaicDashboardBlockTool,
  createBlockDocumentChartTools,
  createBlockDocumentDataTableExplorerTool,
  type ChartToolsOptions,
  type DatabaseAiAdapter,
} from '@sqlrooms/mosaic/ai';
import {createAddHtmlAppBlockDocumentBlockTool} from './createAddHtmlAppBlockDocumentBlockTool';
import {KnownWorksheetTools} from './constants';

export type ExtraWorksheetAiToolsParams = {
  /** ID of the worksheet artifact being edited. */
  worksheetId: string;
  blockDocumentId: string;
  blockDocumentAdapter: BlockDocumentAiAdapter;
  databaseAdapter: DatabaseAiAdapter;
};

export type ExtraWorksheetAiToolsFactory = (
  params: ExtraWorksheetAiToolsParams,
) => Record<string, Tool>;

/**
 * Options for creating worksheet block-document AI tools in the CLI app.
 */
export type CreateWorksheetBlockDocumentAiToolsOptions = {
  databaseAdapter: DatabaseAiAdapter;
  blockDocumentAdapter: BlockDocumentAiAdapter;
  dashboardAgentTool: Tool;
  chartToolsOptions?: ChartToolsOptions;
  worksheetId: string;
  extraTools?: ExtraWorksheetAiToolsFactory;
  htmlAppBlocksEnabled?: boolean;
  createDashboardBlock: (params: {
    title: string;
    tableName: string;
    intent?: string;
  }) =>
    | {dashboardId: string; block: BlockDocumentStatefulBlockBlock}
    | Promise<{dashboardId: string; block: BlockDocumentStatefulBlockBlock}>;
  createDataTableExplorerBlock: (params: {
    title: string;
    tableName: string;
    intent?: string;
  }) =>
    | BlockDocumentStatefulBlockBlock
    | Promise<BlockDocumentStatefulBlockBlock>;
  createHtmlAppBlock?: (params: {
    title: string;
    intent?: string;
  }) =>
    | {appId: string; block: BlockDocumentStatefulBlockBlock}
    | Promise<{appId: string; block: BlockDocumentStatefulBlockBlock}>;
  addDashboardBlock?: (params: {
    worksheetId: string;
    title: string;
    tableName: string;
    intent?: string;
  }) => Promise<{dashboardId: string; blockId: string}>;
  addDataTableExplorerBlock?: (params: {
    worksheetId: string;
    title: string;
    tableName: string;
    intent?: string;
  }) => Promise<unknown>;
  addHtmlAppBlock?: (params: {
    worksheetId: string;
    title: string;
    intent?: string;
  }) => Promise<{appId: string; blockId: string}>;
};

function ensureNoOverride(
  builtInTools: Record<string, Tool>,
  additionalTools: Record<string, Tool>,
) {
  const duplicates = Object.keys(additionalTools).filter(
    (toolName) => toolName in builtInTools,
  );

  if (duplicates.length > 0) {
    throw new Error(
      `Custom worksheet AI tools cannot override built-in tools: ${duplicates.join(
        ', ',
      )}`,
    );
  }
}

/**
 * Creates the CLI worksheet tool collection by composing generic document
 * tools with Mosaic and HTML app integration tools.
 */
export function createWorksheetBlockDocumentAiTools({
  blockDocumentAdapter,
  databaseAdapter,
  chartToolsOptions,
  worksheetId,
  dashboardAgentTool,
  extraTools,
  htmlAppBlocksEnabled = false,
  createDashboardBlock,
  createDataTableExplorerBlock,
  createHtmlAppBlock,
  addDashboardBlock,
  addDataTableExplorerBlock,
  addHtmlAppBlock,
}: CreateWorksheetBlockDocumentAiToolsOptions): Record<string, Tool> {
  const chartTools = createBlockDocumentChartTools({
    databaseAdapter,
    blockDocumentAdapter,
    chartToolsOptions,
    blockDocumentId: worksheetId,
  });

  const addTextBlockTool = createAddBlockDocumentTextBlockTool({
    blockDocumentAdapter,
    blockDocumentId: worksheetId,
  });

  const addDashboardBlockTool = createAddMosaicDashboardBlockTool({
    blockDocumentAdapter,
    blockDocumentId: worksheetId,
    addDashboardBlock: addDashboardBlock
      ? (params) => addDashboardBlock({worksheetId, ...params})
      : undefined,
    createDashboardBlock,
  });

  const addDataTableExplorerTool = createBlockDocumentDataTableExplorerTool({
    databaseAdapter,
    blockDocumentAdapter,
    blockDocumentId: worksheetId,
    addDataTableExplorerBlock: addDataTableExplorerBlock
      ? (params) => addDataTableExplorerBlock({worksheetId, ...params})
      : undefined,
    createDataTableExplorerBlock,
  });

  const listBlocksTool = createListBlockDocumentBlocksTool({
    blockDocumentAdapter,
    blockDocumentId: worksheetId,
    usageHint: `Use this before updating an existing worksheet (block document) dashboard, map, or app block. You may also pass another block document artifact ID to inspect a source worksheet before copying blocks from it. Stateful blocks include statefulBlock.blockType and statefulBlock.blockInstanceId. For dashboard blocks, pass statefulBlock.blockInstanceId to ${KnownWorksheetTools.embedded_dashboard_agent} as dashboardId. For map blocks, pass statefulBlock.blockInstanceId to a direct worksheet map tool when available.${
      htmlAppBlocksEnabled
        ? ` For html-app blocks, pass statefulBlock.blockInstanceId to ${KnownWorksheetTools.embedded_html_app_agent} as appId. For a new worksheet HTML app, use ${KnownWorksheetTools.add_html_app_block} first.`
        : ''
    }`,
  });

  const copyBlocksTool = createCopyBlockDocumentBlocksTool({
    blockDocumentAdapter,
    blockDocumentId: worksheetId,
    usageHint:
      'In the CLI app, worksheets are block document artifacts. Use this to copy chart, text, image, or stateful blocks from a source worksheet into the current worksheet. Passing the same source and target worksheet ID duplicates blocks within that worksheet.',
  });

  const additionalTools =
    extraTools?.({
      worksheetId,
      blockDocumentId: worksheetId,
      blockDocumentAdapter,
      databaseAdapter,
    }) ?? {};

  if (
    htmlAppBlocksEnabled &&
    !additionalTools[KnownWorksheetTools.embedded_html_app_agent]
  ) {
    throw new Error(
      `${KnownWorksheetTools.add_html_app_block} requires ${KnownWorksheetTools.embedded_html_app_agent} in extraTools when htmlAppBlocksEnabled is true.`,
    );
  }

  const builtInTools: Record<string, Tool> = {
    ...chartTools,
    [KnownWorksheetTools.list_blocks]: listBlocksTool,
    [KnownWorksheetTools.copy_blocks]: copyBlocksTool,
    [KnownWorksheetTools.add_text_block]: addTextBlockTool,
    [KnownWorksheetTools.add_dashboard_block]: addDashboardBlockTool,
    [KnownWorksheetTools.add_data_table_explorer]: addDataTableExplorerTool,
    [KnownWorksheetTools.embedded_dashboard_agent]: dashboardAgentTool,
    ...(htmlAppBlocksEnabled
      ? {
          [KnownWorksheetTools.add_html_app_block]:
            createAddHtmlAppBlockDocumentBlockTool({
              blockDocumentAdapter,
              blockDocumentId: worksheetId,
              addHtmlAppBlock: addHtmlAppBlock
                ? (params) => addHtmlAppBlock({worksheetId, ...params})
                : undefined,
              createHtmlAppBlock,
            }),
        }
      : {}),
  };

  ensureNoOverride(builtInTools, additionalTools);

  return {
    ...builtInTools,
    ...additionalTools,
  };
}
