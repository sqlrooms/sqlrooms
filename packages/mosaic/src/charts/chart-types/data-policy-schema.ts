import {z} from 'zod';

export const ChartDataPolicyOverrideConfig = z.object({
  disabled: z.boolean().optional(),
  maxRows: z.number().int().min(1).optional(),
  reason: z.string().optional(),
});

export type ChartDataPolicyOverrideConfig = z.infer<
  typeof ChartDataPolicyOverrideConfig
>;
