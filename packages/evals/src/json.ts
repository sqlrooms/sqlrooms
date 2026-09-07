import {z} from 'zod';

/** A JSON primitive value. */
export type JsonPrimitive = string | number | boolean | null;

/** A JSON object with recursively serializable values. */
export type JsonObject = {[key: string]: JsonValue};

/** A value that can be serialized losslessly as JSON. */
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

/** Runtime schema for recursively serializable JSON values. */
export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema),
  ]),
);

/** Runtime schema for JSON objects. */
export const JsonObjectSchema: z.ZodType<JsonObject> = z.record(
  z.string(),
  JsonValueSchema,
);
