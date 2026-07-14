import {z} from 'zod';
import type {DeckMapConfig} from './mapConfig';

const DeckMapDatasetSource = z.union([
  z.looseObject({
    sqlQuery: z.string(),
  }),
  z.looseObject({
    tableName: z.string(),
    transformSql: z.string().optional(),
  }),
]);
const DeckMapDatasetConfig = z.looseObject({
  source: DeckMapDatasetSource.optional().describe(
    'Dataset source. Required for new maps; may be omitted only by a sparse update patch that retains an existing source.',
  ),
  geometryColumn: z.string().optional(),
  geometryEncodingHint: z.enum(['geoarrow', 'wkb', 'wkt']).optional(),
});

const DeckMapInteractionConfig = z.looseObject({
  type: z.literal('point-radius-brush'),
  dataset: z.string(),
  longitudeColumn: z.string(),
  latitudeColumn: z.string(),
  radiusMeters: z.number().optional(),
  event: z.enum(['hover', 'click']).optional(),
});

const DeckMapFitToDataConfig = z.looseObject({
  dataset: z.string(),
  longitudeColumn: z.string().optional(),
  latitudeColumn: z.string().optional(),
  geometryColumn: z.string().optional(),
  h3Column: z.string().optional(),
  padding: z.number().optional(),
  maxZoom: z.number().optional(),
});

/** Validates the portable Deck map config accepted from commands and AI tools. */
export const DeckMapResourceConfigParameter = z.looseObject({
  spec: z.union([z.string(), z.record(z.string(), z.unknown())]),
  datasets: z
    .record(z.string(), DeckMapDatasetConfig)
    .describe(
      'Resource datasets keyed by id. Every dataset in a new map must define source.tableName or source.sqlQuery.',
    ),
  configMode: z.enum(['basic', 'custom']).optional(),
  mapStyle: z.string().optional(),
  mapProps: z.record(z.string(), z.unknown()).optional(),
  showLegends: z.boolean().optional(),
  interaction: DeckMapInteractionConfig.optional(),
  fitToData: DeckMapFitToDataConfig.optional(),
  dataPolicy: z
    .looseObject({
      disabled: z.boolean().optional(),
      maxRows: z.number().int().min(1).optional(),
      reason: z.string().optional(),
    })
    .optional(),
  settingsOpen: z.boolean().optional(),
}) satisfies z.ZodType<DeckMapConfig>;

/** Validates inputs for an AI or command invocation that writes a map resource. */
export const DeckMapResourceToolParameters = z.object({
  title: z.string().optional().default('Map'),
  config: DeckMapResourceConfigParameter,
  tableName: z.string().optional(),
  replaceLayers: z
    .boolean()
    .optional()
    .describe(
      'Set true when config.spec.layers is the complete desired list and omitted existing layers should be removed.',
    ),
  reasoning: z.string(),
});
