import type {Tool} from 'ai';
import {ChartTypeDefinition, ensureNoOverride} from '../../charts/chart-types';

import {DashboardAiAdapter} from '../types';
import {createDashboardChartTools} from './createDashboardChartTools';
import {createDashboardDataTableExplorerTool} from './createDashboardDataTableExplorerTool';

export type CreateDashboardAiToolsOptions = {
  adapter: DashboardAiAdapter;
  dashboardId?: string;
  chartTypes?: ChartTypeDefinition<any>[];
  extraTools?: (adapter: DashboardAiAdapter) => Record<string, Tool>;
};

export function createDashboardAiTools({
  adapter,
  chartTypes,
  extraTools,
}: CreateDashboardAiToolsOptions): Record<string, Tool> {
  const chartTools = createDashboardChartTools(adapter, chartTypes);
  const dataTableExplorerTool = createDashboardDataTableExplorerTool(adapter);

  const hostTools = extraTools?.(adapter) ?? {};

  const builtInTools: Record<string, Tool> = {
    ...chartTools,
    create_dashboard_data_table_explorer: dataTableExplorerTool,
    // create_dashboard_artifact: createDashboardArtifactTool(adapter),
    // list_dashboard_panels: createListPanelsTool(dashboardToolDeps),
    // remove_dashboard_panel: createRemovePanelTool(dashboardToolDeps),
  };

  ensureNoOverride(builtInTools, hostTools);

  return {
    ...builtInTools,
    ...hostTools,
  };
}
