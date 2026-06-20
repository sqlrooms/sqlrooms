import type {Tool} from 'ai';
import type {ChartTypeDefinition} from './base-types';
import type {ChartToolParams} from './tool-types';
import {getChartToolName} from './utils';

/**
 * Dynamically generate chart configuration tools from chart type definitions.
 *
 * @param chartTypes - Array of chart type definitions
 * @param params - Chart tool parameters containing addChart function, maxDataPoints limit, and databaseAdapter for table/column resolution
 * @param toolNamePrefix - Required prefix for generated tool names (e.g., 'create_dashboard_' or 'create_worksheet_block_')
 * @returns Record mapping tool names to tool instances
 *
 * @example
 * const chartTypes = resolveChartTypes();
 * const params: ChartToolParams = {
 *   addChart: (chartParams) => dashboardAdapter.addPanel(chartParams),
 *   maxDataPoints: 10000,
 *   databaseAdapter: myDatabaseAdapter
 * };
 * const tools = createChartTools(chartTypes, params, 'create_dashboard_');
 * // Returns: { create_dashboard_histogram: Tool, create_dashboard_line_chart: Tool, ... }
 */
export function createChartTools(
  chartTypes: ChartTypeDefinition<any>[],
  params: ChartToolParams,
  toolNamePrefix: string,
): Record<string, Tool> {
  const tools: Record<string, Tool> = {};

  for (const chartType of chartTypes) {
    if (chartType.createTool) {
      const toolName = getChartToolName(chartType, toolNamePrefix);
      tools[toolName] = chartType.createTool(params);
    }
  }

  return tools;
}
