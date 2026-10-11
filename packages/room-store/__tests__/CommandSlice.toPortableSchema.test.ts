import {z} from 'zod';
import {exportCommandInputSchema} from '../src/CommandSlice';

describe('toPortableSchema via exportCommandInputSchema', () => {
  it('includes JSON Schema draft marker', () => {
    expect(exportCommandInputSchema(z.string())).toMatchObject({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
    });
  });

  it('exports primitive schemas', () => {
    expect(exportCommandInputSchema(z.string())).toMatchObject({
      type: 'string',
    });
    expect(exportCommandInputSchema(z.number())).toMatchObject({
      type: 'number',
    });
    expect(exportCommandInputSchema(z.boolean())).toMatchObject({
      type: 'boolean',
    });
    expect(exportCommandInputSchema(z.bigint())).toMatchObject({
      type: 'string',
      format: 'bigint',
    });
    expect(exportCommandInputSchema(z.date())).toMatchObject({
      type: 'string',
      format: 'date-time',
    });
  });

  it('exports literal schemas with const and inferred primitive type', () => {
    expect(exportCommandInputSchema(z.literal('hello'))).toMatchObject({
      type: 'string',
      const: 'hello',
    });
    expect(exportCommandInputSchema(z.literal(7))).toMatchObject({
      type: 'number',
      const: 7,
    });
    expect(exportCommandInputSchema(z.literal(true))).toMatchObject({
      type: 'boolean',
      const: true,
    });
  });

  it('exports enum schemas', () => {
    expect(exportCommandInputSchema(z.enum(['red', 'blue']))).toMatchObject({
      type: 'string',
      enum: ['red', 'blue'],
    });
  });

  it('exports array schemas with items', () => {
    expect(exportCommandInputSchema(z.array(z.number()))).toMatchObject({
      type: 'array',
      items: {type: 'number'},
    });
  });

  it('exports object schemas with properties and required keys', () => {
    const schema = z.object({
      id: z.string(),
      label: z.string().optional(),
      enabled: z.boolean(),
    });

    expect(exportCommandInputSchema(schema)).toMatchObject({
      type: 'object',
      additionalProperties: false,
      properties: {
        id: {type: 'string'},
        label: {type: 'string'},
        enabled: {type: 'boolean'},
      },
      required: ['id', 'enabled'],
    });
  });

  it('exports union schemas as anyOf', () => {
    const schema = z.union([z.string(), z.number()]);
    expect(exportCommandInputSchema(schema)).toMatchObject({
      anyOf: [{type: 'string'}, {type: 'number'}],
    });
  });

  it('exports optional schemas without extra optional flag', () => {
    expect(exportCommandInputSchema(z.string().optional())).toMatchObject({
      type: 'string',
    });
  });

  it('exports nullable schemas as anyOf with null', () => {
    expect(exportCommandInputSchema(z.string().nullable())).toMatchObject({
      anyOf: [{type: 'string'}, {type: 'null'}],
    });
  });

  it('exports default schemas with default value', () => {
    expect(exportCommandInputSchema(z.string().default('abc'))).toMatchObject({
      type: 'string',
      default: 'abc',
    });
  });

  it('returns undefined for undefined input schema', () => {
    expect(exportCommandInputSchema(undefined)).toBeUndefined();
  });
});
