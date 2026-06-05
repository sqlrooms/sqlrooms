import type {ChartTypeDefinition} from './base-types';
import {histogramChartType} from './histogram/definition';
import {lineChartChartType} from './line-chart/definition';
import {countPlotChartType} from './count-plot/definition';
import {heatmapChartType} from './heatmap/definition';
import {boxPlotChartType} from './box-plot/definition';
import {bubbleChartChartType} from './bubble-chart/definition';
import {customSpecChartType} from './custom-spec/definition';

/**
 * Creates the default set of chart type definitions.
 *
 * @param options - Configuration options
 * @param options.includeCustomSpec - Whether to include the custom spec chart type (default: true)
 * @returns Array of chart type definitions
 */
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
