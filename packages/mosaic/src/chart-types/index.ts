// Re-export base types
export * from './base-types';

// Re-export all schemas and types
export * from './histogram';
export * from './line-chart';
export * from './count-plot';
export * from './ecdf';
export * from './heatmap';
export * from './bubble-chart';
export * from './custom-spec';
export * from './registry';

// Import chart type definitions for legacy exports
import {histogramChartType} from './histogram';
import {lineChartChartType} from './line-chart';
import {countPlotChartType} from './count-plot';
import {ecdfChartType} from './ecdf';
import {heatmapChartType} from './heatmap';
import {bubbleChartChartType} from './bubble-chart';
import {customSpecChartType} from './custom-spec';

// Import Zod configs for discriminated union
import {HistogramChartConfig as HistogramChartConfigSchema} from './histogram';
import {CountPlotChartConfig as CountPlotChartConfigSchema} from './count-plot';
import {EcdfChartConfig as EcdfChartConfigSchema} from './ecdf';
import {LineChartConfig as LineChartConfigSchema} from './line-chart';
import {BubbleChartConfig as BubbleChartConfigSchema} from './bubble-chart';
import {HeatmapChartConfig as HeatmapChartConfigSchema} from './heatmap';
import {CustomSpecChartConfig as CustomSpecChartConfigSchema} from './custom-spec';
import {z} from 'zod';

// Zod schema for VgPlotChartConfig (discriminated union)
export const VgPlotChartConfig = z.discriminatedUnion('chartType', [
  HistogramChartConfigSchema,
  CountPlotChartConfigSchema,
  EcdfChartConfigSchema,
  LineChartConfigSchema,
  BubbleChartConfigSchema,
  HeatmapChartConfigSchema,
  CustomSpecChartConfigSchema,
]);

export type VgPlotChartConfig = z.infer<typeof VgPlotChartConfig>;
export type VgPlotChartSettings = VgPlotChartConfig['settings'];

// Legacy compatibility exports
export const mosaicChartTypes = {
  histogram: histogramChartType,
  countPlot: countPlotChartType,
  lineChart: lineChartChartType,
  ecdf: ecdfChartType,
  heatmap: heatmapChartType,
  bubbleChart: bubbleChartChartType,
  customSpec: customSpecChartType,
} as const;

export function createDefaultChartTypes(options?: {
  includeCustomSpec?: boolean;
}) {
  const includeCustomSpec = options?.includeCustomSpec ?? true;
  const chartTypes = [
    histogramChartType,
    countPlotChartType,
    lineChartChartType,
    ecdfChartType,
    heatmapChartType,
    bubbleChartChartType,
  ];

  if (includeCustomSpec) {
    chartTypes.push(customSpecChartType);
  }

  return chartTypes;
}
