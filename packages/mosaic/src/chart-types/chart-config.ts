/**
 * Central VgPlotChartConfig discriminated union.
 * Separated from index.ts to avoid circular dependencies with Settings components.
 */

import {z} from 'zod';

// Import only the Zod schemas (no Settings components)
import {HistogramChartConfig} from './histogram/schema';
import {CountPlotChartConfig} from './count-plot/schema';
import {EcdfChartConfig} from './ecdf/schema';
import {LineChartConfig} from './line-chart/schema';
import {BubbleChartConfig} from './bubble-chart/schema';
import {HeatmapChartConfig} from './heatmap/schema';
import {BoxPlotChartConfig} from './box-plot/schema';
import {CustomSpecChartConfig} from './custom-spec/schema';

/**
 * Discriminated union of all chart configuration types.
 * This schema is used for runtime validation and type inference.
 */
export const VgPlotChartConfig = z.discriminatedUnion('chartType', [
  HistogramChartConfig,
  CountPlotChartConfig,
  EcdfChartConfig,
  LineChartConfig,
  BubbleChartConfig,
  HeatmapChartConfig,
  BoxPlotChartConfig,
  CustomSpecChartConfig,
]);

export type VgPlotChartConfig = z.infer<typeof VgPlotChartConfig>;
export type VgPlotChartSettings = VgPlotChartConfig['settings'];
export type VgPlotChartType = VgPlotChartConfig['chartType'];
