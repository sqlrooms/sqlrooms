import type {Tool} from 'ai';
import {ensureNoOverride} from '../tool-helpers';

import {
  DashboardAiAdapter,
  ExtraDashboardAiToolsFactory,
} from './dashboard-types';
import {createDashboardChartTools} from './createDashboardChartTools';
import {createDashboardDataTableExplorerTool} from './createDashboardDataTableExplorerTool';
import {DatabaseAiAdapter} from '../database-types';
import {ChartToolsOptions} from '../types';
import {KnownDashboardTools} from './constants';

/**
 * Options for creating dashboard AI tools.
 *
 * @property databaseAdapter - Adapter for database operations and table queries
 * @property dashboardAdapter - Adapter for dashboard-specific operations like adding panels
 * @property chartToolsOptions - Optional configuration for chart tool behavior
 * @property extraTools - Optional factory function for registering additional custom tools
 */
export type CreateDashboardAiToolsOptions = {
  databaseAdapter: DatabaseAiAdapter;
  dashboardAdapter: DashboardAiAdapter;
  chartToolsOptions?: ChartToolsOptions;
  extraTools?: ExtraDashboardAiToolsFactory;
};

/**
 * Creates the complete set of AI tools for dashboard operations, including chart tools and data table explorer.
 *
 * @param options - Configuration options for creating dashboard tools
 * @returns Record of tool names to Tool instances, including built-in and any extra tools
 */
export function createDashboardAiTools({
  dashboardAdapter,
  databaseAdapter,
  chartToolsOptions,
  extraTools,
}: CreateDashboardAiToolsOptions): Record<string, Tool> {
  const chartTools = createDashboardChartTools({
    databaseAdapter,
    dashboardAdapter,
    chartToolsOptions,
  });

  const dataTableExplorerTool = createDashboardDataTableExplorerTool({
    databaseAdapter,
    dashboardAdapter,
  });

  const builtInTools: Record<string, Tool> = {
    ...chartTools,
    [KnownDashboardTools.create_dashboard_panel_data_table_explorer]:
      dataTableExplorerTool,
  };

  const additionalTools =
    extraTools?.({
      databaseAdapter,
      dashboardAdapter,
    }) ?? {};

  ensureNoOverride(builtInTools, additionalTools);

  return {
    ...builtInTools,
    ...additionalTools,
  };
}
