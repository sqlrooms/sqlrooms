import {EditorState} from '@codemirror/state';
import {json} from '@codemirror/lang-json';
import {jsonSchemaAutocomplete} from '../src/extensions/json-schema-autocomplete';
import {CompletionContext, CompletionResult} from '@codemirror/autocomplete';
import {createJsonSchemaValidator} from '../src/utils/create-json-schema-validator';

// Mock react-markdown and remark-gfm to avoid ES module issues in Jest
jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({children}: {children: string}) => children,
}));
jest.mock('remark-gfm', () => ({
  __esModule: true,
  default: () => {},
}));

const TEST_SCHEMA = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      description: 'Full name of the user',
    },
    email: {
      type: 'string',
      description: 'Email address',
    },
    age: {
      type: 'number',
      description: 'Age in years',
    },
    status: {
      type: 'string',
      description: 'Account status',
      enum: ['active', 'inactive', 'pending', 'suspended'],
    },
    premium: {
      type: 'boolean',
      description: 'Premium membership status',
    },
    settings: {
      type: 'object',
      properties: {
        theme: {
          type: 'string',
          enum: ['light', 'dark', 'auto'],
        },
        notifications: {
          type: 'boolean',
        },
      },
    },
  },
} as const;

/**
 * Helper to get completions at a specific position in the document
 */
async function getCompletions(
  text: string,
  pos: number,
  schema: object,
): Promise<CompletionResult | null> {
  const validator = createJsonSchemaValidator(schema);
  const autocompleteExt = jsonSchemaAutocomplete(validator);
  const state = EditorState.create({
    doc: text,
    extensions: [json(), autocompleteExt],
  });

  const context = new CompletionContext(state, pos, false);

  // Extract the completion source from the autocomplete configuration
  const config = Array.isArray(autocompleteExt)
    ? autocompleteExt.find((ext) => ext.value?.override)
    : null;

  if (!config?.value?.override?.[0]) {
    return null;
  }

  const completionSource = config.value.override[0];
  return await completionSource(context);
}

/**
 * Helper to extract completion labels
 */
async function getCompletionLabels(
  text: string,
  pos: number,
  schema: object,
): Promise<string[]> {
  const result = await getCompletions(text, pos, schema);
  return result?.options?.map((opt) => opt.label) ?? [];
}

