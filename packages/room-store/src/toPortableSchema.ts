import {z, ZodType} from 'zod';
import type {RoomCommandPortableSchema} from './CommandSlice';

/**
 * Converts a Zod schema into a JSON Schema-compatible structure used by command
 * descriptors and adapters.
 *
 * The conversion is based on `z.toJSONSchema()` so that we rely on Zod's
 * maintained conversion logic instead of traversing Zod internals directly.
 *
 * Zod marks some types as unrepresentable in JSON Schema (for example date and
 * bigint). We opt into `unrepresentable: 'any'` and then restore useful type
 * hints in `override`:
 * - `z.date()`   -> `{type: 'string', format: 'date-time'}`
 * - `z.bigint()` -> `{type: 'string', format: 'bigint'}`
 */
export function toPortableSchema(
  schema: ZodType<unknown>,
): RoomCommandPortableSchema {
  return z.toJSONSchema(schema, {
    unrepresentable: 'any',
    override: (ctx) => {
      const schemaType = (ctx.zodSchema as unknown as {def?: {type?: string}})
        .def?.type;
      if (schemaType === 'date') {
        ctx.jsonSchema.type = 'string';
        ctx.jsonSchema.format = 'date-time';
      } else if (schemaType === 'bigint') {
        ctx.jsonSchema.type = 'string';
        ctx.jsonSchema.format = 'bigint';
      }
    },
  }) as RoomCommandPortableSchema;
}
