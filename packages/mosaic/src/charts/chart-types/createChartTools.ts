import type {Tool} from 'ai';
import type {ChartTypeDefinition, DashboardToolDeps} from './base-types';

/**
 * Dynamically generate AI tools from chart type definitions.
 *
 * @param chartTypes Array of chart type definitions
 * @param deps Dependencies needed by tool creators (resolveArtifact, resolveTable, addPanel, etc.)
 * @param toolNamePrefix Prefix for generated tool names (default: 'create_dashboard_')
 * @returns Record mapping tool names to tool instances
 *
 * @example
 * const chartTypes = createDefaultChartTypes({includeCustomSpec: false});
 * const tools = createChartTools(chartTypes, deps);
 * // Returns: { create_dashboard_histogram: ..., create_dashboard_line_chart: ..., ... }
 */
export function createChartTools(
  chartTypes: ChartTypeDefinition<any>[],
  deps: DashboardToolDeps,
  toolNamePrefix: string = 'create_dashboard_',
): Record<string, Tool> {
  const tools: Record<string, Tool> = {};

  for (const chartType of chartTypes) {
    if (chartType.createTool) {
      const toolName = `${toolNamePrefix}${chartType.id.replace(/-/g, '_')}`;
      tools[toolName] = chartType.createTool(deps);
    }
  }

  return tools;
}
