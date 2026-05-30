// Re-export base types
export * from './base-types';

// Import Tool type for createChartTools function
import type {Tool} from 'ai';

// Re-export error classes for chart definitions
export * from './errors';

// Import specific types needed before re-exports
import type {ChartTypeDefinition} from './base-types';

// CRITICAL: Export ChartConfig FIRST, before importing Settings components
// Export ChartConfig from separate file to avoid circular dependencies
// (chart-types/index imports Settings components, which import ChartSettingsContext,
// which imports ChartConfig)
export {ChartConfig, type ChartSettings, type ChartType} from './chart-config';
export * from './data-policy-schema';

// Re-export schemas
export * from './histogram/schema';
export * from './line-chart/schema';
export * from './count-plot/schema';
export * from './heatmap/schema';
export * from './box-plot/schema';
export * from './bubble-chart/schema';
export * from './custom-spec/schema';

// Re-export Settings components
export {HistogramSettingsComponent} from './histogram/HistogramSettings';
export {LineChartSettingsComponent} from './line-chart/LineChartSettings';
export {CountPlotSettingsComponent} from './count-plot/CountPlotSettings';
export {HeatmapSettingsComponent} from './heatmap/HeatmapSettings';
export {BoxPlotSettingsComponent} from './box-plot/BoxPlotSettings';
export {BubbleChartSettingsComponent} from './bubble-chart/BubbleChartSettings';
export {CustomSpecSettingsComponent} from './custom-spec/CustomSpecSettings';

// Re-export definitions
export * from './histogram/definition';
export * from './line-chart/definition';
export * from './count-plot/definition';
export * from './heatmap/definition';
export * from './box-plot/definition';
export * from './bubble-chart/definition';
export * from './custom-spec/definition';

// Re-export tool types, schemas, validation, helpers, and AI tool creators
export * from './tool-types';
export * from './tool-schemas';
export * from './tool-validation';
export * from './tool-helpers';
export * from './histogram/tool';
export * from './line-chart/tool';
export * from './count-plot/tool';
export * from './heatmap/tool';
export * from './bubble-chart/tool';
export * from './box-plot/tool';
export * from './data-table-explorer-tool';
export * from './text-panel-tool';
export * from './list-panels-tool';
export * from './remove-panel-tool';

// Import chart type definitions for legacy exports
import {histogramChartType} from './histogram/definition';
import {lineChartChartType} from './line-chart/definition';
import {countPlotChartType} from './count-plot/definition';
import {heatmapChartType} from './heatmap/definition';
import {boxPlotChartType} from './box-plot/definition';
import {bubbleChartChartType} from './bubble-chart/definition';
import {customSpecChartType} from './custom-spec/definition';
import type {DashboardToolDeps} from './base-types';

// Legacy compatibility exports
export const mosaicChartTypes = {
  histogram: histogramChartType,
  countPlot: countPlotChartType,
  lineChart: lineChartChartType,
  heatmap: heatmapChartType,
  boxPlot: boxPlotChartType,
  bubbleChart: bubbleChartChartType,
  customSpec: customSpecChartType,
} as const;

export function createDefaultChartTypes(options?: {
  includeCustomSpec?: boolean;
}): ChartTypeDefinition<any>[] {
  const includeCustomSpec = options?.includeCustomSpec ?? true;
  const chartTypes: ChartTypeDefinition<any>[] = [
    histogramChartType,
    countPlotChartType,
    lineChartChartType,
    heatmapChartType,
    boxPlotChartType,
    bubbleChartChartType,
  ];

  if (includeCustomSpec) {
    chartTypes.push(customSpecChartType as ChartTypeDefinition<any>);
  }

  return chartTypes;
}

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
