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
import {KnownWorksheetTools} from './constants';
import {createWorksheetDataTableExplorerTool} from './createWorksheetDataTableExplorerTool';

export type CreateWorksheetAiToolsOptions = {
  databaseAdapter: DatabaseAiAdapter;
  worksheetAdapter: WorksheetAiAdapter;
  dashboardAgentTool: Tool;
  chartToolsOptions?: ChartToolsOptions;
  worksheetId: string;
  extraTools?: ExtraWorksheetAiToolsFactory;
};

export function createWorksheetAiTools({
  worksheetAdapter,
  databaseAdapter,
  chartToolsOptions,
  worksheetId,
  dashboardAgentTool,
  extraTools,
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

  const builtInTools: Record<string, Tool> = {
    ...chartTools,
    [KnownWorksheetTools.add_text_block]: addTextBlockTool,
    [KnownWorksheetTools.add_dashboard_block]: addDashboardBlockTool,
    [KnownWorksheetTools.add_data_table_explorer]: addDataTableExplorerTool,
    [KnownWorksheetTools.embedded_dashboard_agent]: dashboardAgentTool,
  };

  const additionalTools =
    extraTools?.({
      worksheetAdapter,
      databaseAdapter,
    }) ?? {};

  ensureNoOverride(builtInTools, additionalTools);

  return {
    ...builtInTools,
    ...additionalTools,
  };
}
