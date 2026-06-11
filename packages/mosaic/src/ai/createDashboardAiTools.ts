import type {Tool} from 'ai';
import {
  createChartTools,
  createDefaultChartTypes,
  createListPanelsTool,
  createDataTableExplorerTool,
  createRemovePanelTool,
} from '../charts/chart-types';
import {createDashboardToolDeps} from './createDashboardToolDeps';
import {createDashboardArtifactTool} from './create-dashboard-artifact-tool';
import type {CreateDashboardAiToolsOptions} from './types';

export function createDashboardAiTools<TState>({
  store,
  adapter,
  chartTypes,
  extraTools,
}: CreateDashboardAiToolsOptions<TState>): Record<string, Tool> {
  const deps = createDashboardToolDeps({store, adapter});
  const resolvedChartTypes =
    chartTypes ?? createDefaultChartTypes({includeCustomSpec: false});
  const chartTools = createChartTools(resolvedChartTypes, deps);
  const hostTools = extraTools?.(deps) ?? {};

  const builtInTools = {
    create_dashboard_artifact: createDashboardArtifactTool(store, adapter),
    ...chartTools,
    create_dashboard_data_table_explorer: createDataTableExplorerTool(deps),
    list_dashboard_panels: createListPanelsTool(deps),
    remove_dashboard_panel: createRemovePanelTool(deps),
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
