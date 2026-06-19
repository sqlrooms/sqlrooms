import type {Tool} from 'ai';
import {ensureNoOverride} from '../../charts/chart-types';

import {
  DashboardAiAdapter,
  ExtraDashboardAiToolsFactory,
} from './dashboard-types';
import {createDashboardChartTools} from './createDashboardChartTools';
import {createDashboardDataTableExplorerTool} from './createDashboardDataTableExplorerTool';
import {DatabaseAiAdapter} from '../database-types';
import {ChartToolsOptions} from '../types';
import {KnownDashboardTools} from './constants';

export type CreateDashboardAiToolsOptions = {
  databaseAdapter: DatabaseAiAdapter;
  dashboardAdapter: DashboardAiAdapter;
  chartToolsOptions?: ChartToolsOptions;
  extraTools?: ExtraDashboardAiToolsFactory;
};

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
