import {z} from 'zod';

export const VgPlotSpec = z
  .intersection(
    z.object({
      style: z.record(z.unknown()).optional(),
    }),
    z.record(z.unknown()),
  )
  .describe(
    'Mosaic vgplot specification for a chart. See https://uwdata.github.io/mosaic/vgplot/',
  );
export type VgPlotSpec = z.infer<typeof VgPlotSpec>;

export const VgPlotChartConfig = z.object({
  // id: z.string(),
  type: z.literal('vgplot').describe('Chart type.'),
  title: z.string().optional().describe('Chart title.'),
  description: z.string().optional().describe('Chart description.'),
  spec: VgPlotSpec.describe(VgPlotSpec._def.description ?? 'Chart spec.'),
});
export type VgPlotChartConfig = z.infer<typeof VgPlotChartConfig>;
