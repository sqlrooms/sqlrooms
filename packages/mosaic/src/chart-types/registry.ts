import type {ChartTypeDefinition} from './base-types';
import {histogramChartType} from './histogram/definition';
import {lineChartChartType} from './line-chart/definition';
import {countPlotChartType} from './count-plot/definition';
import {ecdfChartType} from './ecdf/definition';
import {heatmapChartType} from './heatmap/definition';
import {boxPlotChartType} from './box-plot/definition';
import {bubbleChartChartType} from './bubble-chart/definition';
import {customSpecChartType} from './custom-spec/definition';

const chartTypeRegistry = new Map<string, ChartTypeDefinition>();

// Register all chart types immediately
// This is safe now because we've eliminated circular dependencies
// by making all imports direct (not through barrel exports)
registerChartType(histogramChartType);
registerChartType(lineChartChartType);
registerChartType(countPlotChartType);
registerChartType(ecdfChartType);
registerChartType(heatmapChartType);
registerChartType(boxPlotChartType);
registerChartType(bubbleChartChartType);
registerChartType(customSpecChartType);

export function registerChartType(definition: ChartTypeDefinition) {
  chartTypeRegistry.set(definition.id, definition);
}

export function getChartTypeDefinition(
  id: string,
): ChartTypeDefinition | undefined {
  return chartTypeRegistry.get(id);
}

export function getAllChartTypes(): ChartTypeDefinition[] {
  return Array.from(chartTypeRegistry.values());
}
