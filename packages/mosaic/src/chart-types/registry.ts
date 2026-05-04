import type {ChartTypeDefinition} from '../chart-builders/types';
import {histogramChartType} from './histogram';
import {lineChartChartType} from './line-chart';
import {countPlotChartType} from './count-plot';
import {ecdfChartType} from './ecdf';
import {heatmapChartType} from './heatmap';
import {boxPlotChartType} from './box-plot';
import {bubbleChartChartType} from './bubble-chart';
import {customSpecChartType} from './custom-spec';

const chartTypeRegistry = new Map<string, ChartTypeDefinition>();

// Register all chart types
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
