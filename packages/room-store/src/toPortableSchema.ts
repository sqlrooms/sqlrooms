import {ZodType} from 'zod';
import type {RoomCommandPortableSchema} from './CommandSlice';

/**
 * Converts a Zod schema into a portable, JSON-like structure used by command
 * descriptors and adapters.
 *
 * This function intentionally returns a compact subset that is easy to serialize
 * and consume outside this package, rather than full JSON Schema output.
 *
 * Supported schema kinds include primitives, literal, enum, array, object,
 * union (`anyOf`), optional, nullable, and default wrappers.
 *
 * Important: this currently relies on Zod internals (`schema.def` and nested
 * fields) to preserve existing behavior. If Zod changes internal definitions in
 * a future release, this converter may need updates.
 *
 * Unknown or unhandled schema types degrade safely:
 * - missing/non-string type -> `type: 'unknown'`
 * - unhandled string type -> passthrough `type`
 */
export function toPortableSchema(
  schema: ZodType<unknown>,
): RoomCommandPortableSchema {
  const definition = (schema as unknown as {def?: Record<string, unknown>}).def;
  const base: RoomCommandPortableSchema = {
    ...(schema.description ? {description: schema.description} : {}),
  };
  const schemaType = definition?.type;

  if (typeof schemaType !== 'string') {
    return {
      ...base,
      type: 'unknown',
    };
  }

  if (
    schemaType === 'string' ||
    schemaType === 'number' ||
    schemaType === 'boolean' ||
    schemaType === 'bigint' ||
    schemaType === 'date'
  ) {
    return {...base, type: schemaType};
  }

  if (schemaType === 'literal') {
    const literalValues = definition?.values as unknown[] | undefined;
    const literalValue = literalValues?.[0];
    return {
      ...base,
      type:
        typeof literalValue === 'string'
          ? 'string'
          : typeof literalValue === 'number'
            ? 'number'
            : typeof literalValue === 'boolean'
              ? 'boolean'
              : 'unknown',
      const: literalValue,
    };
  }

  if (schemaType === 'enum') {
    const enumEntries = definition?.entries as
      | Record<string, unknown>
      | undefined;
    return {
      ...base,
      type: 'string',
      enum: enumEntries ? Object.values(enumEntries) : [],
    };
  }

  if (schemaType === 'array') {
    const element = definition?.element as ZodType<unknown> | undefined;
    return {
      ...base,
      type: 'array',
      items: element ? toPortableSchema(element) : undefined,
    };
  }

  if (schemaType === 'object') {
    const shapeDefinition = definition?.shape as
      | Record<string, ZodType>
      | (() => Record<string, ZodType>)
      | undefined;
    const shape =
      typeof shapeDefinition === 'function'
        ? shapeDefinition()
        : shapeDefinition;
    const properties: Record<string, RoomCommandPortableSchema> = {};
    const required: string[] = [];
    for (const [key, childSchema] of Object.entries(shape ?? {})) {
      properties[key] = toPortableSchema(childSchema);
      if (!childSchema.isOptional()) {
        required.push(key);
      }
    }
    return {
      ...base,
      type: 'object',
      properties,
      required,
    };
  }

  if (schemaType === 'union') {
    const options =
      (definition?.options as ZodType<unknown>[] | undefined) ?? [];
    return {
      ...base,
      anyOf: options.map((option) => toPortableSchema(option)),
    };
  }

  if (schemaType === 'optional') {
    const innerType = definition?.innerType as ZodType<unknown> | undefined;
    const innerSchema = innerType
      ? toPortableSchema(innerType)
      : {type: 'unknown'};
    return {
      ...base,
      ...innerSchema,
      optional: true,
    };
  }

  if (schemaType === 'nullable') {
    const innerType = definition?.innerType as ZodType<unknown> | undefined;
    const innerSchema = innerType
      ? toPortableSchema(innerType)
      : {type: 'unknown'};
    return {
      ...base,
      ...innerSchema,
      nullable: true,
    };
  }

  if (schemaType === 'default') {
    const innerType = definition?.innerType as ZodType<unknown> | undefined;
    const defaultValue = definition?.defaultValue as unknown;
    const innerSchema = innerType
      ? toPortableSchema(innerType)
      : {type: 'unknown'};
    return {
      ...base,
      ...innerSchema,
      default: resolveDefaultValue(defaultValue),
    };
  }

  return {
    ...base,
    type: schemaType,
  };
}

function resolveDefaultValue(defaultValue: unknown): unknown {
  if (typeof defaultValue !== 'function') {
    return defaultValue;
  }

  try {
    return defaultValue();
  } catch {
    return undefined;
  }
}
