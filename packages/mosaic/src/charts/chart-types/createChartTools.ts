import type {Tool} from 'ai';
import type {ChartTypeDefinition} from './base-types';
import type {ChartToolParams} from './tool-types';
import {getChartToolName} from './utils';

/**
 * Dynamically generate chart configuration tools from chart type definitions.
 *
 * Chart tools generate ChartConfig objects using findTableByName for validation.
 *
 * @param chartTypes Array of chart type definitions
 * @param params Chart tool dependencies (findTableByName + maxDataPoints)
 * @param toolNamePrefix Prefix for generated tool names (default: 'create_dashboard_')
 * @returns Record mapping tool names to tool instances
 *
 * @example
 * const chartTypes = createDefaultChartTypes({includeCustomSpec: false});
 * const deps = {
 *   findTableByName: (name) => tables.find(t => t.tableName === name) || throw...,
 *   maxDataPoints: 10000
 * };
 * const tools = createChartTools(chartTypes, deps);
 * // Returns: { create_dashboard_histogram: ..., create_dashboard_line_chart: ..., ... }
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
