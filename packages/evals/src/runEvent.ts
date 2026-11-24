import {z} from 'zod';
import {JsonObjectSchema, JsonValueSchema} from './json.js';

/** Ordered event captured while a behavioral scenario runs. */
export const RunEvidenceEventSchema = z
  .looseObject({
    sequence: z.number().int().nonnegative(),
    timestamp: z.string().datetime(),
    type: z.enum([
      'model',
      'tool',
      'nested-agent',
      'approval',
      'error',
      'mutation',
    ]),
    name: z.string().min(1).optional(),
    data: JsonObjectSchema.default(() => ({})),
  })
  .catchall(JsonValueSchema);

/** One ordered run event. */
export type RunEvidenceEvent = z.infer<typeof RunEvidenceEventSchema>;
