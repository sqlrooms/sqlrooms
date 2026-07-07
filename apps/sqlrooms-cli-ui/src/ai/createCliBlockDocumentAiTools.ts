import type {Tool} from 'ai';
import {
  createAddBlockDocumentTextBlockTool,
  createListBlockDocumentBlocksTool,
  createMoveBlockDocumentBlockTool,
  type BlockDocumentAiAdapter,
  type BlockDocumentMoveBlockAiAdapter,
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
import {KnownBlockDocumentTools} from './constants';

export type ExtraBlockDocumentAiToolsParams = {
  /** ID of the block document artifact being edited. */
  blockDocumentId: string;
  blockDocumentAdapter: BlockDocumentAiAdapter;
  databaseAdapter: DatabaseAiAdapter;
};

export type ExtraBlockDocumentAiToolsFactory = (
  params: ExtraBlockDocumentAiToolsParams,
) => Record<string, Tool>;

/**
 * Options for creating block-document AI tools in the CLI app.
 */
export type CreateCliBlockDocumentAiToolsOptions = {
  databaseAdapter: DatabaseAiAdapter;
  blockDocumentAdapter: BlockDocumentAiAdapter &
    BlockDocumentMoveBlockAiAdapter;
  dashboardAgentTool: Tool;
  chartToolsOptions?: ChartToolsOptions;
  blockDocumentId: string;
  targetBlockId?: string;
  extraTools?: ExtraBlockDocumentAiToolsFactory;
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
    blockDocumentId: string;
    title: string;
    tableName: string;
    intent?: string;
  }) => Promise<{dashboardId: string; blockId: string}>;
  addDataTableExplorerBlock?: (params: {
    blockDocumentId: string;
    title: string;
    tableName: string;
    intent?: string;
  }) => Promise<unknown>;
  addHtmlAppBlock?: (params: {
    blockDocumentId: string;
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
      `Custom block-document AI tools cannot override built-in tools: ${duplicates.join(
        ', ',
      )}`,
    );
  }
}

/**
 * Creates the CLI block-document tool collection by composing generic document
 * tools with Mosaic and HTML app integration tools.
 */
export function createCliBlockDocumentAiTools({
  blockDocumentAdapter,
  databaseAdapter,
  chartToolsOptions,
  blockDocumentId,
  targetBlockId,
  dashboardAgentTool,
  extraTools,
  htmlAppBlocksEnabled = false,
  createDashboardBlock,
  createDataTableExplorerBlock,
  createHtmlAppBlock,
  addDashboardBlock,
  addDataTableExplorerBlock,
  addHtmlAppBlock,
}: CreateCliBlockDocumentAiToolsOptions): Record<string, Tool> {
  const chartTools = createBlockDocumentChartTools({
    databaseAdapter,
    blockDocumentAdapter,
    chartToolsOptions,
    blockDocumentId,
    targetBlockId,
  });

  const addTextBlockTool = createAddBlockDocumentTextBlockTool({
    blockDocumentAdapter,
    blockDocumentId,
  });

  const addDashboardBlockTool = createAddMosaicDashboardBlockTool({
    blockDocumentAdapter,
    blockDocumentId,
    addDashboardBlock: addDashboardBlock
      ? (params) => addDashboardBlock({blockDocumentId, ...params})
      : undefined,
    createDashboardBlock,
  });

  const addDataTableExplorerTool = createBlockDocumentDataTableExplorerTool({
    databaseAdapter,
    blockDocumentAdapter,
    blockDocumentId,
    addDataTableExplorerBlock: addDataTableExplorerBlock
      ? (params) => addDataTableExplorerBlock({blockDocumentId, ...params})
      : undefined,
    createDataTableExplorerBlock,
  });

  const listBlocksTool = createListBlockDocumentBlocksTool({
    blockDocumentAdapter,
    blockDocumentId,
    usageHint: `Use this before updating an existing worksheet dashboard, map, or app block. Stateful blocks include statefulBlock.blockType and statefulBlock.blockInstanceId. For dashboard blocks, pass statefulBlock.blockInstanceId to ${KnownBlockDocumentTools.embedded_dashboard_agent} as dashboardId. For map blocks, pass statefulBlock.blockInstanceId to ${KnownBlockDocumentTools.create_block_document_map_block} as mapId when the direct worksheet map tool is available.${
      htmlAppBlocksEnabled
        ? ` For html-app blocks, pass statefulBlock.blockInstanceId to ${KnownBlockDocumentTools.embedded_html_app_agent} as appId. For a new worksheet HTML app, use ${KnownBlockDocumentTools.add_html_app_block} first.`
        : ''
    }`,
  });

  const moveBlockTool = createMoveBlockDocumentBlockTool({
    blockDocumentAdapter,
    blockDocumentId,
  });

  const additionalTools =
    extraTools?.({
      blockDocumentId,
      blockDocumentAdapter,
      databaseAdapter,
    }) ?? {};

  if (
    htmlAppBlocksEnabled &&
    !additionalTools[KnownBlockDocumentTools.embedded_html_app_agent]
  ) {
    throw new Error(
      `${KnownBlockDocumentTools.add_html_app_block} requires ${KnownBlockDocumentTools.embedded_html_app_agent} in extraTools when htmlAppBlocksEnabled is true.`,
    );
  }

  const builtInTools: Record<string, Tool> = {
    ...chartTools,
    [KnownBlockDocumentTools.list_blocks]: listBlocksTool,
    [KnownBlockDocumentTools.move_block]: moveBlockTool,
    [KnownBlockDocumentTools.add_text_block]: addTextBlockTool,
    [KnownBlockDocumentTools.add_dashboard_block]: addDashboardBlockTool,
    [KnownBlockDocumentTools.add_data_table_explorer]: addDataTableExplorerTool,
    [KnownBlockDocumentTools.embedded_dashboard_agent]: dashboardAgentTool,
    ...(htmlAppBlocksEnabled
      ? {
          [KnownBlockDocumentTools.add_html_app_block]:
            createAddHtmlAppBlockDocumentBlockTool({
              blockDocumentAdapter,
              blockDocumentId,
              addHtmlAppBlock: addHtmlAppBlock
                ? (params) => addHtmlAppBlock({blockDocumentId, ...params})
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
