import type {Tool} from 'ai';
import {
  createChartTools,
  createDefaultChartTypes,
  createListPanelsTool,
  createDataTableExplorerTool,
  createRemovePanelTool,
} from '../charts/chart-types';
import {createDashboardToolDeps} from './createDashboardToolDeps';
import {createChartToolDeps} from './createChartToolDeps';
import {createDashboardArtifactTool} from './create-dashboard-artifact-tool';
import type {CreateDashboardAiToolsOptions} from './types';

export function createDashboardAiTools({
  adapter,
  chartTypes,
  extraTools,
}: CreateDashboardAiToolsOptions): Record<string, Tool> {
  const dashboardToolDeps = createDashboardToolDeps(adapter);
  const chartToolDeps = createChartToolDeps({
    adapter,
    addChart: ({tableName, config}) => {
      const dashboardId = dashboardToolDeps.resolveArtifact(undefined, true);
      return dashboardToolDeps.addPanel(dashboardId, {
        type: 'chart',
        tableName,
        config,
      });
    },
  });

  const resolvedChartTypes =
    chartTypes ?? createDefaultChartTypes({includeCustomSpec: false});
  const chartTools = createChartTools(resolvedChartTypes, chartToolDeps);
  const hostTools = extraTools?.(dashboardToolDeps) ?? {};

  const builtInTools = {
    create_dashboard_artifact: createDashboardArtifactTool(adapter),
    ...chartTools,
    create_dashboard_data_table_explorer:
      createDataTableExplorerTool(dashboardToolDeps),
    list_dashboard_panels: createListPanelsTool(dashboardToolDeps),
    remove_dashboard_panel: createRemovePanelTool(dashboardToolDeps),
  };

  for (const key of Object.keys(hostTools)) {
    if (key in builtInTools) {
      throw new Error(
        `Dashboard extraTools cannot override built-in tool "${key}". Register the host tool under a unique key.`,
      );
    }
  }

  return {
    ...builtInTools,
    ...hostTools,
  };
}
