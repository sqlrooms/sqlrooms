import {z, ZodType} from 'zod';
import type {JSONSchema} from 'zod/v4/core';
import type {RoomCommandPortableSchema} from './RoomCommandPortableSchema';

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
  const jsonSchema = z.toJSONSchema(schema, {
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
  });
  expandCompactUnions(jsonSchema);
  return jsonSchema as RoomCommandPortableSchema;
}

// Zod compacts unions of bare types after its override callback. Keep the
// command descriptor's anyOf form and leave defaults and examples untouched.
function expandCompactUnions(schema: JSONSchema._JSONSchema | undefined): void {
  if (typeof schema !== 'object') return;

  const {type} = schema;
  if (Array.isArray(type)) {
    const anyOf = type.map((member: JSONSchema.BaseSchema['type']) => ({
      type: member,
    }));
    delete schema.type;
    if (schema.anyOf) {
      (schema.allOf ??= []).push({anyOf});
    } else {
      schema.anyOf = anyOf;
    }
  }

  [
    ...Object.values(schema.$defs ?? {}),
    ...Object.values(schema.properties ?? {}),
    ...Object.values(schema.patternProperties ?? {}),
    ...Object.values(schema.dependentSchemas ?? {}),
    ...(Array.isArray(schema.items) ? schema.items : [schema.items]),
    ...(schema.prefixItems ?? []),
    ...(schema.anyOf ?? []),
    ...(schema.oneOf ?? []),
    ...(schema.allOf ?? []),
    schema.additionalProperties,
    schema.propertyNames,
    schema.contains,
    schema.unevaluatedItems,
    schema.unevaluatedProperties,
    schema.not,
    schema.if,
    schema.then,
    schema.else,
    schema.contentSchema,
  ].forEach(expandCompactUnions);
}
