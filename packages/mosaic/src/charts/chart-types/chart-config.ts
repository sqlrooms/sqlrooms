/**
 * Central ChartConfig discriminated union.
 * Separated from index.ts to avoid circular dependencies with Settings components.
 */

import {z} from 'zod';

// Import only the Zod schemas (no Settings components)
import {HistogramChartConfig} from './histogram/schema';
import {CountPlotChartConfig} from './count-plot/schema';
import {LineChartConfig} from './line-chart/schema';
import {BubbleChartConfig} from './bubble-chart/schema';
import {HeatmapChartConfig} from './heatmap/schema';
import {BoxPlotChartConfig} from './box-plot/schema';
import {CustomSpecChartConfig} from './custom-spec/schema';
import {ChartDataPolicyOverrideConfig} from './data-policy-schema';

export const CustomChartSettings = z.record(z.string(), z.unknown());

export type CustomChartSettings = z.infer<typeof CustomChartSettings>;

const KNOWN_CHART_CONFIGS = [
  HistogramChartConfig,
  CountPlotChartConfig,
  LineChartConfig,
  BubbleChartConfig,
  HeatmapChartConfig,
  BoxPlotChartConfig,
  CustomSpecChartConfig,
] as const;

const KNOWN_CHART_TYPES: string[] = KNOWN_CHART_CONFIGS.map(
  (config) => config.shape.chartType.value,
);

export const CustomChartConfig = z.object({
  chartType: z.string().refine((val) => !KNOWN_CHART_TYPES.includes(val), {
    message: 'Custom chart type cannot use reserved chart type names',
  }),
  settings: CustomChartSettings,
  settingsOpen: z.boolean().optional(),
  dataPolicy: ChartDataPolicyOverrideConfig.optional(),
});

export type CustomChartConfig = z.infer<typeof CustomChartConfig>;

/**
 * Discriminated union of all chart configuration types.
 * This schema is used for runtime validation and type inference.
 */
export const ChartConfig = z
  .discriminatedUnion('chartType', KNOWN_CHART_CONFIGS)
  .or(CustomChartConfig);

export type ChartConfig = z.infer<typeof ChartConfig>;

export type ChartSettings = ChartConfig['settings'];
export type ChartType = ChartConfig['chartType'];
