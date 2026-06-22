import type {Tool} from 'ai';
import {ensureNoOverride} from '../tool-helpers';

import {DatabaseAiAdapter} from '../database-types';
import {ChartToolsOptions} from '../types';
import {
  ExtraWorksheetAiToolsFactory,
  WorksheetAiAdapter,
} from './worksheet-types';
import {createWorksheetChartTools} from './createWorksheetChartTools';
import {createAddTextBlockTool} from './createAddTextBlockTool';
import {createAddDashboardBlockTool} from './createAddDashboardBlockTool';
import {createAddHtmlAppBlockTool} from './createAddHtmlAppBlockTool';
import {KnownWorksheetTools} from './constants';
import {createWorksheetDataTableExplorerTool} from './createWorksheetDataTableExplorerTool';
import {createListWorksheetBlocksTool} from './createListWorksheetBlocksTool';

/**
 * Options for creating worksheet AI tools.
 * Provides all necessary adapters, configuration, and context for worksheet tool creation.
 */
export type CreateWorksheetAiToolsOptions = {
  /** Database adapter for table validation and queries */
  databaseAdapter: DatabaseAiAdapter;
  /** Worksheet adapter for adding blocks to worksheets */
  worksheetAdapter: WorksheetAiAdapter;
  /** Dashboard agent tool for embedded dashboard creation */
  dashboardAgentTool: Tool;
  /** Optional chart configuration and type restrictions */
  chartToolsOptions?: ChartToolsOptions;
  /** ID of the worksheet where tools will add blocks */
  worksheetId: string;
  /** Optional factory for additional custom tools */
  extraTools?: ExtraWorksheetAiToolsFactory;
  /**
   * Whether to expose built-in HTML app block tools. Defaults to `true` for
   * existing integrations. Set to `false` when HTML app blocks are feature
   * gated or unsupported by the host application.
   */
  htmlAppBlocksEnabled?: boolean;
};

/**
 * Creates a collection of AI tools for building worksheets.
 * Returns tools for creating charts, text blocks, dashboard blocks, and data table explorers.
 *
 * @param options - Configuration options for worksheet tools
 * @returns Record mapping tool names to tool instances
 */
export function createWorksheetAiTools({
  worksheetAdapter,
  databaseAdapter,
  chartToolsOptions,
  worksheetId,
  dashboardAgentTool,
  extraTools,
  htmlAppBlocksEnabled = true,
}: CreateWorksheetAiToolsOptions): Record<string, Tool> {
  const chartTools = createWorksheetChartTools({
    databaseAdapter,
    worksheetAdapter,
    chartToolsOptions,
    worksheetId,
  });

  const addTextBlockTool = createAddTextBlockTool({
    worksheetAdapter,
    worksheetId,
  });

  const addDashboardBlockTool = createAddDashboardBlockTool({
    worksheetAdapter,
    worksheetId,
  });

  const addDataTableExplorerTool = createWorksheetDataTableExplorerTool({
    databaseAdapter,
    worksheetAdapter,
    worksheetId,
  });

  const listWorksheetBlocksTool = createListWorksheetBlocksTool({
    worksheetAdapter,
    worksheetId,
    htmlAppBlocksEnabled,
  });

  const builtInTools: Record<string, Tool> = {
    ...chartTools,
    [KnownWorksheetTools.list_blocks]: listWorksheetBlocksTool,
    [KnownWorksheetTools.add_text_block]: addTextBlockTool,
    [KnownWorksheetTools.add_dashboard_block]: addDashboardBlockTool,
    [KnownWorksheetTools.add_data_table_explorer]: addDataTableExplorerTool,
    [KnownWorksheetTools.embedded_dashboard_agent]: dashboardAgentTool,
    ...(htmlAppBlocksEnabled
      ? {
          [KnownWorksheetTools.add_html_app_block]: createAddHtmlAppBlockTool({
            worksheetAdapter,
            worksheetId,
          }),
        }
      : {}),
  };

  const additionalTools =
    extraTools?.({
      worksheetId,
      worksheetAdapter,
      databaseAdapter,
    }) ?? {};

  ensureNoOverride(builtInTools, additionalTools);

  return {
    ...builtInTools,
    ...additionalTools,
  };
}
