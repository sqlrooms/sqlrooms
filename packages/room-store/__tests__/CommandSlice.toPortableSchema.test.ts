import {z, ZodType} from 'zod';
import {exportCommandInputSchema} from '../src/CommandSlice';

describe('toPortableSchema via exportCommandInputSchema', () => {
  it('exports primitive schemas', () => {
    expect(exportCommandInputSchema(z.string())).toEqual({type: 'string'});
    expect(exportCommandInputSchema(z.number())).toEqual({type: 'number'});
    expect(exportCommandInputSchema(z.boolean())).toEqual({type: 'boolean'});
    expect(exportCommandInputSchema(z.bigint())).toEqual({type: 'bigint'});
    expect(exportCommandInputSchema(z.date())).toEqual({type: 'date'});
  });

  it('exports literal schemas with const and inferred primitive type', () => {
    expect(exportCommandInputSchema(z.literal('hello'))).toEqual({
      type: 'string',
      const: 'hello',
    });
    expect(exportCommandInputSchema(z.literal(7))).toEqual({
      type: 'number',
      const: 7,
    });
    expect(exportCommandInputSchema(z.literal(true))).toEqual({
      type: 'boolean',
      const: true,
    });
  });

  it('exports enum schemas', () => {
    expect(exportCommandInputSchema(z.enum(['red', 'blue']))).toEqual({
      type: 'string',
      enum: ['red', 'blue'],
    });
  });

  it('exports array schemas with items', () => {
    expect(exportCommandInputSchema(z.array(z.number()))).toEqual({
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

    expect(exportCommandInputSchema(schema)).toEqual({
      type: 'object',
      properties: {
        id: {type: 'string'},
        label: {type: 'string', optional: true},
        enabled: {type: 'boolean'},
      },
      required: ['id', 'enabled'],
    });
  });

  it('exports union schemas as anyOf', () => {
    const schema = z.union([z.string(), z.number()]);
    expect(exportCommandInputSchema(schema)).toEqual({
      anyOf: [{type: 'string'}, {type: 'number'}],
    });
  });

  it('exports optional schemas with optional flag', () => {
    expect(exportCommandInputSchema(z.string().optional())).toEqual({
      type: 'string',
      optional: true,
    });
  });

  it('exports nullable schemas with nullable flag', () => {
    expect(exportCommandInputSchema(z.string().nullable())).toEqual({
      type: 'string',
      nullable: true,
    });
  });

  it('exports default schemas with default value', () => {
    expect(exportCommandInputSchema(z.string().default('abc'))).toEqual({
      type: 'string',
      default: 'abc',
    });
  });

  it('falls back to unknown when schema type is unavailable', () => {
    const schemaWithoutType = {
      def: {},
    } as unknown as ZodType<unknown>;

    expect(exportCommandInputSchema(schemaWithoutType)).toEqual({
      type: 'unknown',
    });
  });

  it('falls back to passthrough type for unhandled schema kinds', () => {
    const schemaWithUnhandledType = {
      def: {type: 'tuple'},
    } as unknown as ZodType<unknown>;

    expect(exportCommandInputSchema(schemaWithUnhandledType)).toEqual({
      type: 'tuple',
    });
  });
});
