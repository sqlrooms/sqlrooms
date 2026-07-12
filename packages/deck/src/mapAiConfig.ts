import {z} from 'zod';

const DeckMapDatasetSource = z.looseObject({
  tableName: z.string().optional(),
  transformSql: z.string().optional(),
  sqlQuery: z.string().optional(),
});
const DeckMapDatasetConfig = z.looseObject({
  source: DeckMapDatasetSource.optional(),
  geometryColumn: z.string().optional(),
  geometryEncodingHint: z.enum(['geoarrow', 'wkb', 'wkt']).optional(),
});

export const DeckMapResourceConfigParameter = z.looseObject({
  spec: z.union([z.string(), z.record(z.string(), z.unknown())]),
  datasets: z.record(z.string(), DeckMapDatasetConfig),
  configMode: z.enum(['basic', 'custom']).optional(),
  mapStyle: z.string().optional(),
  mapProps: z.record(z.string(), z.unknown()).optional(),
  showLegends: z.boolean().optional(),
  interaction: z.record(z.string(), z.unknown()).optional(),
  fitToData: z.record(z.string(), z.unknown()).optional(),
  dataPolicy: z
    .looseObject({
      disabled: z.boolean().optional(),
      maxRows: z.number().int().min(1).optional(),
      reason: z.string().optional(),
    })
    .optional(),
  settingsOpen: z.boolean().optional(),
});

export const DeckMapResourceToolParameters = z.object({
  title: z.string().optional().default('Map'),
  config: DeckMapResourceConfigParameter,
  tableName: z.string().optional(),
  reasoning: z.string(),
});
