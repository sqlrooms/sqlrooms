import {z} from 'zod';

// Chart settings schemas
export const HistogramChartSettings = z.object({
  field: z.string().optional(),
});
export type HistogramChartSettings = z.infer<typeof HistogramChartSettings>;

export const CountPlotChartSettings = z.object({
  field: z.string().optional(),
});
export type CountPlotChartSettings = z.infer<typeof CountPlotChartSettings>;

export const EcdfChartSettings = z.object({
  field: z.string().optional(),
});
export type EcdfChartSettings = z.infer<typeof EcdfChartSettings>;

export const LineChartSettings = z.object({
  x: z.string().optional(),
  y: z.string().optional(),
});
export type LineChartSettings = z.infer<typeof LineChartSettings>;

export const BubbleChartSettings = z.object({
  x: z.string().optional(),
  y: z.string().optional(),
});
export type BubbleChartSettings = z.infer<typeof BubbleChartSettings>;

export const HeatmapChartSettings = z.object({
  x: z.string().optional(),
  y: z.string().optional(),
});
export type HeatmapChartSettings = z.infer<typeof HeatmapChartSettings>;

export const BoxPlotChartSettings = z.object({
  x: z.string().optional(),
  y: z.string().optional(),
});
export type BoxPlotChartSettings = z.infer<typeof BoxPlotChartSettings>;

export const CustomSpecChartSettings = z.record(z.string(), z.unknown());
export type CustomSpecChartSettings = z.infer<typeof CustomSpecChartSettings>;

// Chart type-specific config schemas
export const HistogramChartConfig = z.object({
  chartType: z.literal('histogram'),
  settings: HistogramChartSettings,
  vgplot: z.unknown(),
  settingsOpen: z.boolean().optional(),
});
export type HistogramChartConfig = z.infer<typeof HistogramChartConfig>;

export const CountPlotChartConfig = z.object({
  chartType: z.literal('count-plot'),
  settings: CountPlotChartSettings,
  vgplot: z.unknown(),
  settingsOpen: z.boolean().optional(),
});
export type CountPlotChartConfig = z.infer<typeof CountPlotChartConfig>;

export const EcdfChartConfig = z.object({
  chartType: z.literal('ecdf'),
  settings: EcdfChartSettings,
  vgplot: z.unknown(),
  settingsOpen: z.boolean().optional(),
});
export type EcdfChartConfig = z.infer<typeof EcdfChartConfig>;

export const LineChartConfig = z.object({
  chartType: z.literal('line-chart'),
  settings: LineChartSettings,
  vgplot: z.unknown(),
  settingsOpen: z.boolean().optional(),
});
export type LineChartConfig = z.infer<typeof LineChartConfig>;

export const BubbleChartConfig = z.object({
  chartType: z.literal('bubble-chart'),
  settings: BubbleChartSettings,
  vgplot: z.unknown(),
  settingsOpen: z.boolean().optional(),
});
export type BubbleChartConfig = z.infer<typeof BubbleChartConfig>;

export const HeatmapChartConfig = z.object({
  chartType: z.literal('heatmap'),
  settings: HeatmapChartSettings,
  vgplot: z.unknown(),
  settingsOpen: z.boolean().optional(),
});
export type HeatmapChartConfig = z.infer<typeof HeatmapChartConfig>;

export const BoxPlotChartConfig = z.object({
  chartType: z.literal('box-plot'),
  settings: BoxPlotChartSettings,
  vgplot: z.unknown(),
  settingsOpen: z.boolean().optional(),
});
export type BoxPlotChartConfig = z.infer<typeof BoxPlotChartConfig>;

export const CustomSpecChartConfig = z.object({
  chartType: z.literal('custom-spec'),
  vgplot: z.unknown(),
  settingsOpen: z.boolean().optional(),
  settings: CustomSpecChartSettings,
});
export type CustomSpecChartConfig = z.infer<typeof CustomSpecChartConfig>;

// Discriminated union of all chart configs
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