describe('jsonSchemaAutocomplete', () => {
  describe('root level property completions', () => {
    it('should suggest all root properties in empty object', async () => {
      const text = '{|}';
      const pos = text.indexOf('|');
      const labels = await getCompletionLabels(text, pos, TEST_SCHEMA);

      expect(labels).toEqual([
        'name',
        'email',
        'age',
        'status',
        'premium',
        'settings',
      ]);
    });

    it('should exclude already-defined properties', async () => {
      const text = '{"name": "John","email": "test@example.com",|}';
      const pos = text.indexOf('|');
      const labels = await getCompletionLabels(text, pos, TEST_SCHEMA);

      expect(labels).toEqual(['age', 'status', 'premium', 'settings']);
    });
  });

  describe('nested property completions', () => {
    it('should suggest nested properties inside settings object', async () => {
      const text = '{"settings": {|}}';
      const pos = text.indexOf('|');
      const labels = await getCompletionLabels(text, pos, TEST_SCHEMA);

      expect(labels).toEqual(['theme', 'notifications']);
    });

    it('should exclude already-defined nested properties', async () => {
      const text = '{"settings": {"theme": "dark", |}}';
      const pos = text.indexOf('|');
      const labels = await getCompletionLabels(text, pos, TEST_SCHEMA);

      expect(labels).toEqual(['notifications']);
    });

    it('should handle deeply nested objects', async () => {
      const deepSchema = {
        type: 'object',
        properties: {
          level1: {
            type: 'object',
            properties: {
              level2: {
                type: 'object',
                properties: {
                  deepProp: {type: 'string'},
                },
              },
            },
          },
        },
      };

      const text = '{"level1": {"level2": {|}}}';
      const pos = text.indexOf('|');
      const labels = await getCompletionLabels(text, pos, deepSchema);

      expect(labels).toEqual(['deepProp']);
    });
  });

  describe('value completions', () => {
    it('should suggest enum values for status field', async () => {
      const text = '{"status": |}';
      const pos = text.indexOf('|');
      const labels = await getCompletionLabels(text, pos, TEST_SCHEMA);

      expect(labels).toEqual([
        '"active"',
        '"inactive"',
        '"pending"',
        '"suspended"',
      ]);
    });

    it('should suggest boolean values for premium field', async () => {
      const text = '{"premium": |}';
      const pos = text.indexOf('|');
      const labels = await getCompletionLabels(text, pos, TEST_SCHEMA);

      expect(labels).toEqual(['true', 'false']);
    });

    it('should suggest enum values for nested properties', async () => {
      const text = '{"settings": {"theme": |}}';
      const pos = text.indexOf('|');
      const labels = await getCompletionLabels(text, pos, TEST_SCHEMA);

      expect(labels).toEqual(['"light"', '"dark"', '"auto"']);
    });

    it('should suggest boolean values for nested properties', async () => {
      const text = '{"settings": {"notifications": |}}';
      const pos = text.indexOf('|');
      const labels = await getCompletionLabels(text, pos, TEST_SCHEMA);

      expect(labels).toEqual(['true', 'false']);
    });

    it('should handle null type', async () => {
      const schemaWithNull = {
        type: 'object',
        properties: {
          optional: {
            type: 'null',
          },
        },
      };

      const text = '{"optional": |}';
      const pos = text.indexOf('|');
      const labels = await getCompletionLabels(text, pos, schemaWithNull);

      expect(labels).toEqual(['null']);
    });

    it('should not suggest value completions for non-enum strings', async () => {
      const text = '{"name": |}';
      const pos = text.indexOf('|');
      const result = await getCompletions(text, pos, TEST_SCHEMA);

      // Should return null or empty for non-enum string types
      expect(result?.options?.length || 0).toBe(0);
    });

    it('should not suggest value completions for numbers', async () => {
      const text = '{"age": |}';
      const pos = text.indexOf('|');
      const result = await getCompletions(text, pos, TEST_SCHEMA);

      // Should return null or empty for number types
      expect(result?.options?.length || 0).toBe(0);
    });
  });

  describe('completion context detection', () => {
    it('should detect property key position after opening brace', async () => {
      const text = '{|';
      const pos = text.indexOf('|');
      const labels = await getCompletionLabels(text, pos, TEST_SCHEMA);

      // Should suggest property keys, not values
      expect(labels).toEqual([
        'name',
        'email',
        'age',
        'status',
        'premium',
        'settings',
      ]);
    });

    it('should detect value position after colon', async () => {
      const text = '{"premium": |';
      const pos = text.indexOf('|');
      const labels = await getCompletionLabels(text, pos, TEST_SCHEMA);

      // Should suggest values, not property keys
      expect(labels).toEqual(['true', 'false']);
    });

    it('should detect property key position after comma', async () => {
      const text = '{"name": "John",|';
      const pos = text.indexOf('|');
      const labels = await getCompletionLabels(text, pos, TEST_SCHEMA);

      // Should suggest property keys (excluding already-defined 'name')
      expect(labels).toEqual(['email', 'age', 'status', 'premium', 'settings']);
    });
  });

  describe('edge cases', () => {
    it('should handle empty schema', async () => {
      const emptySchema = {};
      const text = '{|}';
      const pos = text.indexOf('|');
      const result = await getCompletions(text, pos, emptySchema);

      expect(result?.options?.length || 0).toBe(0);
    });

    it('should handle schema without properties', async () => {
      const schemaWithoutProps = {
        type: 'object',
      };
      const text = '{|}';
      const pos = text.indexOf('|');
      const result = await getCompletions(text, pos, schemaWithoutProps);

      expect(result?.options?.length || 0).toBe(0);
    });

    it('should handle invalid JSON gracefully', async () => {
      const text = '{invalid|';
      const pos = text.indexOf('|');

      // Should not throw an error
      await expect(
        getCompletions(text, pos, TEST_SCHEMA),
      ).resolves.toBeDefined();
    });

    it('should handle completion at start of document', async () => {
      const text = '|';
      const pos = text.indexOf('|');

      // Should not throw an error
      await expect(
        getCompletions(text, pos, TEST_SCHEMA),
      ).resolves.toBeDefined();
    });

    it('should handle completion in array context', async () => {
      const arraySchema = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: {type: 'number'},
            name: {type: 'string'},
          },
        },
      };

      const text = '[{|}]';
      const pos = text.indexOf('|');
      const labels = await getCompletionLabels(text, pos, arraySchema);

      expect(labels).toEqual(['id', 'name']);
    });
  });

  describe('completion application', () => {
    it('should apply property completion with colon and space', async () => {
      const text = '{|}';
      const pos = text.indexOf('|');
      const result = await getCompletions(text, pos, TEST_SCHEMA);

      const nameCompletion = result?.options?.find(
        (opt) => opt.label === 'name',
      );
      expect(nameCompletion?.apply).toContain('name');
    });

    it('should apply enum value completion', async () => {
      const text = '{"status": |}';
      const pos = text.indexOf('|');
      const result = await getCompletions(text, pos, TEST_SCHEMA);

      const activeCompletion = result?.options?.find(
        (opt) => opt.label === '"active"',
      );
      expect(activeCompletion?.apply).toContain('active');
    });

    it('should apply boolean completion', async () => {
      const text = '{"premium": |}';
      const pos = text.indexOf('|');
      const result = await getCompletions(text, pos, TEST_SCHEMA);

      const trueCompletion = result?.options?.find(
        (opt) => opt.label === 'true',
      );
      expect(trueCompletion?.apply).toContain('true');
    });
  });

  describe('path resolution bug fixes', () => {
    it('should correctly resolve value completions without double-nesting', async () => {
      // This test verifies the fix for the first bug (parent path stripping)
      const text = '{"status": |}';
      const pos = text.indexOf('|');
      const labels = await getCompletionLabels(text, pos, TEST_SCHEMA);

      // Should find the enum values for status
      expect(labels).toEqual([
        '"active"',
        '"inactive"',
        '"pending"',
        '"suspended"',
      ]);
    });

    it('should correctly extract property name from Property nodes', async () => {
      // This test verifies the fix for the second bug (PropertyName extraction)
      const text = '{"settings": {|}}';
      const pos = text.indexOf('|');
      const labels = await getCompletionLabels(text, pos, TEST_SCHEMA);

      // Should find nested properties, not root properties
      expect(labels).toEqual(['theme', 'notifications']);
    });
  });

  describe('union types (multiple type values)', () => {
    it('should suggest null for string | null type', async () => {
      const schemaWithUnion = {
        type: 'object',
        properties: {
          optionalName: {
            type: ['string', 'null'],
            description: 'Optional name field',
          },
        },
      };

      const text = '{"optionalName": |}';
      const pos = text.indexOf('|');
      const labels = await getCompletionLabels(text, pos, schemaWithUnion);

      expect(labels).toEqual(['null']);
    });

    it('should suggest true, false, and null for boolean | null type', async () => {
      const schemaWithUnion = {
        type: 'object',
        properties: {
          optionalFlag: {
            type: ['boolean', 'null'],
          },
        },
      };

      const text = '{"optionalFlag": |}';
      const pos = text.indexOf('|');
      const labels = await getCompletionLabels(text, pos, schemaWithUnion);

      expect(labels).toEqual(['true', 'false', 'null']);
    });

    it('should suggest enum values and null for enum with null type', async () => {
      const schemaWithUnion = {
        type: 'object',
        properties: {
          optionalStatus: {
            type: ['string', 'null'],
            enum: ['active', 'inactive', null],
          },
        },
      };

      const text = '{"optionalStatus": |}';
      const pos = text.indexOf('|');
      const labels = await getCompletionLabels(text, pos, schemaWithUnion);

      expect(labels).toEqual(['"active"', '"inactive"', 'null']);
    });

    it('should not suggest completions for number | string union without enum', async () => {
      const schemaWithUnion = {
        type: 'object',
        properties: {
          flexibleValue: {
            type: ['number', 'string'],
          },
        },
      };

      const text = '{"flexibleValue": |}';
      const pos = text.indexOf('|');
      const result = await getCompletions(text, pos, schemaWithUnion);

      // No suggestions for non-enum, non-boolean, non-null types
      expect(result?.options?.length || 0).toBe(0);
    });
  });
});
