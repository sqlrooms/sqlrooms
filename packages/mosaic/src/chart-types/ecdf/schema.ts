import {z} from 'zod';

export const EcdfChartSettings = z.object({
  field: z
    .string()
    .optional()
    .describe('Numeric column for empirical cumulative distribution function'),
});

export type EcdfChartSettings = z.infer<typeof EcdfChartSettings>;

// For AI-generated charts, we want to require all settings to ensure a complete spec can be generated
export const EcdfAiChartSettings = EcdfChartSettings.required();
export type EcdfAiChartSettings = z.infer<typeof EcdfAiChartSettings>;

export const EcdfChartConfig = z.object({
  chartType: z.literal('ecdf'),
  settings: EcdfChartSettings,
  settingsOpen: z.boolean().optional(),
});

export type EcdfChartConfig = z.infer<typeof EcdfChartConfig>;
